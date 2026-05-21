#!/usr/bin/env python3
"""
Claude Code Hook: Session Logger

Scans session JSONL files for rule keyword matches and records citations.
Called by Claude Code hooks system (PostToolUse or Stop).

Usage:
    python session-logger.py                  # Auto-detect latest session
    python session-logger.py <jsonl_path>     # Process specific session file
    python session-logger.py --sync-metadata  # Sync rule metadata only

Hook registration (async recommended for zero impact on Claude):
    ~/.claude/settings.json:
    {
      "hooks": {
        "PostToolUse": [{
          "matcher": "",
          "hooks": [{
            "type": "command",
            "command": "python3 /path/to/session-logger.py",
            "async": true
          }]
        }]
      }
    }
"""

import json
import re
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import (get_db, get_session_offset, record_references,
                sync_rules_metadata, sync_sections_metadata, update_session_offset,
                upsert_session)

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
RULES_DIR = PROJECT_DIR / "rules"
CLAUDE_DIR = Path.home() / ".claude"

# CJK character range for keyword type detection
_CJK_RE = re.compile(r'[一-鿿㐀-䶿]')


def _build_pattern(keyword: str) -> re.Pattern:
    """Build an appropriate regex pattern based on keyword type.

    Three strategies:
    1. CJK keywords: match with non-ASCII-alphanumeric boundaries
    2. Multi-word phrases (spaces/hyphens): literal match with word boundaries
    3. Pure English: standard \\b word boundaries
    """
    escaped = re.escape(keyword)
    has_cjk = bool(_CJK_RE.search(keyword))
    stripped = keyword.strip()
    has_space = ' ' in stripped
    has_hyphen = '-' in stripped and not stripped.startswith('-')

    if has_cjk:
        # CJK: allow match when preceded/followed by anything except ASCII alphanumeric
        return re.compile(r'(?<![a-zA-Z0-9])' + escaped + r'(?![a-zA-Z0-9])', re.IGNORECASE)
    elif has_space or has_hyphen:
        # Multi-word phrase: literal match with flexible boundaries
        return re.compile(r'(?<!\w)' + escaped + r'(?!\w)', re.IGNORECASE)
    else:
        # Pure English: standard word boundary
        return re.compile(r'\b' + escaped + r'\b', re.IGNORECASE)


def parse_all_rules() -> tuple[dict, list, list]:
    """Parse all rule files, returning compiled_pattern_map, rules_data, sections_data.

    compiled_pattern_map: {rule_id: [(compiled_regex, original_keyword)]}
    """
    import yaml as _yaml
    # keyword_to_rules: maps keyword to list of (rule_id, original_keyword)
    keyword_to_rules: dict = {}
    rules_data: list = []
    sections_data: list = []

    for f in RULES_DIR.glob("*.md"):
        content = f.read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
        if not match:
            continue
        meta = _yaml.safe_load(match.group(1)) or {}
        section_id = meta.get("id", "")
        rules = meta.get("rules", [])
        if section_id:
            sections_data.append({
                "section_id": section_id,
                "title": meta.get("title", section_id),
                "source_file": f.name,
                "rule_count": len(rules),
            })
        for rule in rules:
            rule_id = rule.get("id", "")
            rules_data.append({
                "rule_id": rule_id,
                "section_id": section_id,
                "title": rule.get("title", ""),
                "keywords": rule.get("keywords", []),
                "source_file": f.name,
            })
            for kw in rule.get("keywords", []):
                kw_lower = kw.lower()
                if kw_lower not in keyword_to_rules:
                    keyword_to_rules[kw_lower] = []
                keyword_to_rules[kw_lower].append((rule_id, kw))

    # Build compiled pattern map: {keyword_lower: (compiled_regex, [(rule_id, original_kw)])}
    pattern_map: dict = {}
    for kw_lower, rule_pairs in keyword_to_rules.items():
        # Use original keyword (first occurrence) to build pattern
        original_kw = rule_pairs[0][1]
        pattern_map[kw_lower] = (_build_pattern(original_kw), rule_pairs)

    return pattern_map, rules_data, sections_data


def find_latest_session() -> Path | None:
    """Find the most recently modified session JSONL file.

    Claude Code stores sessions as <uuid>.jsonl directly in
    ~/.claude/projects/<project-dir>/ (no conversations/ subdirectory).

    Optimization: only scan files modified in the last hour, since
    the hook runs during active sessions.
    """
    import time
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.exists():
        return None

    cutoff = time.time() - 3600  # 1 hour ago
    best_path: Path | None = None
    best_mtime = 0.0

    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        try:
            for jsonl_file in project_dir.glob("*.jsonl"):
                mtime = jsonl_file.stat().st_mtime
                if mtime >= cutoff and mtime > best_mtime:
                    best_mtime = mtime
                    best_path = jsonl_file
        except PermissionError:
            continue

    return best_path


