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
import os
import re
import sys
from datetime import datetime
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_db, record_references, upsert_session, sync_rules_metadata

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
RULES_DIR = PROJECT_DIR / "rules"
CLAUDE_DIR = Path.home() / ".claude"


def load_keyword_map() -> dict:
    """Load keyword → rule_id mapping from all rule files.
    
    Returns: {keyword_lower: [(rule_id, keyword_original), ...]}
    """
    import yaml as _yaml
    keyword_map = {}
    for f in RULES_DIR.glob("*.md"):
        content = f.read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
        if not match:
            continue
        meta = _yaml.safe_load(match.group(1)) or {}
        for rule in meta.get("rules", []):
            rule_id = rule.get("id", "")
            for kw in rule.get("keywords", []):
                kw_lower = kw.lower()
                if kw_lower not in keyword_map:
                    keyword_map[kw_lower] = []
                keyword_map[kw_lower].append((rule_id, kw))
    return keyword_map


def get_rules_metadata() -> list:
    """Extract rules metadata from all rule files for DB sync."""
    import yaml as _yaml
    rules_data = []
    for f in RULES_DIR.glob("*.md"):
        content = f.read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
        if not match:
            continue
        meta = _yaml.safe_load(match.group(1)) or {}
        section_id = meta.get("id", "")
        for rule in meta.get("rules", []):
            rules_data.append({
                "rule_id": rule.get("id", ""),
                "section_id": section_id,
                "title": rule.get("title", ""),
                "keywords": rule.get("keywords", []),
                "source_file": f.name,
            })
    return rules_data


def find_latest_session() -> Path | None:
    """Find the most recently modified session JSONL file.

    Claude Code stores sessions as <uuid>.jsonl directly in
    ~/.claude/projects/<project-dir>/ (no conversations/ subdirectory).
    """
    candidates = []
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.exists():
        return None

    # Scan all project directories for JSONL files
    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        for jsonl_file in project_dir.glob("*.jsonl"):
            candidates.append(jsonl_file)

    if not candidates:
        return None

    return max(candidates, key=lambda p: p.stat().st_mtime)


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
        rules_data = get_rules_metadata()
        sync_rules_metadata(conn, rules_data)
        print(f"Synced {len(rules_data)} rules metadata")
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
    
    # Load keyword map
    keyword_map = load_keyword_map()
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
    
    # Sync metadata first
    rules_data = get_rules_metadata()
    sync_rules_metadata(conn, rules_data)
    
    # Record references
    record_references(conn, session_id, matches)
    upsert_session(conn, session_id)
    
    # Summary
    unique_rules = len(set(m["rule_id"] for m in matches))
    print(f"Session {session_id}: {len(matches)} keyword matches across {unique_rules} rules")
    
    conn.close()


if __name__ == "__main__":
    main()
