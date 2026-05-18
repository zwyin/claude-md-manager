#!/usr/bin/env python3
"""
Claude Code Hook: Session Logger

Scans session JSONL files for rule keyword matches and records citations.
Called by Claude Code hooks system (PostToolUse or Stop).

Usage:
    python session-logger.py                  # Auto-detect latest session
    python session-logger.py <jsonl_path>     # Process specific session file
    python session-logger.py --sync-metadata  # Sync rule metadata only
"""

import json
import re
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_db, record_references, upsert_session, sync_rules_metadata, sync_sections_metadata

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
RULES_DIR = PROJECT_DIR / "rules"
CLAUDE_DIR = Path.home() / ".claude"


def parse_all_rules() -> tuple[dict, list, list]:
    """Parse all rule files once, returning keyword_map, rules_data, sections_data."""
    import yaml as _yaml
    keyword_map: dict = {}
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
                if kw_lower not in keyword_map:
                    keyword_map[kw_lower] = []
                keyword_map[kw_lower].append((rule_id, kw))
    return keyword_map, rules_data, sections_data


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


def scan_session(jsonl_path: Path, keyword_map: dict) -> list:
    """Scan a session JSONL file for keyword matches in assistant messages.
    
    Returns: [{"rule_id": "...", "keyword": "..."}, ...]
    """
    matches = []
    seen = set()
    
    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
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
                    # Extract text blocks
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                    content = " ".join(text_parts)
                
                if not isinstance(content, str) or not content.strip():
                    continue
                
                content_lower = content.lower()
                for kw_lower, rule_pairs in keyword_map.items():
                    if kw_lower in content_lower:
                        for rule_id, kw_original in rule_pairs:
                            match_key = (rule_id, kw_original)
                            if match_key not in seen:
                                seen.add(match_key)
                                matches.append({
                                    "rule_id": rule_id,
                                    "keyword": kw_original,
                                })
    
    except FileNotFoundError:
        print(f"Warning: session file not found: {jsonl_path}", file=sys.stderr)
    
    return matches


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

    # Parse all rules once (keyword map + metadata)
    keyword_map, rules_data, sections_data = parse_all_rules()
    if not keyword_map:
        print("No keywords loaded from rules.", file=sys.stderr)
        return

    # Scan session
    matches = scan_session(session_path, keyword_map)

    if not matches:
        print(f"Session {session_id}: no rule matches found")
        return

    # Record to database
    conn = get_db()

    # Sync metadata and record references
    sync_rules_metadata(conn, rules_data)
    sync_sections_metadata(conn, sections_data)
    record_references(conn, session_id, matches)
    upsert_session(conn, session_id)

    # Summary
    unique_rules = len(set(m["rule_id"] for m in matches))
    print(f"Session {session_id}: {len(matches)} keyword matches across {unique_rules} rules")

    conn.close()


if __name__ == "__main__":
    main()