def _classify_confidence(keyword: str) -> str:
    """Estimate match confidence based on keyword characteristics.

    High: long precise phrase (>= 10 chars)
    Medium: keyword with word boundary match (>= 4 chars)
    Low: short keywords (< 4 chars)
    """
    if len(keyword) >= 10:
        return "high"
    if len(keyword) >= 4:
        return "medium"
    return "low"


def scan_session(jsonl_path: Path, pattern_map: dict, start_line: int = 0) -> tuple[list, int]:
    """Scan a session JSONL file for keyword matches in assistant messages.

    Args:
        jsonl_path: Path to the JSONL session file
        pattern_map: {keyword_lower: (compiled_regex, [(rule_id, original_kw)])}
        start_line: Line number to start scanning from (inclusive, 0-based)

    Returns: (matches, last_line_scanned)
        matches: [{"rule_id": "...", "keyword": "...", "confidence": "..."}, ...]
        last_line_scanned: 0-based line number of the last line processed
    """
    matches = []
    seen = set()
    last_line_scanned = start_line
    # Track longest match per position per rule to deduplicate substring keywords
    # {(rule_id, start_pos, end_pos): keyword}
    longest_match: dict = {}

    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f):
                if line_idx < start_line:
                    continue

                try:
                    entry = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue

                # Claude Code JSONL format: type="assistant", content in entry.message.content
                entry_type = entry.get("type", "")
                if entry_type != "assistant":
                    continue

                msg = entry.get("message", {})
                content = msg.get("content", [])
                if isinstance(content, list):
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                    content = " ".join(text_parts)

                if not isinstance(content, str) or not content.strip():
                    continue

                for _, (pattern, rule_pairs) in pattern_map.items():
                    for m in pattern.finditer(content):
                        for rule_id, kw_original in rule_pairs:
                            pos_key = (rule_id, m.start(), m.end())
                            existing = longest_match.get(pos_key)
                            if existing and len(existing) >= len(kw_original):
                                continue
                            longest_match[pos_key] = kw_original
                            match_key = (rule_id, kw_original)
                            if match_key not in seen:
                                seen.add(match_key)
                                confidence = _classify_confidence(kw_original)
                                matches.append({
                                    "rule_id": rule_id,
                                    "keyword": kw_original,
                                    "confidence": confidence,
                                })

                last_line_scanned = line_idx

    except FileNotFoundError:
        print(f"Warning: session file not found: {jsonl_path}", file=sys.stderr)
        return matches, start_line

    return matches, last_line_scanned


def main():
    if "--sync-metadata" in sys.argv:
        conn = get_db()
        _, rules_data, sections_data = parse_all_rules()
        sync_rules_metadata(conn, rules_data)
        sync_sections_metadata(conn, sections_data)
        print(f"Synced {len(rules_data)} rules, {len(sections_data)} sections")
        conn.close()
        return

    # Determine session file
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        session_path = Path(sys.argv[1])
    else:
        session_path = find_latest_session()

    if not session_path or not session_path.exists():
        print("No session file found. Skipping.", file=sys.stderr)
        return

    session_id = session_path.stem

    # Parse all rules once (pattern map + metadata)
    pattern_map, rules_data, sections_data = parse_all_rules()
    if not pattern_map:
        print("No keywords loaded from rules.", file=sys.stderr)
        return

    # Connect to DB and get last scanned offset
    conn = get_db()
    upsert_session(conn, session_id)
    start_line = get_session_offset(conn, session_id)

    # Scan session incrementally
    matches, last_line = scan_session(session_path, pattern_map, start_line)

    # Record results in a single transaction
    sync_rules_metadata(conn, rules_data)
    sync_sections_metadata(conn, sections_data)
    if matches:
        record_references(conn, session_id, matches, source="hook_posttool")
    update_session_offset(conn, session_id, last_line + 1)
    conn.commit()

    # Summary
    unique_rules = len(set(m["rule_id"] for m in matches))
    print(f"Session {session_id} (lines {start_line}-{last_line}): "
          f"{len(matches)} matches across {unique_rules} rules")

    conn.close()


if __name__ == "__main__":
    main()
