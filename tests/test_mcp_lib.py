"""Tests for mcp_lib.py — the business logic layer of the MCP server."""

import sys
from pathlib import Path

import pytest

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import mcp_lib


@pytest.fixture
def rules_dir(tmp_path, monkeypatch):
    """Create a temporary rules directory with sample rule files."""
    rules = tmp_path / "rules"
    rules.mkdir()

    (rules / "00_intro.md").write_text(
        "---\nid: intro\ntitle: Introduction\norder: 0\n---\nIntro body here.\n",
        encoding="utf-8",
    )
    (rules / "10_core.md").write_text(
        "---\nid: core\ntitle: Core Rules\norder: 10\n---\nCore body here.\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(mcp_lib, "RULES_DIR", rules)
    return rules


@pytest.fixture
def db_with_drafts(tmp_path, monkeypatch, rules_dir):
    """Set up a temporary DB with the rule_drafts table."""
    db_path = tmp_path / "data" / "usage.db"
    db_path.parent.mkdir(parents=True)
    monkeypatch.setattr(mcp_lib, "DB_PATH", db_path)

    # Patch the db module that mcp_lib imported get_db from
    # mcp_lib does: from db import get_db  (via sys.path.insert to hooks/)
    import db as db_mod
    monkeypatch.setattr(db_mod, "DB_PATH", db_path)

    # Initialize schema
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    conn.executescript("""
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
    """)
    conn.close()
    return db_path


class TestListRules:
    def test_lists_all_rules(self, rules_dir):
        rules = mcp_lib.list_rules_from_disk()
        assert len(rules) == 2
        ids = {r["rule_id"] for r in rules}
        assert ids == {"intro", "core"}

    def test_sorted_by_order(self, rules_dir):
        rules = mcp_lib.list_rules_from_disk()
        assert rules[0]["rule_id"] == "intro"
        assert rules[1]["rule_id"] == "core"

    def test_includes_metadata(self, rules_dir):
        rules = mcp_lib.list_rules_from_disk()
        intro = rules[0]
        assert intro["title"] == "Introduction"
        assert intro["order"] == 0
        assert intro["has_draft"] is False

    def test_shows_draft_status(self, rules_dir, db_with_drafts):
        mcp_lib.save_draft_to_db("intro", "id: intro\ntitle: Intro\norder: 0", "draft body")
        rules = mcp_lib.list_rules_from_disk()
        intro = next(r for r in rules if r["rule_id"] == "intro")
        assert intro["has_draft"] is True


class TestReadRuleFile:
    def test_returns_rule_content(self, rules_dir):
        rule = mcp_lib.read_rule_file("core")
        assert rule is not None
        assert rule["rule_id"] == "core"
        assert rule["title"] == "Core Rules"
        assert "Core body" in rule["markdown_body"]

    def test_returns_none_for_unknown(self, rules_dir):
        assert mcp_lib.read_rule_file("nonexistent") is None


class TestDraftCRUD:
    def test_save_and_get_draft(self, db_with_drafts):
        draft = mcp_lib.save_draft_to_db("core", "id: core\ntitle: Core\norder: 10", "new body", 5)
        assert draft is not None
        assert draft["frontmatter_yaml"] == "id: core\ntitle: Core\norder: 10"
        assert draft["markdown_body"] == "new body"
        assert draft["order_override"] == 5

    def test_get_nonexistent_draft(self, db_with_drafts):
        assert mcp_lib.get_draft_from_db("nonexistent") is None

    def test_delete_draft(self, db_with_drafts):
        mcp_lib.save_draft_to_db("core", "id: core", "body")
        assert mcp_lib.delete_draft_from_db("core") is True
        assert mcp_lib.get_draft_from_db("core") is None

    def test_delete_nonexistent_draft(self, db_with_drafts):
        assert mcp_lib.delete_draft_from_db("nonexistent") is False

    def test_update_existing_draft(self, db_with_drafts):
        mcp_lib.save_draft_to_db("core", "yaml v1", "body v1")
        mcp_lib.save_draft_to_db("core", "yaml v2", "body v2")
        draft = mcp_lib.get_draft_from_db("core")
        assert draft["frontmatter_yaml"] == "yaml v2"
        assert draft["markdown_body"] == "body v2"


class TestValidate:
    def test_valid_drafts_pass(self, db_with_drafts):
        mcp_lib.save_draft_to_db("core", "id: core\ntitle: Core\norder: 10", "body")
        results = mcp_lib.validate_all_drafts()
        assert len(results) == 1
        assert results[0]["errors"] == []

    def test_missing_fields_reported(self, db_with_drafts):
        mcp_lib.save_draft_to_db("core", "just some text", "body")
        results = mcp_lib.validate_all_drafts()
        assert len(results) == 1
        assert "missing 'id'" in results[0]["errors"]
        assert "missing 'title'" in results[0]["errors"]
        assert "missing 'order'" in results[0]["errors"]

    def test_no_drafts_passes(self, db_with_drafts):
        results = mcp_lib.validate_all_drafts()
        assert results == []


class TestPublish:
    def test_no_drafts_returns_zero(self, db_with_drafts, rules_dir, monkeypatch):
        result = mcp_lib.publish_all_drafts()
        assert result["rules_changed"] == 0

    def test_publish_writes_to_disk(self, db_with_drafts, rules_dir, monkeypatch):
        history_dir = rules_dir.parent / "data" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history_dir)

        # Create a fake CLAUDE.md so _force_snapshot has something to back up
        output = rules_dir.parent / "CLAUDE.md"
        output.write_text("# old content", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", output)

        mcp_lib.save_draft_to_db("core", "id: core\ntitle: Updated\norder: 10", "updated body")

        # Mock assemble.py call
        import subprocess
        original_run = subprocess.run
        def mock_run(cmd, **kwargs):
            if "assemble.py" in " ".join(cmd):
                return subprocess.CompletedProcess(cmd, 0, "Built CLAUDE.md at /some/path\n", "")
            return original_run(cmd, **kwargs)
        monkeypatch.setattr(subprocess, "run", mock_run)

        result = mcp_lib.publish_all_drafts()
        assert result["rules_changed"] == 1
        assert result["snapshot_name"] is not None
        assert result.get("error") is None

        # Verify pre-publish snapshot was created
        snapshots = list(history_dir.glob("*.md"))
        assert len(snapshots) >= 1
        assert snapshots[0].read_text(encoding="utf-8") == "# old content"

        # Verify disk content updated
        rule = mcp_lib.read_rule_file("core")
        assert rule["title"] == "Updated"
        assert "updated body" in rule["markdown_body"]

    def test_publish_clears_drafts(self, db_with_drafts, rules_dir, monkeypatch):
        history_dir = rules_dir.parent / "data" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history_dir)

        mcp_lib.save_draft_to_db("core", "id: core\ntitle: Core\norder: 10", "body")

        import subprocess
        monkeypatch.setattr(subprocess, "run", lambda *a, **kw: subprocess.CompletedProcess([], 0, "Built CLAUDE.md\n", ""))

        mcp_lib.publish_all_drafts()
        assert mcp_lib.get_draft_from_db("core") is None

    def test_creates_new_rule_file_for_unknown_id(self, db_with_drafts, rules_dir, monkeypatch):
        """Regression: drafts for new rule_ids used to be silently skipped (rules_changed=0).
        Fix: create rules/<NN>_<sanitized_title>.md from the draft instead of dropping.
        """
        mcp_lib.save_draft_to_db(
            "anti-rationalization",
            "id: anti-rationalization\ntitle: 反合理化对照表\norder: 65",
            "rule body",
        )
        import subprocess
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **kw: subprocess.CompletedProcess([], 0, "Built CLAUDE.md\n", ""),
        )

        result = mcp_lib.publish_all_drafts()
        assert result["rules_changed"] == 1

        new_file = rules_dir / "65_反合理化对照表.md"
        assert new_file.exists()
        rule = mcp_lib.read_rule_file("anti-rationalization")
        assert rule is not None
        assert rule["order"] == 65

    def test_order_override_applied(self, db_with_drafts, rules_dir, monkeypatch):
        history_dir = rules_dir.parent / "data" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history_dir)

        mcp_lib.save_draft_to_db("core", "id: core\ntitle: Core\norder: 10", "body", 5)

        import subprocess
        monkeypatch.setattr(subprocess, "run", lambda *a, **kw: subprocess.CompletedProcess([], 0, "Built CLAUDE.md\n", ""))

        mcp_lib.publish_all_drafts()
        rule = mcp_lib.read_rule_file("core")
        assert rule["order"] == 5


