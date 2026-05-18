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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    started_at DATETIME,
    ended_at DATETIME,
    model TEXT,
    task_summary TEXT
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
CREATE INDEX IF NOT EXISTS idx_rules_section ON rules_metadata(section_id);
"""


def get_db() -> sqlite3.Connection:
    """Get a database connection, initializing schema if needed."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    return conn


def record_references(conn: sqlite3.Connection, session_id: str, matches: list):
    """Record rule reference matches for a session.
    
    matches: [{"rule_id": "...", "keyword": "..."}, ...]
    Deduplicates: same rule_id + keyword in same session only counted once.
    """
    seen = set()
    for m in matches:
        key = (session_id, m["rule_id"], m["keyword"])
        if key in seen:
            continue
        seen.add(key)
        conn.execute(
            "INSERT OR IGNORE INTO rule_references (rule_id, session_id, matched_keyword) VALUES (?, ?, ?)",
            (m["rule_id"], session_id, m["keyword"])
        )
    conn.commit()


def upsert_session(conn: sqlite3.Connection, session_id: str, model: str = None, summary: str = None):
    """Insert or update a session record."""
    conn.execute(
        """INSERT INTO sessions (session_id, ended_at, model, task_summary)
           VALUES (?, datetime('now'), ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
               ended_at = datetime('now'),
               model = excluded.model,
               task_summary = excluded.task_summary""",
        (session_id, model, summary)
    )
    conn.commit()


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


def get_rule_stats(conn: sqlite3.Connection, days: int = 30) -> list:
    """Get citation stats for all rules in the last N days."""
    rows = conn.execute(
        """SELECT rm.rule_id, rm.section_id, rm.title, rm.keywords,
                  COUNT(DISTINCT rr.session_id) as session_count,
                  COUNT(rr.id) as match_count,
                  MAX(rr.timestamp) as last_referenced
           FROM rules_metadata rm
           LEFT JOIN rule_references rr ON rm.rule_id = rr.rule_id
               AND rr.timestamp >= datetime('now', ?)
           GROUP BY rm.rule_id
           ORDER BY session_count DESC""",
        (f"-{days} days",)
    ).fetchall()
    return [dict(r) for r in rows]


if __name__ == "__main__":
    conn = get_db()
    db_path = str(DB_PATH)
    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()]
    print(f"Database initialized at: {db_path}")
    print(f"Tables: {tables}")
    conn.close()
