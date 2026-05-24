"""Tests for hooks/session-logger.py — Session scanning and keyword matching."""

import sys
import json
import importlib
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hooks"))
import db as db_mod
sl = importlib.import_module("session-logger")

parse_all_rules = sl.parse_all_rules
scan_session = sl.scan_session
scan_last_message = sl.scan_last_message
find_latest_session = sl.find_latest_session
extract_session_metadata = sl.extract_session_metadata
_build_pattern = sl._build_pattern
_classify_confidence = sl._classify_confidence
main = sl.main


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


def _make_jsonl(path, lines):
    """Write JSONL entries to a file."""
    path.write_text("\n".join(lines), encoding="utf-8")


def _assistant_msg(text):
    return json.dumps({"type": "assistant", "message": {
        "content": [{"type": "text", "text": text}]
    }})


class TestBuildPattern:
    """Tests for the _build_pattern keyword-type-aware regex builder."""

    def test_english_word_boundary(self):
        pat = _build_pattern("ship")
        assert pat.search("the ship sailed")
        assert not pat.search("relationship")

    def test_english_case_insensitive(self):
        pat = _build_pattern("TDD")
        assert pat.search("use tdd approach")
        assert pat.search("TDD is great")

    def test_cjk_allows_cjk_neighbors(self):
        pat = _build_pattern("测试")
        assert pat.search("关于测试的内容")
        assert pat.search("运行测试后")

    def test_cjk_rejects_ascii_alnum_prefix(self):
        pat = _build_pattern("测试")
        assert not pat.search("abc测试")

    def test_cjk_rejects_ascii_alnum_suffix(self):
        pat = _build_pattern("测试")
        assert not pat.search("测试123")

    def test_cjk_matches_at_string_boundaries(self):
        pat = _build_pattern("测试")
        assert pat.search("测试开始")
        assert pat.search("结束测试")

    def test_multi_word_phrase(self):
        pat = _build_pattern("rm -rf")
        assert pat.search("run rm -rf /")
        assert pat.search("sudo rm -rf /tmp")

    def test_hyphenated_phrase(self):
        pat = _build_pattern("force-push")
        assert pat.search("do force-push now")

    def test_short_english_word(self):
        pat = _build_pattern("QA")
        assert pat.search("run QA tests")
        assert not pat.search("squA-re")

    def test_cjk_with_mixed(self):
        pat = _build_pattern("QA报告")
        assert pat.search("生成QA报告")
        assert not pat.search("生成QA报告2")  # digit after is rejected by lookbehind for CJK... actually QA报告 ends with CJK, so (?![a-zA-Z0-9]) only checks after 报告

    def test_data_not_in_database(self):
        pat = _build_pattern("data")
        assert pat.search("the data is")
        assert not pat.search("database")
        assert not pat.search("metadata")


