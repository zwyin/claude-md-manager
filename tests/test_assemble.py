#!/usr/bin/env python3
"""Unit tests for build/assemble.py"""

import sys
import textwrap
from pathlib import Path
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "build"))
import assemble


# --- Fixtures ---

@pytest.fixture
def rules_dir(tmp_path):
    """Create a temporary rules directory with sample rule files."""
    rules = tmp_path / "rules"
    rules.mkdir()

    (rules / "00_core.md").write_text(textwrap.dedent("""\
        ---
        id: core-principles
        title: 核心原则
        order: 0
        tags: [core]
        rules:
          - id: core-principles.brain
            title: 大脑
            keywords: ["大脑", "brain"]
          - id: core-principles.hands
            title: 手脚
            keywords: ["手脚", "hands"]
        ---

        # 核心原则

        superpowers 是大脑，gstack 是手脚。
    """), encoding="utf-8")

    (rules / "10_triage.md").write_text(textwrap.dedent("""\
        ---
        id: task-triage
        title: 任务分流
        order: 10
        tags: [workflow]
        rules:
          - id: task-triage.readonly
            title: 只读任务
            keywords: ["只读", "分析"]
        ---

        # 任务分流

        ### 只读任务
        - 分析、解释 —— 直接处理。
    """), encoding="utf-8")

    return rules


@pytest.fixture
def history_dir(tmp_path):
    d = tmp_path / "data" / "history"
    d.mkdir(parents=True)
    return d


# --- parse_frontmatter ---

class TestParseFrontmatter:
    def test_basic(self):
        content = "---\nid: foo\norder: 1\n---\nBody text"
        meta, body = assemble.parse_frontmatter(content)
        assert meta["id"] == "foo"
        assert "Body text" in body

    def test_no_frontmatter(self):
        content = "Just plain text"
        meta, body = assemble.parse_frontmatter(content)
        assert meta == {}
        assert body == "Just plain text"

    def test_empty_frontmatter(self):
        content = "---\n---\nBody"
        meta, body = assemble.parse_frontmatter(content)
        assert meta is None or meta == {}
        assert "Body" in body

    def test_unicode(self):
        content = "---\nid: 测试\n---\n中文内容"
        meta, body = assemble.parse_frontmatter(content)
        assert meta["id"] == "测试"
        assert "中文内容" in body


# --- load_rules ---

class TestLoadRules:
    def test_sorted_by_order(self, rules_dir):
        with mock.patch.object(assemble, "RULES_DIR", rules_dir):
            loaded = assemble.load_rules()
        assert len(loaded) == 2
        assert loaded[0][1]["id"] == "core-principles"
        assert loaded[1][1]["id"] == "task-triage"

    def test_empty_dir(self, tmp_path):
        empty = tmp_path / "empty_rules"
        empty.mkdir()
        with mock.patch.object(assemble, "RULES_DIR", empty):
            loaded = assemble.load_rules()
        assert loaded == []


# --- build_output ---

class TestBuildOutput:
    def test_header_present(self):
        rules = [("test.md", {"id": "x"}, "# Hello")]
        output = assemble.build_output(rules)
        assert output.startswith("<!-- Built by claude-md-manager")

    def test_sections_joined(self):
        rules = [
            ("a.md", {"id": "a"}, "# A\nContent A"),
            ("b.md", {"id": "b"}, "# B\nContent B"),
        ]
        output = assemble.build_output(rules)
        assert "# A" in output
        assert "# B" in output
        assert "Content A" in output
        assert "Content B" in output

    def test_empty_body_skipped(self):
        rules = [("a.md", {"id": "a"}, "   \n  \n")]
        output = assemble.build_output(rules)
        # Only header, no body content
        lines = [l for l in output.splitlines() if l.strip()]
        assert len(lines) == 1  # just the header comment


# --- validate_rules ---

