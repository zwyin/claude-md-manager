#!/usr/bin/env python3
"""
CLAUDE.md Assembler - Builds ~/.claude/CLAUDE.md from modular rule files.

Usage:
    python assemble.py              # Build and write
    python assemble.py --dry-run    # Preview to stdout
    python assemble.py --validate   # Validate all rule files
    python assemble.py --rollback <timestamp>  # Rollback to snapshot
    python assemble.py --list-snapshots        # List available snapshots
"""

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

import yaml

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
RULES_DIR = PROJECT_DIR / "rules"
DATA_DIR = PROJECT_DIR / "data"
HISTORY_DIR = DATA_DIR / "history"
OUTPUT_PATH = Path.home() / ".claude" / "CLAUDE.md"

HEADER_TEMPLATE = "<!-- Built by claude-md-manager at {timestamp} -->\n"


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown content. Returns (metadata, body)."""
    match = re.match(r"^---\n(.*?)\n---\n(.*)", content, re.DOTALL)
    if not match:
        return {}, content
    meta = yaml.safe_load(match.group(1))
    body = match.group(2)
    return meta or {}, body


def load_rules() -> list[tuple[str, dict, str]]:
    """Load all rule files, sorted by order. Returns [(filename, meta, body), ...]."""
    rules = []
    for f in sorted(RULES_DIR.glob("*.md")):
        content = f.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(content)
        order = meta.get("order", 999)
        rules.append((f.name, meta, body, order))
    rules.sort(key=lambda x: x[3])
    return [(name, meta, body) for name, meta, body, _ in rules]


def build_output(rules: list[tuple[str, dict, str]]) -> str:
    """Assemble all rule bodies into a single CLAUDE.md content."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    parts = [HEADER_TEMPLATE.format(timestamp=timestamp)]
    for i, (_, _, body) in enumerate(rules):
        body_stripped = body.strip()
        if body_stripped:
            parts.append(body_stripped)
            if i < len(rules) - 1:
                parts.append("")  # blank line between sections
    return "\n".join(parts) + "\n"


def validate_rules(rules: list[tuple[str, dict, str]]) -> list[str]:
    """Validate all rule files. Returns list of error messages."""
    errors = []
    all_ids = set()
    for name, meta, body in rules:
        rule_id = meta.get("id", "")
        if not rule_id:
            errors.append(f"{name}: missing 'id' in frontmatter")
            continue
        if rule_id in all_ids:
            errors.append(f"{name}: duplicate id '{rule_id}'")
        all_ids.add(rule_id)

        rules_list = meta.get("rules", [])
        sub_ids = set()
        for r in rules_list:
            sub_id = r.get("id", "")
            if not sub_id:
                errors.append(f"{name}: sub-rule missing 'id'")
                continue
            if not sub_id.startswith(rule_id + "."):
                errors.append(f"{name}: sub-rule id '{sub_id}' should start with '{rule_id}.'")
            if sub_id in sub_ids:
                errors.append(f"{name}: duplicate sub-rule id '{sub_id}'")
            sub_ids.add(sub_id)

            kw = r.get("keywords", [])
            if not kw:
                errors.append(f"{name}: sub-rule '{sub_id}' has no keywords")

        if not body.strip():
            errors.append(f"{name}: empty body after frontmatter")

    return errors


def save_snapshot(content: str) -> str:
    """Save a snapshot to data/history/. Returns snapshot filename."""
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    snapshot_name = f"{ts}.md"
    snapshot_path = HISTORY_DIR / snapshot_name
    snapshot_path.write_text(content, encoding="utf-8")
    return snapshot_name


def list_snapshots() -> list[str]:
    """List available snapshots, newest first."""
    if not HISTORY_DIR.exists():
        return []
    return sorted(
        [f.name for f in HISTORY_DIR.glob("*.md")],
        reverse=True
    )


def rollback(timestamp: str) -> bool:
    """Rollback to a specific snapshot."""
    # Find matching snapshot
    candidates = [
        s for s in list_snapshots()
        if s.startswith(timestamp) or timestamp in s
    ]
    if not candidates:
        print(f"Error: no snapshot matching '{timestamp}'", file=sys.stderr)
        print("Available snapshots:", file=sys.stderr)
        for s in list_snapshots()[:10]:
            print(f"  {s}", file=sys.stderr)
        return False

    snapshot_path = HISTORY_DIR / candidates[0]
    content = snapshot_path.read_text(encoding="utf-8")
    OUTPUT_PATH.write_text(content, encoding="utf-8")
    print(f"Rolled back to snapshot: {candidates[0]}")
    print(f"Written to: {OUTPUT_PATH}")
    return True


def git_commit_if_changed(content: str, changed_files: list[str] | None = None):
    """Auto git commit if content changed."""
    import subprocess
    try:
        # Check if we're in a git repo
        subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True, check=True,
            cwd=PROJECT_DIR
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return

    # Check if output changed
    existing = ""
    if OUTPUT_PATH.exists():
        existing = OUTPUT_PATH.read_text(encoding="utf-8")

    if content == existing:
        print("No changes detected. Skipping commit.")
        return

    # Save snapshot only when there are changes
    save_snapshot(content)

    # Stage and commit
    try:
        subprocess.run(["git", "add", "data/history/", "rules/"], cwd=PROJECT_DIR, check=True)

        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        msg = f"build: update CLAUDE.md at {ts}"
        if changed_files:
            msg += f" (changed: {', '.join(changed_files)})"

        subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=PROJECT_DIR, check=True
        )
        print(f"Committed: {msg}")
    except subprocess.CalledProcessError as e:
        print(f"Git commit failed: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="CLAUDE.md Assembler")
    parser.add_argument("--dry-run", action="store_true", help="Preview output to stdout")
    parser.add_argument("--validate", action="store_true", help="Validate all rule files")
    parser.add_argument("--rollback", metavar="TIMESTAMP", help="Rollback to snapshot")
    parser.add_argument("--list-snapshots", action="store_true", help="List available snapshots")
    args = parser.parse_args()

    if args.list_snapshots:
        snapshots = list_snapshots()
        if not snapshots:
            print("No snapshots available.")
        else:
            print(f"Available snapshots ({len(snapshots)}):")
            for s in snapshots:
                print(f"  {s}")
        return

    if args.rollback:
        rollback(args.rollback)
        return

    rules = load_rules()

    if args.validate:
        errors = validate_rules(rules)
        if errors:
            print(f"Validation failed ({len(errors)} errors):")
            for e in errors:
                print(f"  ✗ {e}")
            sys.exit(1)
        else:
            # Print summary
            total_sub_rules = sum(len(m.get("rules", [])) for _, m, _ in rules)
            print(f"Validation passed: {len(rules)} sections, {total_sub_rules} sub-rules")
            for name, meta, _ in rules:
                subs = len(meta.get("rules", []))
                print(f"  ✓ {name} ({meta.get('id', '?')}) — {subs} sub-rules")
        return

    # Build
    content = build_output(rules)

    if args.dry_run:
        print(content)
        return

    # Write
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(content, encoding="utf-8")
    print(f"Built CLAUDE.md → {OUTPUT_PATH}")
    print(f"  Sections: {len(rules)}")
    print(f"  Total lines: {len(content.splitlines())}")

    # Snapshot + git commit
    git_commit_if_changed(content)


if __name__ == "__main__":
    main()
