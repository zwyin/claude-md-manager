"""Tests for hooks/db.py — SQLite data layer."""

import sys
import json
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hooks"))
from db import (
    get_db,
    record_references,
    upsert_session,
    sync_rules_metadata,
    sync_sections_metadata,
)


@pytest.fixture
def conn(tmp_path, monkeypatch):
    """Create an in-memory DB with schema, bypassing file-based DB_PATH."""
    import db as db_mod
    monkeypatch.setattr(db_mod, "DB_PATH", tmp_path / "test.db")
    connection = get_db()
    yield connection
    connection.close()


class TestGetDb:
    def test_creates_tables(self, conn):
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()]
        assert "rule_references" in tables
        assert "sessions" in tables
        assert "rules_metadata" in tables
        assert "sections_metadata" in tables
        assert "rule_drafts" in tables
        assert "publish_history" in tables

    def test_creates_indexes(self, conn):
        indexes = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        ).fetchall()]
        assert "idx_refs_rule" in indexes
        assert "idx_refs_time" in indexes
        assert "idx_refs_session" in indexes


class TestRecordReferences:
    def test_records_match(self, conn):
        matches = [{"rule_id": "r1", "keyword": "test"}]
        record_references(conn, "s1", matches)
        rows = conn.execute("SELECT * FROM rule_references").fetchall()
        assert len(rows) == 1
        assert rows[0]["rule_id"] == "r1"
        assert rows[0]["matched_keyword"] == "test"

    def test_deduplicates_same_session(self, conn):
        matches = [
            {"rule_id": "r1", "keyword": "test"},
            {"rule_id": "r1", "keyword": "test"},
        ]
        record_references(conn, "s1", matches)
        rows = conn.execute("SELECT * FROM rule_references").fetchall()
        assert len(rows) == 1

    def test_different_sessions_not_deduped(self, conn):
        matches = [{"rule_id": "r1", "keyword": "test"}]
        record_references(conn, "s1", matches)
        record_references(conn, "s2", matches)
        rows = conn.execute("SELECT * FROM rule_references").fetchall()
        assert len(rows) == 2

    def test_different_keywords_not_deduped(self, conn):
        matches = [
            {"rule_id": "r1", "keyword": "kw1"},
            {"rule_id": "r1", "keyword": "kw2"},
        ]
        record_references(conn, "s1", matches)
        rows = conn.execute("SELECT * FROM rule_references").fetchall()
        assert len(rows) == 2

    def test_empty_matches(self, conn):
        record_references(conn, "s1", [])
        rows = conn.execute("SELECT * FROM rule_references").fetchall()
        assert len(rows) == 0


class TestUpsertSession:
    def test_insert_session(self, conn):
        upsert_session(conn, "s1", model="claude-4", summary="test task")
        row = conn.execute("SELECT * FROM sessions WHERE session_id = 's1'").fetchone()
        assert row is not None
        assert row["model"] == "claude-4"
        assert row["task_summary"] == "test task"

    def test_update_session(self, conn):
        upsert_session(conn, "s1", model="claude-4", summary="first")
        upsert_session(conn, "s1", model="claude-5", summary="second")
        rows = conn.execute("SELECT * FROM sessions WHERE session_id = 's1'").fetchall()
        assert len(rows) == 1
        assert rows[0]["model"] == "claude-5"
        assert rows[0]["task_summary"] == "second"

    def test_null_update_preserves_existing_metadata(self, conn):
        """Calling upsert with None should not overwrite existing model/summary."""
        upsert_session(conn, "s1", model="claude-4", summary="important task")
        upsert_session(conn, "s1", model=None, summary=None)
        row = conn.execute("SELECT model, task_summary FROM sessions WHERE session_id = 's1'").fetchone()
        assert row["model"] == "claude-4"
        assert row["task_summary"] == "important task"

    def test_null_then_value_updates_correctly(self, conn):
        """First call with None, then with value should set the value."""
        upsert_session(conn, "s1", model=None, summary=None)
        row = conn.execute("SELECT model, task_summary FROM sessions WHERE session_id = 's1'").fetchone()
        assert row["model"] is None
        assert row["task_summary"] is None
        upsert_session(conn, "s1", model="glm-5.1", summary="new task")
        row = conn.execute("SELECT model, task_summary FROM sessions WHERE session_id = 's1'").fetchone()
        assert row["model"] == "glm-5.1"
        assert row["task_summary"] == "new task"


class TestSyncRulesMetadata:
    def test_insert_rules(self, conn):
        rules = [
            {"rule_id": "r1", "section_id": "sec1", "title": "Rule 1",
             "keywords": ["kw1"], "source_file": "a.md"},
        ]
        sync_rules_metadata(conn, rules)
        row = conn.execute("SELECT * FROM rules_metadata WHERE rule_id = 'r1'").fetchone()
        assert row["title"] == "Rule 1"
        assert json.loads(row["keywords"]) == ["kw1"]

    def test_update_rules(self, conn):
        rules = [
            {"rule_id": "r1", "section_id": "sec1", "title": "Old",
             "keywords": [], "source_file": "a.md"},
        ]
        sync_rules_metadata(conn, rules)
        rules[0]["title"] = "New"
        sync_rules_metadata(conn, rules)
        row = conn.execute("SELECT * FROM rules_metadata WHERE rule_id = 'r1'").fetchone()
        assert row["title"] == "New"

    def test_multiple_rules(self, conn):
        rules = [
            {"rule_id": f"r{i}", "section_id": "sec1", "title": f"Rule {i}",
             "keywords": [], "source_file": "a.md"}
            for i in range(5)
        ]
        sync_rules_metadata(conn, rules)
        count = conn.execute("SELECT COUNT(*) FROM rules_metadata").fetchone()[0]
        assert count == 5