class TestValidateRules:
    def test_valid_rules(self, rules_dir):
        with mock.patch.object(assemble, "RULES_DIR", rules_dir):
            loaded = assemble.load_rules()
        errors = assemble.validate_rules(loaded)
        assert errors == []

    def test_missing_id(self, tmp_path):
        rules = tmp_path / "rules"
        rules.mkdir()
        (rules / "bad.md").write_text("---\ntitle: No ID\n---\nBody")
        with mock.patch.object(assemble, "RULES_DIR", rules):
            loaded = assemble.load_rules()
        errors = assemble.validate_rules(loaded)
        assert any("missing 'id'" in e for e in errors)

    def test_duplicate_id(self, tmp_path):
        rules = tmp_path / "rules"
        rules.mkdir()
        for name in ["a.md", "b.md"]:
            (rules / name).write_text(f"---\nid: same-id\norder: 1\n---\nBody {name}")
        with mock.patch.object(assemble, "RULES_DIR", rules):
            loaded = assemble.load_rules()
        errors = assemble.validate_rules(loaded)
        assert any("duplicate id" in e for e in errors)

    def test_subrule_id_prefix(self, tmp_path):
        rules = tmp_path / "rules"
        rules.mkdir()
        (rules / "x.md").write_text(textwrap.dedent("""\
            ---
            id: my-section
            order: 1
            rules:
              - id: wrong-prefix.rule1
                title: Bad
                keywords: ["test"]
            ---
            Body
        """))
        with mock.patch.object(assemble, "RULES_DIR", rules):
            loaded = assemble.load_rules()
        errors = assemble.validate_rules(loaded)
        assert any("should start with" in e for e in errors)

    def test_empty_body(self, tmp_path):
        rules = tmp_path / "rules"
        rules.mkdir()
        (rules / "x.md").write_text("---\nid: x\norder: 1\n---\n\n")
        with mock.patch.object(assemble, "RULES_DIR", rules):
            loaded = assemble.load_rules()
        errors = assemble.validate_rules(loaded)
        assert any("empty body" in e for e in errors)

    def test_no_keywords(self, tmp_path):
        rules = tmp_path / "rules"
        rules.mkdir()
        (rules / "x.md").write_text(textwrap.dedent("""\
            ---
            id: x
            order: 1
            rules:
              - id: x.sub
                title: Sub
                keywords: []
            ---
            Body
        """))
        with mock.patch.object(assemble, "RULES_DIR", rules):
            loaded = assemble.load_rules()
        errors = assemble.validate_rules(loaded)
        assert any("no keywords" in e for e in errors)


# --- save_snapshot / list_snapshots ---

class TestSnapshots:
    def test_save_and_list(self, history_dir):
        with mock.patch.object(assemble, "HISTORY_DIR", history_dir):
            name = assemble.save_snapshot("# Test snapshot content\n")
            snapshots = assemble.list_snapshots()
        assert name in snapshots
        assert (history_dir / name).read_text() == "# Test snapshot content\n"

    def test_list_empty(self, tmp_path):
        empty = tmp_path / "empty_history"
        empty.mkdir()
        with mock.patch.object(assemble, "HISTORY_DIR", empty):
            assert assemble.list_snapshots() == []

    def test_sorted_newest_first(self, history_dir):
        # Write files with distinct timestamps manually
        for name in ["2026-01-01T10-00-00.md", "2026-01-01T11-00-00.md", "2026-01-01T12-00-00.md"]:
            (history_dir / name).write_text("content", encoding="utf-8")
        with mock.patch.object(assemble, "HISTORY_DIR", history_dir):
            snapshots = assemble.list_snapshots()
        assert len(snapshots) == 3
        assert snapshots == sorted(snapshots, reverse=True)


# --- rollback ---

class TestRollback:
    def test_rollback_exact(self, history_dir, tmp_path):
        output = tmp_path / "CLAUDE.md"
        with mock.patch.object(assemble, "HISTORY_DIR", history_dir), \
             mock.patch.object(assemble, "OUTPUT_PATH", output):
            name = assemble.save_snapshot("Rollback content")
            ts = name.replace(".md", "")
            result = assemble.rollback(ts)
        assert result is True
        assert output.read_text() == "Rollback content"

    def test_rollback_not_found(self, history_dir, tmp_path):
        output = tmp_path / "CLAUDE.md"
        with mock.patch.object(assemble, "HISTORY_DIR", history_dir), \
             mock.patch.object(assemble, "OUTPUT_PATH", output):
            result = assemble.rollback("nonexistent-timestamp")
        assert result is False