class TestClassifyConfidence:
    def test_medium_phrase(self):
        assert _classify_confidence("rm -rf") == "medium"  # 6 chars, >= 4 < 10

    def test_short_cjk_low(self):
        assert _classify_confidence("测试") == "low"  # 2 chars, < 4

    def test_short_keyword_low(self):
        assert _classify_confidence("QA") == "low"

    def test_medium_english(self):
        assert _classify_confidence("coverage") == "medium"

    def test_high_long_phrase(self):
        assert _classify_confidence("git reset --hard") == "high"  # 16 chars


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
        pm, _, _ = parse_all_rules()
        assert "tdd" in pm
        assert "coverage" in pm
        pattern, rule_pairs = pm["tdd"]
        assert rule_pairs[0][0] == "sec1.r1"

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
        pm, _, _ = parse_all_rules()
        pattern, rule_pairs = pm["test"]
        assert len(rule_pairs) == 2

    def test_empty_dir(self, rules_dir):
        pm, _, _ = parse_all_rules()
        assert pm == {}

    def test_file_without_frontmatter(self, rules_dir):
        (rules_dir / "plain.md").write_text("Just plain text", encoding="utf-8")
        pm, _, _ = parse_all_rules()
        assert pm == {}


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
    def _build_pm(self, kw_pairs):
        """Build a pattern_map from [(keyword, [(rule_id, original_kw)])] pairs."""
        pm = {}
        for kw, pairs in kw_pairs.items():
            pm[kw.lower()] = (_build_pattern(kw), pairs)
        return pm

    def test_finds_keyword_matches(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")], "coverage": [("r1", "coverage")]})
        session_file = Path("/tmp/test_scan_session.jsonl")
        _make_jsonl(session_file, [_assistant_msg("Use TDD to write coverage tests")])
        matches, last = scan_session(session_file, pm)
        assert len(matches) == 2
        assert {m["rule_id"] for m in matches} == {"r1"}

    def test_case_insensitive(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")]})
        session_file = Path("/tmp/test_scan_ci.jsonl")
        _make_jsonl(session_file, [_assistant_msg("use tdd approach")])
        matches, last = scan_session(session_file, pm)
        assert len(matches) == 1

    def test_ignores_non_assistant(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")]})
        session_file = Path("/tmp/test_scan_user.jsonl")
        _make_jsonl(session_file, [json.dumps({"type": "user", "message": {"content": "TDD"}})])
        matches, last = scan_session(session_file, pm)
        assert len(matches) == 0

    def test_deduplicates(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")]})
        session_file = Path("/tmp/test_scan_dedup.jsonl")
        _make_jsonl(session_file, [
            _assistant_msg("TDD"),
            _assistant_msg("More TDD"),
        ])
        matches, last = scan_session(session_file, pm)
        assert len(matches) == 1

    def test_handles_malformed_json(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")]})
        session_file = Path("/tmp/test_scan_malformed.jsonl")
        _make_jsonl(session_file, ["not json", _assistant_msg("TDD")])
        matches, last = scan_session(session_file, pm)
        assert len(matches) == 1

    def test_missing_file(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")]})
        matches, last = scan_session(Path("/tmp/nonexistent_abc123.jsonl"), pm)
        assert matches == []

    def test_returns_last_line_scanned(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")]})
        session_file = Path("/tmp/test_scan_lastline.jsonl")
        _make_jsonl(session_file, [
            _assistant_msg("TDD"),
            _assistant_msg("no match"),
        ])
        matches, last = scan_session(session_file, pm)
        assert last == 1

    def test_incremental_skips_lines(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")], "coverage": [("r1", "coverage")]})
        session_file = Path("/tmp/test_scan_incr.jsonl")
        _make_jsonl(session_file, [
            _assistant_msg("TDD"),       # line 0 — should be skipped
            _assistant_msg("coverage"),  # line 1 — should be found
        ])
        matches, last = scan_session(session_file, pm, start_line=1)
        assert len(matches) == 1
        assert matches[0]["keyword"] == "coverage"

    def test_incremental_no_overlap(self):
        pm = self._build_pm({"TDD": [("r1", "TDD")]})
        session_file = Path("/tmp/test_scan_nooverlap.jsonl")
        _make_jsonl(session_file, [
            _assistant_msg("TDD"),       # line 0
            _assistant_msg("no match"),  # line 1
        ])
        matches1, last1 = scan_session(session_file, pm, start_line=0)
        assert len(matches1) == 1
        matches2, last2 = scan_session(session_file, pm, start_line=last1 + 1)
        assert len(matches2) == 0


class TestScanSessionWordBoundary:
    """Tests for the improved word-boundary matching."""

    def _build_pm(self, kw, rule_id="r1"):
        return {kw.lower(): (_build_pattern(kw), [(rule_id, kw)])}

    def test_ship_not_in_relationship(self):
        pm = self._build_pm("ship")
        f = Path("/tmp/test_ship.jsonl")
        _make_jsonl(f, [_assistant_msg("a long relationship")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 0

    def test_ship_standalone(self):
        pm = self._build_pm("ship")
        f = Path("/tmp/test_ship2.jsonl")
        _make_jsonl(f, [_assistant_msg("deploy the ship")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1

    def test_data_not_in_database(self):
        pm = self._build_pm("data")
        f = Path("/tmp/test_data.jsonl")
        _make_jsonl(f, [_assistant_msg("check the database")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 0

    def test_cjk_in_chinese_context(self):
        pm = self._build_pm("测试")
        f = Path("/tmp/test_cjk.jsonl")
        _make_jsonl(f, [_assistant_msg("我需要测试一下")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1

    def test_cjk_between_chinese(self):
        pm = self._build_pm("分析")
        f = Path("/tmp/test_cjk2.jsonl")
        _make_jsonl(f, [_assistant_msg("先进行分析再处理")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1

    def test_plan_not_in_replace(self):
        pm = self._build_pm("plan")
        f = Path("/tmp/test_plan.jsonl")
        _make_jsonl(f, [_assistant_msg("we should replace the code")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 0

    def test_plan_standalone(self):
        pm = self._build_pm("plan")
        f = Path("/tmp/test_plan2.jsonl")
        _make_jsonl(f, [_assistant_msg("make a plan first")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1

    def test_rm_rf_phrase(self):
        pm = self._build_pm("rm -rf")
        f = Path("/tmp/test_rmrf.jsonl")
        _make_jsonl(f, [_assistant_msg("sudo rm -rf /tmp")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1

    def test_browse_not_browser(self):
        pm = self._build_pm("browse")
        f = Path("/tmp/test_browse.jsonl")
        _make_jsonl(f, [_assistant_msg("open the browser")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 0

    def test_browse_standalone(self):
        pm = self._build_pm("browse")
        f = Path("/tmp/test_browse2.jsonl")
        _make_jsonl(f, [_assistant_msg("browse the files")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1

    def test_confidence_scoring(self):
        pm = self._build_pm("git reset --hard")
        f = Path("/tmp/test_conf.jsonl")
        _make_jsonl(f, [_assistant_msg("git reset --hard origin/main")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1
        assert matches[0]["confidence"] == "high"


class TestScanSessionEdgeCases:
    def test_content_as_string(self):
        pm = {"hello": (_build_pattern("hello"), [("r1", "hello")])}
        f = Path("/tmp/test_scan_str.jsonl")
        _make_jsonl(f, [json.dumps({"type": "assistant", "message": {"content": "say hello world"}})])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 1

    def test_empty_text_block(self):
        pm = {"hello": (_build_pattern("hello"), [("r1", "hello")])}
        f = Path("/tmp/test_scan_empty.jsonl")
        _make_jsonl(f, [_assistant_msg("   ")])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 0

    def test_non_dict_content_block(self):
        pm = {"hello": (_build_pattern("hello"), [("r1", "hello")])}
        f = Path("/tmp/test_scan_nondict.jsonl")
        _make_jsonl(f, [json.dumps({"type": "assistant", "message": {
            "content": [{"type": "image", "url": "http://example.com"}]
        }})])
        matches, _ = scan_session(f, pm)
        assert len(matches) == 0


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

    def test_skips_old_files(self, tmp_path, monkeypatch):
        projects = tmp_path / "projects"
        proj = projects / "proj"
        proj.mkdir(parents=True)
        old_file = proj / "old.jsonl"
        old_file.write_text("old", encoding="utf-8")
        import os
        old_mtime = old_file.stat().st_mtime - 7200
        os.utime(old_file, (old_mtime, old_mtime))
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        result = find_latest_session()
        assert result is None

    def test_skips_non_dir_entries(self, tmp_path, monkeypatch):
        projects = tmp_path / "projects"
        projects.mkdir(parents=True)
        (projects / "not_a_dir.txt").write_text("file", encoding="utf-8")
        proj = projects / "proj"
        proj.mkdir()
        (proj / "session.jsonl").write_text("data", encoding="utf-8")
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        result = find_latest_session()
        assert result is not None
        assert result.name == "session.jsonl"

    def test_skips_permission_error(self, tmp_path, monkeypatch):
        projects = tmp_path / "projects"
        proj = projects / "proj"
        proj.mkdir(parents=True)
        (proj / "session.jsonl").write_text("data", encoding="utf-8")
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        original_glob = Path.glob

        def patched_glob(self, pattern):
            if "proj" in str(self):
                raise PermissionError("denied")
            return original_glob(self, pattern)

        monkeypatch.setattr(Path, "glob", patched_glob)
        result = find_latest_session()
        assert result is None

    def test_prefers_recent_over_old(self, tmp_path, monkeypatch):
        projects = tmp_path / "projects"
        proj = projects / "proj"
        proj.mkdir(parents=True)
        old_file = proj / "old.jsonl"
        old_file.write_text("old", encoding="utf-8")
        import os
        old_mtime = old_file.stat().st_mtime - 7200
        os.utime(old_file, (old_mtime, old_mtime))
        new_file = proj / "new.jsonl"
        new_file.write_text("new", encoding="utf-8")
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        result = find_latest_session()
        assert result is not None
        assert result.name == "new.jsonl"


class TestMainSyncMetadata:
    def test_sync_metadata(self, rules_dir, tmp_path, monkeypatch, capsys):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - hello
""")
        db_path = tmp_path / "test_sync.db"
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)
        monkeypatch.setattr(sys, "argv", ["session-logger.py", "--sync-metadata"])

        main()
        captured = capsys.readouterr()
        assert "Synced 1 rules, 1 sections" in captured.out

    def test_no_session_found(self, rules_dir, tmp_path, monkeypatch, capsys):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - hello
""")
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path / "nonexistent")
        monkeypatch.setattr(sys, "argv", ["session-logger.py"])

        main()
        captured = capsys.readouterr()
        assert "No session file found" in captured.err

    def test_no_keywords(self, tmp_path, monkeypatch, capsys):
        rules = tmp_path / "rules"
        rules.mkdir()
        (rules / "empty.md").write_text("---\ntitle: No Rules\n---\nbody\n", encoding="utf-8")
        monkeypatch.setattr(sl, "RULES_DIR", rules)

        projects = tmp_path / "projects" / "proj"
        projects.mkdir(parents=True)
        session = projects / "test.jsonl"
        session.write_text("data", encoding="utf-8")
        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        monkeypatch.setattr(sys, "argv", ["session-logger.py"])

        main()
        captured = capsys.readouterr()
        assert "No keywords loaded" in captured.err

    def test_explicit_session_path(self, rules_dir, tmp_path, monkeypatch, capsys):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - hello
""")
        db_path = tmp_path / "test_explicit.db"
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)

        session = tmp_path / "explicit.jsonl"
        _make_jsonl(session, [_assistant_msg("say hello")])
        monkeypatch.setattr(sys, "argv", ["session-logger.py", str(session)])

        main()
        captured = capsys.readouterr()
        assert "1 matches" in captured.out

    def test_session_no_matches(self, rules_dir, tmp_path, monkeypatch, capsys):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - rareword123
""")
        db_path = tmp_path / "test_nomatch.db"
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)

        session = tmp_path / "nomatch.jsonl"
        _make_jsonl(session, [_assistant_msg("nothing relevant")])
        monkeypatch.setattr(sys, "argv", ["session-logger.py", str(session)])

        main()
        captured = capsys.readouterr()
        assert "0 matches across 0 rules" in captured.out


class TestScanLastMessage:
    """Tests for the Stop Hook scan_last_message function."""

    def _build_pm(self, kw, rule_id="r1"):
        return {kw.lower(): (_build_pattern(kw), [(rule_id, kw)])}

    def test_finds_last_message_only(self):
        pm = self._build_pm("hello")
        f = Path("/tmp/test_stop_last.jsonl")
        _make_jsonl(f, [
            _assistant_msg("say hello first"),
            _assistant_msg("no match here"),
            _assistant_msg("say hello again"),
        ])
        matches = scan_last_message(f, pm)
        assert len(matches) == 1
        assert matches[0]["keyword"] == "hello"
        assert matches[0]["confidence"] == "medium"

    def test_no_assistant_messages(self):
        pm = self._build_pm("hello")
        f = Path("/tmp/test_stop_no_asst.jsonl")
        _make_jsonl(f, [
            json.dumps({"type": "user", "message": {"content": "hello"}}),
        ])
        matches = scan_last_message(f, pm)
        assert len(matches) == 0

    def test_empty_file(self):
        pm = self._build_pm("hello")
        f = Path("/tmp/test_stop_empty.jsonl")
        f.write_text("", encoding="utf-8")
        matches = scan_last_message(f, pm)
        assert len(matches) == 0

    def test_missing_file(self):
        pm = self._build_pm("hello")
        f = Path("/tmp/test_stop_missing_jsonl.jsonl")
        matches = scan_last_message(f, pm)
        assert len(matches) == 0

    def test_confidence_always_medium(self):
        pm = self._build_pm("rm -rf")
        f = Path("/tmp/test_stop_conf.jsonl")
        _make_jsonl(f, [_assistant_msg("run rm -rf /")])
        matches = scan_last_message(f, pm)
        assert len(matches) == 1
        assert matches[0]["confidence"] == "medium"

    def test_word_boundary_applied(self):
        pm = self._build_pm("ship")
        f = Path("/tmp/test_stop_wb.jsonl")
        _make_jsonl(f, [_assistant_msg("a long relationship")])
        matches = scan_last_message(f, pm)
        assert len(matches) == 0


class TestMainStopEvent:
    """Tests for main() with --event stop."""

    def test_stop_event(self, rules_dir, tmp_path, monkeypatch, capsys):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - coverage
""")
        db_path = tmp_path / "test_stop.db"
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)

        session = tmp_path / "stop_test.jsonl"
        _make_jsonl(session, [_assistant_msg("check the coverage")])
        monkeypatch.setattr(sys, "argv", ["session-logger.py", "--event", "stop", str(session)])

        main()
        captured = capsys.readouterr()
        assert "[stop]" in captured.out
        assert "1 matches" in captured.out

    def test_stop_no_matches(self, rules_dir, tmp_path, monkeypatch, capsys):
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - rareword456
""")
        db_path = tmp_path / "test_stop_nomatch.db"
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)

        session = tmp_path / "stop_nomatch.jsonl"
        _make_jsonl(session, [_assistant_msg("nothing here")])
        monkeypatch.setattr(sys, "argv", ["session-logger.py", "--event", "stop", str(session)])

        main()
        captured = capsys.readouterr()
        assert "[stop]" in captured.out
        assert "0 matches" in captured.out


class TestEdgeCases:
    """Tests for uncommon paths in session-logger."""

    def test_scan_last_message_malformed_json(self):
        """Malformed JSON lines are skipped (JSONDecodeError path)."""
        pm = self._build_pm("hello")
        f = Path("/tmp/test_malformed.jsonl")
        f.write_text("\n".join([
            "this is not json",
            _assistant_msg("say hello"),
        ]), encoding="utf-8")
        matches = scan_last_message(f, pm)
        assert len(matches) == 1
        assert matches[0]["keyword"] == "hello"

    @staticmethod
    def _build_pm(*keywords):
        pairs = []
        for kw in keywords:
            pairs.append((kw.lower(), (_build_pattern(kw), [("r1", kw)])))
        return dict(pairs)

    def test_scan_session_keyword_dedup_shorter_skipped(self, rules_dir, tmp_path, monkeypatch):
        """When two keywords match at the same position, shorter is skipped."""
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - TDD
      - TDD cycle
""")
        db_path = tmp_path / "test_dedup.db"
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)

        session = tmp_path / "dedup.jsonl"
        _make_jsonl(session, [_assistant_msg("follow the TDD cycle approach")])
        monkeypatch.setattr(sys, "argv", ["session-logger.py", str(session)])

        main()
        # Both keywords match "TDD cycle", but the longer one should win

    def test_main_skips_unknown_flag(self, rules_dir, tmp_path, monkeypatch, capsys):
        """main() skips CLI args starting with '-' (line 342 path)."""
        _write_rule(rules_dir, "test.md", """
id: sec1
rules:
  - id: sec1.r1
    title: Rule One
    keywords:
      - testword999
""")
        db_path = tmp_path / "test_flag_skip.db"
        monkeypatch.setattr(db_mod, "DB_PATH", db_path)

        session = tmp_path / "flag_skip.jsonl"
        _make_jsonl(session, [_assistant_msg("use testword999 here")])
        # --unknown-flag should be skipped, session path still found
        monkeypatch.setattr(sys, "argv", ["session-logger.py", "--unknown-flag", str(session)])

        main()
        captured = capsys.readouterr()
        assert "1 matches" in captured.out


class TestExtractSessionMetadata:
    """Tests for extract_session_metadata."""

    def test_extracts_model_and_summary(self):
        f = Path("/tmp/test_meta.jsonl")
        f.write_text("\n".join([
            json.dumps({"type": "human", "message": {"content": "Fix the login bug"}}),
            json.dumps({"type": "assistant", "message": {"model": "glm-5.1", "content": [{"type": "text", "text": "I'll fix it"}]}}),
        ]), encoding="utf-8")
        meta = extract_session_metadata(f)
        assert meta["model"] == "glm-5.1"
        assert meta["summary"] == "Fix the login bug"

    def test_no_model_returns_none(self):
        f = Path("/tmp/test_meta_nomodel.jsonl")
        f.write_text(_assistant_msg("hello"), encoding="utf-8")
        meta = extract_session_metadata(f)
        assert meta["model"] is None

    def test_missing_file_returns_empty(self):
        meta = extract_session_metadata(Path("/tmp/nonexistent_abc123.jsonl"))
        assert meta["model"] is None
        assert meta["summary"] is None

    def test_summary_truncated_at_200(self):
        f = Path("/tmp/test_meta_long.jsonl")
        long_text = "x" * 300
        f.write_text(json.dumps({"type": "human", "message": {"content": long_text}}), encoding="utf-8")
        meta = extract_session_metadata(f)
        assert len(meta["summary"]) == 200

    def test_extracts_summary_from_user_type(self):
        f = Path("/tmp/test_meta_user.jsonl")
        f.write_text(json.dumps({"type": "user", "message": {"content": "Fix the bug"}}) + "\n", encoding="utf-8")
        meta = extract_session_metadata(f)
        assert meta["summary"] == "Fix the bug"


class TestBackfillMode:
    def test_backfill_updates_null_sessions(self, monkeypatch, tmp_path):
        """--backfill should update sessions with NULL model."""
        db = db_mod.get_db()
        sid = "backfill-test-session"
        db.execute("INSERT OR REPLACE INTO sessions (session_id, started_at) VALUES (?, datetime('now'))", (sid,))
        db.commit()
        assert db.execute("SELECT model FROM sessions WHERE session_id=?", (sid,)).fetchone()[0] is None

        jsonl = tmp_path / "projects" / "proj" / f"{sid}.jsonl"
        jsonl.parent.mkdir(parents=True)
        jsonl.write_text(json.dumps({"type": "assistant", "message": {"model": "glm-test"}}) + "\n", encoding="utf-8")

        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        monkeypatch.setattr(sys, "argv", ["session-logger.py", "--backfill"])

        sl.main()

        row = db.execute("SELECT model FROM sessions WHERE session_id=?", (sid,)).fetchone()
        assert row[0] == "glm-test"
        db.close()

    def test_backfill_skips_when_no_jsonl(self, monkeypatch, tmp_path):
        """--backfill should skip sessions whose JSONL file doesn't exist."""
        db = db_mod.get_db()
        sid = "no-jsonl-session"
        db.execute("INSERT OR REPLACE INTO sessions (session_id, started_at) VALUES (?, datetime('now'))", (sid,))
        db.commit()

        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        monkeypatch.setattr(sys, "argv", ["session-logger.py", "--backfill"])

        sl.main()

        row = db.execute("SELECT model FROM sessions WHERE session_id=?", (sid,)).fetchone()
        assert row[0] is None
        db.close()

    def test_backfill_all_flag_updates_null_summary(self, monkeypatch, tmp_path):
        """--backfill --all should update sessions where task_summary is NULL."""
        db = db_mod.get_db()
        sid = "backfill-all-session"
        db.execute("INSERT OR REPLACE INTO sessions (session_id, started_at, model) VALUES (?, datetime('now'), 'glm-test')", (sid,))
        db.commit()
        assert db.execute("SELECT task_summary FROM sessions WHERE session_id=?", (sid,)).fetchone()[0] is None

        jsonl = tmp_path / "projects" / "proj" / f"{sid}.jsonl"
        jsonl.parent.mkdir(parents=True)
        jsonl.write_text(json.dumps({"type": "user", "message": {"content": "Update the summary"}}) + "\n", encoding="utf-8")

        monkeypatch.setattr(sl, "CLAUDE_DIR", tmp_path)
        monkeypatch.setattr(sys, "argv", ["session-logger.py", "--backfill", "--all"])

        sl.main()

        row = db.execute("SELECT task_summary FROM sessions WHERE session_id=?", (sid,)).fetchone()
        assert row[0] == "Update the summary"
        db.close()


class TestExtractSessionMetadataEdgeCases:
    """Tests for uncovered branches in extract_session_metadata."""

    def test_content_as_list_of_blocks(self):
        """Extract summary from user message with content as list of text blocks."""
        f = Path("/tmp/test_meta_list.jsonl")
        f.write_text(json.dumps({
            "type": "user",
            "message": {"content": [
                {"type": "text", "text": "First part"},
                {"type": "text", "text": "second part"},
            ]}
        }) + "\n", encoding="utf-8")
        meta = extract_session_metadata(f)
        assert "First part" in meta["summary"]
        assert "second part" in meta["summary"]

    def test_stops_at_50_lines(self):
        """Only scans first 50 entries (idx 0-49); model on line 51 should not be found."""
        f = Path("/tmp/test_meta_50.jsonl")
        lines = [json.dumps({"type": "user", "message": {"content": "padding"}})] * 50
        lines.append(json.dumps({"type": "assistant", "message": {"model": "hidden-model", "content": []}}))
        f.write_text("\n".join(lines), encoding="utf-8")
        meta = extract_session_metadata(f)
        assert meta["model"] is None

    def test_malformed_json_lines_skipped(self):
        """JSONDecodeError lines are skipped without crashing."""
        f = Path("/tmp/test_meta_malformed.jsonl")
        f.write_text("\n".join([
            "not valid json {{{",
            json.dumps({"type": "assistant", "message": {"model": "glm-ok", "content": []}}),
        ]), encoding="utf-8")
        meta = extract_session_metadata(f)
        assert meta["model"] == "glm-ok"


class TestOverlapDeduplication:
    """Tests for longest-match dedup in scan_session and scan_last_message."""

    def _build_pm(self, keywords):
        """Build pattern map with multiple keywords mapped to same rule."""
        pairs = []
        for kw in keywords:
            pairs.append((kw.lower(), (_build_pattern(kw), [("r1", kw)])))
        return dict(pairs)

    def test_scan_session_prefers_longer_keyword(self):
        """When short and long keywords overlap at same position, longer wins."""
        pm = self._build_pm(["TDD", "TDD cycle"])
        f = Path("/tmp/test_overlap_scan.jsonl")
        _make_jsonl(f, [_assistant_msg("follow the TDD cycle approach")])
        matches, _ = scan_session(f, pm)
        # Both keywords match but at the same position range for "TDD"
        # The longer "TDD cycle" should be kept, shorter "TDD" deduped
        kw_set = {m["keyword"] for m in matches}
        assert "TDD cycle" in kw_set

    def test_scan_last_message_prefers_longer_keyword(self):
        """Same dedup logic in scan_last_message."""
        pm = self._build_pm(["TDD", "TDD cycle"])
        f = Path("/tmp/test_overlap_stop.jsonl")
        _make_jsonl(f, [_assistant_msg("follow the TDD cycle approach")])
        matches = scan_last_message(f, pm)
        kw_set = {m["keyword"] for m in matches}
        assert "TDD cycle" in kw_set
