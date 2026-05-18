"""Tests for hooks/session-logger.py — Session scanning and keyword matching."""

import sys
import json
import importlib
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hooks"))
sl = importlib.import_module("session-logger")

parse_all_rules = sl.parse_all_rules
scan_session = sl.scan_session
find_latest_session = sl.find_latest_session


@pytest.fixture
def rules_dir(tmp_path, monkeypatch):
    """Create a temporary rules directory with sample rule files."""
    rules = tmp_path / "rules"
    rules.mkdir()
    monkeypatch.setattr(sl, "RULES_DIR", rules)
    monkeypatch.setattr(sl, "PROJECT_DIR", tmp_path)
    return rules


def _write_rule(rules_dir, filename, frontmatter, body=""):
    content = f"---\n{frontmatter}\n---\n{body}\n"
    (rules_dir / filename).write_text(content, encoding="utf-8")


class TestLoadKeywordMap:
    def test_loads_keywords(self, rules_dir):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - TDD
      - coverage
""")
        km, _, _ = parse_all_rules()
        assert "tdd" in km
        assert "coverage" in km
        assert km["tdd"][0][0] == "sec1.r1"

    def test_multiple_rules_same_keyword(self, rules_dir):
        _write_rule(rules_dir, "a.md", """
id: sec1
rules:
  - id: sec1.r1
    title: R1
    keywords:
      - test
""")
        _write_rule(rules_dir, "b.md", """
id: sec2
rules:
  - id: sec2.r2
    title: R2
    keywords:
      - test
""")
        km, _, _ = parse_all_rules()
        assert len(km["test"]) == 2

    def test_empty_dir(self, rules_dir):
        km, _, _ = parse_all_rules()
        assert km == {}

    def test_file_without_frontmatter(self, rules_dir):
        (rules_dir / "plain.md").write_text("Just plain text", encoding="utf-8")
        km, _, _ = parse_all_rules()
        assert km == {}


class TestGetRulesMetadata:
    def test_extracts_metadata(self, rules_dir):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - kw1
""")
        _, data, _ = parse_all_rules()
        assert len(data) == 1
        assert data[0]["rule_id"] == "sec1.r1"
        assert data[0]["section_id"] == "sec1"
        assert data[0]["source_file"] == "test.md"
        assert data[0]["keywords"] == ["kw1"]

    def test_multiple_rules_in_section(self, rules_dir):
        _write_rule(rules_dir, "multi.md", """
id: sec1
rules:
  - id: sec1.r1
    title: R1
    keywords: []
  - id: sec1.r2
    title: R2
    keywords: []
""")
        _, data, _ = parse_all_rules()
        assert len(data) == 2


class TestGetSectionsMetadata:
    def test_extracts_section_metadata(self, rules_dir):
        _write_rule(rules_dir, "test.md", """
id: sec1
title: My Section
rules:
  - id: sec1.r1
    title: R1
    keywords: []
  - id: sec1.r2
    title: R2
    keywords: []
""")
        _, _, data = parse_all_rules()
        assert len(data) == 1
        assert data[0]["section_id"] == "sec1"
        assert data[0]["title"] == "My Section"
        assert data[0]["rule_count"] == 2

    def test_skips_no_id(self, rules_dir):
        (rules_dir / "noid.md").write_text("---\ntitle: No ID\n---\nbody\n", encoding="utf-8")
        _, _, data = parse_all_rules()
        assert data == []


class TestScanSession:
    def test_finds_keyword_matches(self):
        km = {"tdd": [("r1", "TDD")], "coverage": [("r1", "coverage")]}
        lines = [
            json.dumps({"type": "assistant", "message": {
                "content": [{"type": "text", "text": "Use TDD to write coverage tests"}]
            }}),
        ]
        session_file = Path("/tmp/test_scan_session.jsonl")
        session_file.write_text("\n".join(lines), encoding="utf-8")
        matches = scan_session(session_file, km)
        assert len(matches) == 2
        rule_ids = {m["rule_id"] for m in matches}
        assert rule_ids == {"r1"}

    def test_case_insensitive(self):
        km = {"tdd": [("r1", "TDD")]}
        lines = [
            json.dumps({"type": "assistant", "message": {
                "content": [{"type": "text", "text": "use tdd approach"}]
            }}),
        ]
        session_file = Path("/tmp/test_scan_ci.jsonl")
        session_file.write_text("\n".join(lines), encoding="utf-8")
        matches = scan_session(session_file, km)
        assert len(matches) == 1

    def test_ignores_non_assistant(self):
        km = {"tdd": [("r1", "TDD")]}
        lines = [
            json.dumps({"type": "user", "message": {"content": "TDD"}}),
        ]
        session_file = Path("/tmp/test_scan_user.jsonl")
        session_file.write_text("\n".join(lines), encoding="utf-8")
        matches = scan_session(session_file, km)
        assert len(matches) == 0

    def test_deduplicates(self):
        km = {"tdd": [("r1", "TDD")]}
        lines = [
            json.dumps({"type": "assistant", "message": {
                "content": [{"type": "text", "text": "TDD"}]
            }}),
            json.dumps({"type": "assistant", "message": {
                "content": [{"type": "text", "text": "More TDD"}]
            }}),
        ]
        session_file = Path("/tmp/test_scan_dedup.jsonl")
        session_file.write_text("\n".join(lines), encoding="utf-8")
        matches = scan_session(session_file, km)
        assert len(matches) == 1

    def test_handles_malformed_json(self):
        km = {"tdd": [("r1", "TDD")]}
        lines = ["not json", json.dumps({"type": "assistant", "message": {"content": [{"type": "text", "text": "TDD"}]}})]
        session_file = Path("/tmp/test_scan_malformed.jsonl")
        session_file.write_text("\n".join(lines), encoding="utf-8")
        matches = scan_session(session_file, km)
        assert len(matches) == 1

    def test_missing_file(self):
        km = {"tdd": [("r1", "TDD")]}
        matches = scan_session(Path("/tmp/nonexistent_abc123.jsonl"), km)
        assert matches == []


class TestFindLatestSession:
    def test_finds_latest(self, tmp_path, monkeypatch):
        projects = tmp_path / "projects"
        proj1 = projects / "proj1"
        proj1.mkdir(parents=True)
        (proj1 / "aaa.jsonl").write_text("old", encoding="utf-8")
        proj2 = projects / "proj2"
        proj2.mkdir(parents=True)
        (proj2 / "bbb.jsonl").write_text("new", encoding="utf-8")
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        result = find_latest_session()
        assert result is not None
        assert result.name == "bbb.jsonl"

    def test_no_projects_dir(self, tmp_path, monkeypatch):
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        result = find_latest_session()
        assert result is None