class TestSyncSectionsMetadata:
    def test_insert_sections(self, conn):
        sections = [
            {"section_id": "sec1", "title": "Section 1",
             "source_file": "a.md", "rule_count": 3},
        ]
        sync_sections_metadata(conn, sections)
        row = conn.execute("SELECT * FROM sections_metadata WHERE section_id = 'sec1'").fetchone()
        assert row["title"] == "Section 1"
        assert row["rule_count"] == 3

    def test_update_sections(self, conn):
        sections = [
            {"section_id": "sec1", "title": "Old Title",
             "source_file": "a.md", "rule_count": 1},
        ]
        sync_sections_metadata(conn, sections)
        sections[0]["title"] = "New Title"
        sections[0]["rule_count"] = 5
        sync_sections_metadata(conn, sections)
        row = conn.execute("SELECT * FROM sections_metadata WHERE section_id = 'sec1'").fetchone()
        assert row["title"] == "New Title"
        assert row["rule_count"] == 5


class TestSyncRulesMetadataCleanup:
    def test_stale_rules_not_removed(self, conn):
        """sync_rules_metadata does not delete rules that are not in the input."""
        sync_rules_metadata(conn, [
            {"rule_id": "r1", "section_id": "sec1", "title": "Keep",
             "keywords": [], "source_file": "a.md"},
        ])
        sync_rules_metadata(conn, [
            {"rule_id": "r2", "section_id": "sec1", "title": "New",
             "keywords": [], "source_file": "b.md"},
        ])
        count = conn.execute("SELECT COUNT(*) FROM rules_metadata").fetchone()[0]
        assert count == 2


class TestSyncSectionsMetadataCleanup:
    def test_stale_sections_not_removed(self, conn):
        sync_sections_metadata(conn, [
            {"section_id": "sec1", "title": "Keep",
             "source_file": "a.md", "rule_count": 1},
        ])
        sync_sections_metadata(conn, [
            {"section_id": "sec2", "title": "New",
             "source_file": "b.md", "rule_count": 2},
        ])
        count = conn.execute("SELECT COUNT(*) FROM sections_metadata").fetchone()[0]
        assert count == 2


class TestMigrations:
    """Test that _run_migrations adds columns to old-schema databases."""

    def _make_old_db(self, tmp_path, monkeypatch):
        """Create a DB with the pre-migration schema (no confidence/source/last_offset)."""
        import db as db_mod
        import sqlite3

        db_file = tmp_path / "old.db"
        conn = sqlite3.connect(str(db_file))
        conn.executescript("""
            CREATE TABLE rule_references (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                matched_keyword TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE sessions (
                session_id TEXT PRIMARY KEY,
                started_at DATETIME,
                ended_at DATETIME,
                model TEXT,
                task_summary TEXT
            );
            CREATE TABLE rules_metadata (
                rule_id TEXT PRIMARY KEY,
                section_id TEXT NOT NULL,
                title TEXT NOT NULL,
                keywords TEXT,
                source_file TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE sections_metadata (
                section_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                source_file TEXT NOT NULL,
                rule_count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE rule_drafts (
                rule_id TEXT PRIMARY KEY,
                frontmatter_yaml TEXT NOT NULL,
                markdown_body TEXT NOT NULL,
                order_override INTEGER,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE publish_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                rules_changed INTEGER DEFAULT 0,
                snapshot_name TEXT,
                status TEXT NOT NULL,
                error_message TEXT
            );
        """)
        conn.close()
        monkeypatch.setattr(db_mod, "DB_PATH", db_file)
        return db_file

    def test_adds_confidence_column(self, tmp_path, monkeypatch):
        db_file = self._make_old_db(tmp_path, monkeypatch)
        conn = get_db()
        cols = {r[1] for r in conn.execute("PRAGMA table_info(rule_references)").fetchall()}
        assert "confidence" in cols
        conn.close()

    def test_adds_source_column(self, tmp_path, monkeypatch):
        db_file = self._make_old_db(tmp_path, monkeypatch)
        conn = get_db()
        cols = {r[1] for r in conn.execute("PRAGMA table_info(rule_references)").fetchall()}
        assert "source" in cols
        conn.close()

    def test_adds_last_offset_column(self, tmp_path, monkeypatch):
        db_file = self._make_old_db(tmp_path, monkeypatch)
        conn = get_db()
        cols = {r[1] for r in conn.execute("PRAGMA table_info(sessions)").fetchall()}
        assert "last_offset" in cols
        conn.close()
