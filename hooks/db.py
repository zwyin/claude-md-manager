#!/usr/bin/env python3
"""SQLite database layer for rule citation tracking."""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "usage.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS rule_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    matched_keyword TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'low',
    source TEXT NOT NULL DEFAULT 'hook_posttool',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    started_at DATETIME,
    ended_at DATETIME,
    model TEXT,
    task_summary TEXT,
    last_offset INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rules_metadata (
    rule_id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    title TEXT NOT NULL,
    keywords TEXT,
    source_file TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sections_metadata (
    section_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source_file TEXT NOT NULL,
    rule_count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_drafts (
    rule_id TEXT PRIMARY KEY,
    frontmatter_yaml TEXT NOT NULL,
    markdown_body TEXT NOT NULL,
    order_override INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publish_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    rules_changed INTEGER NOT NULL,
    snapshot_name TEXT,
    status TEXT NOT NULL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_refs_rule ON rule_references(rule_id);
CREATE INDEX IF NOT EXISTS idx_refs_time ON rule_references(timestamp);
CREATE INDEX IF NOT EXISTS idx_refs_session ON rule_references(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refs_dedup ON rule_references(rule_id, session_id, matched_keyword);
CREATE INDEX IF NOT EXISTS idx_rules_section ON rules_metadata(section_id);
"""

# Migration: add columns to existing tables if they were created before this version
_MIGRATION_SQL = [
    "ALTER TABLE rule_references ADD COLUMN confidence TEXT NOT NULL DEFAULT 'low'",
    "ALTER TABLE rule_references ADD COLUMN source TEXT NOT NULL DEFAULT 'hook_posttool'",
    "ALTER TABLE sessions ADD COLUMN last_offset INTEGER NOT NULL DEFAULT 0",
]


def get_db() -> sqlite3.Connection:
    """Get a database connection, initializing schema if needed."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.executescript(SCHEMA_SQL)
    _run_migrations(conn)
    return conn


def _run_migrations(conn: sqlite3.Connection):
    """Apply incremental schema migrations for existing databases."""
    existing = {r[1] for r in conn.execute("PRAGMA table_info(rule_references)").fetchall()}
    if "confidence" not in existing:
        conn.execute(_MIGRATION_SQL[0])
    if "source" not in existing:
        conn.execute(_MIGRATION_SQL[1])

    sess_cols = {r[1] for r in conn.execute("PRAGMA table_info(sessions)").fetchall()}
    if "last_offset" not in sess_cols:
        conn.execute(_MIGRATION_SQL[2])
    conn.commit()


def record_references(conn: sqlite3.Connection, session_id: str, matches: list,
                      source: str = "hook_posttool"):
    """Record rule reference matches for a session.

    matches: [{"rule_id": "...", "keyword": "...", "confidence": "low"|"medium"|"high"}, ...]
    Deduplicates: same rule_id + keyword + source in same session, keeping highest confidence.
    """
    seen = set()
    for m in matches:
        key = (session_id, m["rule_id"], m["keyword"])
        if key in seen:
            continue
        seen.add(key)
        confidence = m.get("confidence", "low")
        conn.execute(
            """INSERT INTO rule_references (rule_id, session_id, matched_keyword, confidence, source)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(rule_id, session_id, matched_keyword) DO UPDATE SET
                   confidence = CASE
                       WHEN rule_references.confidence = 'high' THEN 'high'
                       WHEN rule_references.confidence = 'medium' AND ? IN ('medium', 'high') THEN ?
                       ELSE ?
                   END,
                   source = CASE
                       WHEN ? IN ('high') THEN ?
                       WHEN rule_references.confidence = 'high' THEN rule_references.source
                       ELSE ?
                   END""",
            (m["rule_id"], session_id, m["keyword"], confidence, source,
             confidence, confidence, confidence,
             confidence, source, source)
        )
    conn.commit()


def upsert_session(conn: sqlite3.Connection, session_id: str, model: str | None = None, summary: str | None = None):
    """Insert or update a session record.

    Only overwrites model/task_summary when non-None values are provided,
    so incremental hook calls don't erase previously extracted metadata.
    """
    conn.execute(
        """INSERT INTO sessions (session_id, started_at, ended_at, model, task_summary)
           VALUES (?, datetime('now'), datetime('now'), ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
               ended_at = datetime('now'),
               model = COALESCE(?, sessions.model),
               task_summary = COALESCE(?, sessions.task_summary)""",
        (session_id, model, summary, model, summary)
    )
    conn.commit()


def get_session_offset(conn: sqlite3.Connection, session_id: str) -> int:
    """Get the last scanned line offset for a session."""
    row = conn.execute(
        "SELECT last_offset FROM sessions WHERE session_id = ?",
        (session_id,)
    ).fetchone()
    return row["last_offset"] if row else 0


def update_session_offset(conn: sqlite3.Connection, session_id: str, offset: int):
    """Update the last scanned line offset for a session."""
    conn.execute(
        "UPDATE sessions SET last_offset = ? WHERE session_id = ?",
        (offset, session_id)
    )


def sync_rules_metadata(conn: sqlite3.Connection, rules_data: list):
    """Sync rules metadata from frontmatter into the database."""
    for r in rules_data:
        conn.execute(
            """INSERT INTO rules_metadata (rule_id, section_id, title, keywords, source_file, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(rule_id) DO UPDATE SET
                   section_id = excluded.section_id,
                   title = excluded.title,
                   keywords = excluded.keywords,
                   source_file = excluded.source_file,
                   updated_at = datetime('now')""",
            (r["rule_id"], r["section_id"], r["title"], json.dumps(r["keywords"]), r["source_file"])
        )
    conn.commit()


def sync_sections_metadata(conn: sqlite3.Connection, sections_data: list):
    """Sync section-level metadata into the database.

    sections_data: [{"section_id": "...", "title": "...", "source_file": "...", "rule_count": N}, ...]
    """
    for s in sections_data:
        conn.execute(
            """INSERT INTO sections_metadata (section_id, title, source_file, rule_count, updated_at)
               VALUES (?, ?, ?, ?, datetime('now'))
               ON CONFLICT(section_id) DO UPDATE SET
                   title = excluded.title,
                   source_file = excluded.source_file,
                   rule_count = excluded.rule_count,
                   updated_at = datetime('now')""",
            (s["section_id"], s["title"], s["source_file"], s["rule_count"])
        )
    conn.commit()


if __name__ == "__main__":
    conn = get_db()
    db_path = str(DB_PATH)
    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()]
    print(f"Database initialized at: {db_path}")
    print(f"Tables: {tables}")
    conn.close()