class TestPublishNewRule:
    """Cover edge cases for draft-with-new-rule_id → file creation in publish_all_drafts.

    See TestPublish.test_creates_new_rule_file_for_unknown_id for the core fix.
    """

    def test_filename_sanitizes_special_chars(self, db_with_drafts, rules_dir, monkeypatch):
        mcp_lib.save_draft_to_db(
            "engineering-principles",
            "id: engineering-principles\ntitle: 工程原则速查（Google）\norder: 70",
            "body",
        )
        import subprocess
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **kw: subprocess.CompletedProcess([], 0, "Built CLAUDE.md\n", ""),
        )

        mcp_lib.publish_all_drafts()

        candidates = list(rules_dir.glob("70_*"))
        assert len(candidates) == 1
        name = candidates[0].name
        # Parens and other non-word/CJK chars sanitized to hyphens, then stripped
        assert "（" not in name
        assert "）" not in name
        assert name.endswith("Google.md")

    def test_filename_collision_appends_suffix(self, db_with_drafts, rules_dir, monkeypatch):
        # Pre-existing file with same order + title; new draft for same order+title triggers collision
        (rules_dir / "65_Anti-Rationalization.md").write_text(
            "---\nid: existing\ntitle: Anti-Rationalization\norder: 65\n---\nold body\n",
            encoding="utf-8",
        )
        mcp_lib.save_draft_to_db(
            "new-rule",
            "id: new-rule\ntitle: Anti-Rationalization\norder: 65",
            "body",
        )
        import subprocess
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **kw: subprocess.CompletedProcess([], 0, "Built CLAUDE.md\n", ""),
        )

        mcp_lib.publish_all_drafts()

        # Old file with different rule_id is untouched
        assert (rules_dir / "65_Anti-Rationalization.md").exists()
        # New file gets -2 suffix (collision)
        assert (rules_dir / "65_Anti-Rationalization-2.md").exists()

    def test_new_rule_respects_order_override(self, db_with_drafts, rules_dir, monkeypatch):
        mcp_lib.save_draft_to_db(
            "new-thing",
            "id: new-thing\ntitle: New Thing\norder: 70",
            "body",
            order_override=68,
        )
        import subprocess
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **kw: subprocess.CompletedProcess([], 0, "Built CLAUDE.md\n", ""),
        )

        mcp_lib.publish_all_drafts()

        assert (rules_dir / "68_New-Thing.md").exists()
        rule = mcp_lib.read_rule_file("new-thing")
        assert rule["order"] == 68

    def test_publish_handles_mixed_existing_and_new_rules(
        self, db_with_drafts, rules_dir, monkeypatch
    ):
        # Existing rule gets updated in place
        mcp_lib.save_draft_to_db(
            "intro",
            "id: intro\ntitle: Updated Intro\norder: 0",
            "new body",
        )
        # New rule gets created from scratch
        mcp_lib.save_draft_to_db(
            "extra-rule",
            "id: extra-rule\ntitle: Extra Rule\norder: 50",
            "extra body",
        )
        import subprocess
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **kw: subprocess.CompletedProcess([], 0, "Built CLAUDE.md\n", ""),
        )

        result = mcp_lib.publish_all_drafts()
        assert result["rules_changed"] == 2

        # Existing rule updated in place
        intro = mcp_lib.read_rule_file("intro")
        assert intro["title"] == "Updated Intro"
        # New rule created
        assert (rules_dir / "50_Extra-Rule.md").exists()


