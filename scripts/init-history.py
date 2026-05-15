#!/usr/bin/env python3
"""
Import historical rule citation baseline from past Claude Code sessions.

Scans ALL session JSONL files in ~/.claude/projects/ and records
keyword matches as historical citations.

Usage:
    python init-history.py              # Process all sessions
    python init-history.py --limit 50   # Process only 50 most recent sessions
    python init-history.py --dry-run    # Preview without writing to DB
"""

import argparse
import importlib.util
import sys
from pathlib import Path

# Load hooks modules (hyphenated filenames require importlib)
HOOKS_DIR = Path(__file__).resolve().parent.parent / "hooks"

def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_db = _load_module("db", HOOKS_DIR / "db.py")
_sl = _load_module("session_logger", HOOKS_DIR / "session-logger.py")

get_db = _db.get_db
record_references = _db.record_references
upsert_session = _db.upsert_session
sync_rules_metadata = _db.sync_rules_metadata
load_keyword_map = _sl.load_keyword_map
scan_session = _sl.scan_session
get_rules_metadata = _sl.get_rules_metadata

CLAUDE_DIR = Path.home() / ".claude"


def find_all_sessions(limit: int = None) -> list:
    """Find all session JSONL files, sorted by modification time (newest first)."""
    candidates = []
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.exists():
        return []

    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        for jsonl_file in project_dir.glob("*.jsonl"):
            candidates.append(jsonl_file)

    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)

    if limit:
        candidates = candidates[:limit]

    return candidates


def main():
    parser = argparse.ArgumentParser(description="Import historical citation baseline")
    parser.add_argument("--limit", type=int, help="Max sessions to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    sessions = find_all_sessions(limit=args.limit)
    if not sessions:
        print("No session files found.")
        return

    keyword_map = load_keyword_map()
    if not keyword_map:
        print("No keywords loaded from rules.")
        return

    print(f"Found {len(sessions)} sessions, {len(keyword_map)} keywords to scan")
    print()

    total_matches = 0
    total_sessions_with_matches = 0

    if not args.dry_run:
        conn = get_db()
        rules_data = get_rules_metadata()
        sync_rules_metadata(conn, rules_data)
    else:
        conn = None

    for i, session_path in enumerate(sessions):
        session_id = f"historical_{session_path.stem}"
        matches = scan_session(session_path, keyword_map)

        if matches:
            unique_rules = len(set(m["rule_id"] for m in matches))
            print(f"  [{i+1}/{len(sessions)}] {session_path.name}: "
                  f"{len(matches)} matches, {unique_rules} rules")
            total_matches += len(matches)
            total_sessions_with_matches += 1

            if conn:
                record_references(conn, session_id, matches)
                upsert_session(conn, session_id)
        else:
            # Still count the session
            if conn:
                upsert_session(conn, session_id)

    print()
    print(f"Summary: {total_sessions_with_matches}/{len(sessions)} sessions had matches, "
          f"{total_matches} total keyword matches")

    if args.dry_run:
        print("(dry-run: nothing written to database)")
    
    if conn:
        conn.close()


if __name__ == "__main__":
    main()