class TestPublishErrors:
    def test_assemble_failure_returns_error(self, db_with_drafts, rules_dir, monkeypatch):
        history_dir = rules_dir.parent / "data" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history_dir)
        output = rules_dir.parent / "CLAUDE.md"
        output.write_text("# old content", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", output)

        mcp_lib.save_draft_to_db("core", "id: core\ntitle: Core\norder: 10", "body")

        import subprocess
        monkeypatch.setattr(subprocess, "run", lambda *a, **kw: subprocess.CompletedProcess([], 1, "", "assemble error"))

        result = mcp_lib.publish_all_drafts()
        assert result["error"] == "assemble error"
        assert result["snapshot_name"] is not None  # pre-publish snapshot still created
        # Drafts NOT cleared on failure
        assert mcp_lib.get_draft_from_db("core") is not None

    def test_assemble_timeout_returns_error(self, db_with_drafts, rules_dir, monkeypatch):
        history_dir = rules_dir.parent / "data" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history_dir)
        output = rules_dir.parent / "CLAUDE.md"
        output.write_text("# old content", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", output)

        mcp_lib.save_draft_to_db("core", "id: core\ntitle: Core\norder: 10", "body")

        import subprocess
        def timeout_run(*a, **kw):
            raise subprocess.TimeoutExpired([], 30)
        monkeypatch.setattr(subprocess, "run", timeout_run)

        result = mcp_lib.publish_all_drafts()
        assert result["error"] == "assemble.py timed out"

    def test_assemble_exception_returns_error(self, db_with_drafts, rules_dir, monkeypatch):
        history_dir = rules_dir.parent / "data" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history_dir)
        output = rules_dir.parent / "CLAUDE.md"
        output.write_text("# old content", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", output)

        mcp_lib.save_draft_to_db("core", "id: core\ntitle: Core\norder: 10", "body")

        import subprocess
        monkeypatch.setattr(subprocess, "run", lambda *a, **kw: (_ for _ in ()).throw(OSError("boom")))

        result = mcp_lib.publish_all_drafts()
        assert "boom" in result["error"]


class TestRecordCitation:
    """Tests for the Phase 2 record_citation MCP tool."""

    @pytest.fixture
    def db_with_refs(self, tmp_path, monkeypatch):
        db_path = tmp_path / "data" / "usage.db"
        db_path.parent.mkdir(parents=True)
        monkeypatch.setattr(mcp_lib, "DB_PATH", db_path)
        import db as db_mod
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)
        return db_path

    def test_records_citation(self, db_with_refs):
        result = mcp_lib.record_citation("core-principles", "手术刀原则")
        assert result["recorded"] is True
        assert result["rule_id"] == "core-principles"
        assert result["keyword"] == "手术刀原则"
        assert result["session_id"].startswith("mcp-")

    def test_custom_session_id(self, db_with_refs):
        result = mcp_lib.record_citation("core", "hello", session_id="sess-123")
        assert result["session_id"] == "sess-123"

    def test_citation_in_db(self, db_with_refs):
        import sqlite3
        db_path = db_with_refs
        mcp_lib.record_citation("core", "hello", session_id="test-sess")
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM rule_references WHERE session_id = 'test-sess'").fetchone()
        conn.close()
        assert row is not None
        assert row["rule_id"] == "core"
        assert row["matched_keyword"] == "hello"
        assert row["confidence"] == "high"
        assert row["source"] == "mcp_tool"

    def test_confidence_merge_upgrades(self, db_with_refs):
        """MCP tool (high) should upgrade a hook_posttool (low) match."""
        import sqlite3
        db_path = db_with_refs

        # First record a low-confidence match via hook
        import db as db_mod
        conn = db_mod.get_db()
        db_mod.record_references(conn, "merge-sess", [{
            "rule_id": "core",
            "keyword": "hello",
            "confidence": "low",
        }], source="hook_posttool")
        conn.close()

        # Now record via MCP tool (high confidence)
        mcp_lib.record_citation("core", "hello", session_id="merge-sess")

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM rule_references WHERE session_id = 'merge-sess'").fetchone()
        conn.close()
        assert row["confidence"] == "high"
        assert row["source"] == "mcp_tool"

    def test_confidence_no_downgrade(self, db_with_refs):
        """A low-confidence match should not downgrade an existing high-confidence one."""
        import sqlite3
        db_path = db_with_refs

        # First record high via MCP
        mcp_lib.record_citation("core", "hello", session_id="downgrade-sess")

        # Then try recording low via hook
        import db as db_mod
        conn = db_mod.get_db()
        db_mod.record_references(conn, "downgrade-sess", [{
            "rule_id": "core",
            "keyword": "hello",
            "confidence": "low",
        }], source="hook_posttool")
        conn.close()

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM rule_references WHERE session_id = 'downgrade-sess'").fetchone()
        conn.close()
        assert row["confidence"] == "high"
        assert row["source"] == "mcp_tool"


class TestParseFrontmatter:
    def test_no_frontmatter(self):
        meta, yaml_str, body = mcp_lib.parse_frontmatter("just plain text")
        assert meta == {}
        assert yaml_str == ""
        assert body == "just plain text"


class TestForceSnapshot:
    def test_creates_snapshot(self, tmp_path, monkeypatch):
        output = tmp_path / "CLAUDE.md"
        output.write_text("# content", encoding="utf-8")
        history = tmp_path / "history"
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", output)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history)

        name = mcp_lib._force_snapshot()
        assert name is not None
        assert name.endswith(".md")
        assert (history / name).read_text(encoding="utf-8") == "# content"

    def test_returns_none_when_no_file(self, tmp_path, monkeypatch):
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", tmp_path / "nonexistent.md")
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", tmp_path / "history")
        assert mcp_lib._force_snapshot() is None

    def test_skips_identical_content(self, tmp_path, monkeypatch):
        output = tmp_path / "CLAUDE.md"
        output.write_text("# same content", encoding="utf-8")
        history = tmp_path / "history"
        history.mkdir()
        (history / "2026-01-01T00-00-00.md").write_text("# same content", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", output)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history)
        assert mcp_lib._force_snapshot() is None

    def test_creates_snapshot_when_content_differs(self, tmp_path, monkeypatch):
        output = tmp_path / "CLAUDE.md"
        output.write_text("# new content", encoding="utf-8")
        history = tmp_path / "history"
        history.mkdir()
        (history / "2026-01-01T00-00-00.md").write_text("# old content", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", output)
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", history)
        name = mcp_lib._force_snapshot()
        assert name is not None
        assert (history / name).read_text(encoding="utf-8") == "# new content"


class TestReadClaudeMd:
    def test_returns_content(self, tmp_path, monkeypatch):
        f = tmp_path / "CLAUDE.md"
        f.write_text("# My CLAUDE.md\nSome content", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", f)
        assert mcp_lib.read_claude_md() == "# My CLAUDE.md\nSome content"

    def test_returns_none_when_missing(self, tmp_path, monkeypatch):
        monkeypatch.setattr(mcp_lib, "OUTPUT_PATH", tmp_path / "nonexistent.md")
        assert mcp_lib.read_claude_md() is None


class TestPublishHistory:
    def test_returns_empty_when_no_history(self, db_with_drafts):
        history = mcp_lib.get_publish_history_from_db()
        assert history == []

    def test_returns_history(self, db_with_drafts):
        import sqlite3
        conn = sqlite3.connect(str(mcp_lib.DB_PATH))
        conn.execute(
            "INSERT INTO publish_history (published_at, rules_changed, status) VALUES ('2026-01-01', 3, 'success')"
        )
        conn.commit()
        conn.close()

        history = mcp_lib.get_publish_history_from_db()
        assert len(history) == 1
        assert history[0]["rules_changed"] == 3


class TestListSnapshots:
    def test_returns_empty_when_no_dir(self, tmp_path, monkeypatch):
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", tmp_path / "nope")
        assert mcp_lib.list_snapshot_files() == []

    def test_lists_snapshots(self, tmp_path, monkeypatch):
        hist = tmp_path / "history"
        hist.mkdir()
        (hist / "2026-01-01T10-00-00.md").write_text("content 1", encoding="utf-8")
        (hist / "2026-01-02T10-00-00.md").write_text("content 2", encoding="utf-8")
        monkeypatch.setattr(mcp_lib, "HISTORY_DIR", hist)

        snaps = mcp_lib.list_snapshot_files()
        assert len(snaps) == 2
        assert snaps[0]["filename"] == "2026-01-02T10-00-00.md"  # newest first
