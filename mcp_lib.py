"""Business logic for the claude-md-manager MCP server.

Provides rule listing, draft CRUD, validation, and publishing.
Shares the same SQLite DB and rules/ directory as the Next.js web UI.
"""

import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR
RULES_DIR = PROJECT_DIR / "rules"
DATA_DIR = PROJECT_DIR / "data"
HISTORY_DIR = DATA_DIR / "history"
DB_PATH = DATA_DIR / "usage.db"
OUTPUT_PATH = Path.home() / ".claude" / "CLAUDE.md"

# Import from existing modules
sys.path.insert(0, str(PROJECT_DIR / "hooks"))
from db import get_db, upsert_session, record_references  # noqa: E402


# ── Frontmatter parsing (mirrors assemble.py) ──

def parse_frontmatter(content: str) -> tuple[dict, str, str]:
    """Parse YAML frontmatter from markdown. Returns (meta, yaml_str, body)."""
    match = re.match(r"^---\n(.*?)\n---\n(.*)", content, re.DOTALL)
    if not match:
        return {}, "", content
    import yaml
    meta = yaml.safe_load(match.group(1)) or {}
    return meta, match.group(1), match.group(2)


# ── Rule listing ──

def list_rules_from_disk() -> list[dict]:
    """List all rules from rules/*.md with metadata and draft status."""
    db = get_db()
    try:
        drafts = {
            row["rule_id"]: row["order_override"]
            for row in db.execute("SELECT rule_id, order_override FROM rule_drafts").fetchall()
        }
    finally:
        db.close()

    rules = []
    for f in sorted(RULES_DIR.glob("*.md")):
        content = f.read_text(encoding="utf-8")
        meta, _, body = parse_frontmatter(content)
        rule_id = str(meta.get("id", ""))
        title = str(meta.get("title", rule_id))
        order = int(meta.get("order", 999))
        rules.append({
            "rule_id": rule_id,
            "title": title,
            "order": order,
            "source_file": f.name,
            "has_draft": rule_id in drafts,
            "draft_order_override": drafts.get(rule_id),
            "body_length": len(body.strip()),
        })

    rules.sort(key=lambda r: r.get("draft_order_override") or r["order"])
    return rules


# ── Single rule ──

def read_rule_file(rule_id: str) -> dict | None:
    """Read a specific rule by its id field. Returns full content or None."""
    for f in RULES_DIR.glob("*.md"):
        content = f.read_text(encoding="utf-8")
        meta, yaml_str, body = parse_frontmatter(content)
        if meta.get("id") == rule_id:
            return {
                "rule_id": rule_id,
                "title": str(meta.get("title", rule_id)),
                "order": int(meta.get("order", 999)),
                "source_file": f.name,
                "frontmatter_yaml": yaml_str,
                "markdown_body": body,
            }
    return None


# ── Draft CRUD ──

def get_draft_from_db(rule_id: str) -> dict | None:
    """Get a draft for a rule. Returns dict or None."""
    db = get_db()
    try:
        row = db.execute(
            "SELECT rule_id, frontmatter_yaml, markdown_body, order_override, created_at, updated_at FROM rule_drafts WHERE rule_id = ?",
            (rule_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "rule_id": row[0],
            "frontmatter_yaml": row[1],
            "markdown_body": row[2],
            "order_override": row[3],
            "created_at": row[4],
            "updated_at": row[5],
        }
    finally:
        db.close()


def save_draft_to_db(rule_id: str, frontmatter_yaml: str, markdown_body: str, order_override: int | None = None) -> dict | None:
    """Save or update a draft. Returns the saved draft."""
    db = get_db()
    try:
        db.execute(
            """INSERT INTO rule_drafts (rule_id, frontmatter_yaml, markdown_body, order_override, created_at, updated_at)
               VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
               ON CONFLICT(rule_id) DO UPDATE SET
                 frontmatter_yaml = excluded.frontmatter_yaml,
                 markdown_body = excluded.markdown_body,
                 order_override = excluded.order_override,
                 updated_at = datetime('now')""",
            (rule_id, frontmatter_yaml, markdown_body, order_override),
        )
        db.commit()
    finally:
        db.close()
    return get_draft_from_db(rule_id)


def delete_draft_from_db(rule_id: str) -> bool:
    """Delete a draft. Returns True if a draft was deleted."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM rule_drafts WHERE rule_id = ?", (rule_id,))
        db.commit()
        return cursor.rowcount > 0
    finally:
        db.close()


# ── Validation ──

def validate_all_drafts() -> list[dict]:
    """Validate all pending drafts. Returns list of {rule_id, errors}."""
    db = get_db()
    try:
        drafts = db.execute("SELECT rule_id, frontmatter_yaml FROM rule_drafts").fetchall()
    finally:
        db.close()

    results = []
    for draft in drafts:
        rule_id, yaml_str = draft[0], draft[1]
        errors = []
        if not re.search(r"^id:", yaml_str, re.MULTILINE):
            errors.append("missing 'id'")
        if not re.search(r"^title:", yaml_str, re.MULTILINE):
            errors.append("missing 'title'")
        if not re.search(r"^order:", yaml_str, re.MULTILINE):
            errors.append("missing 'order'")
        results.append({"rule_id": rule_id, "errors": errors})
    return results


# ── Publish ──

def _force_snapshot() -> str | None:
    """Force-save a snapshot of the current ~/.claude/CLAUDE.md before any changes.
    Skips if content is identical to the latest snapshot.
    Returns snapshot filename or None if skipped / file doesn't exist.
    """
    if not OUTPUT_PATH.exists():
        return None
    content = OUTPUT_PATH.read_text(encoding="utf-8")
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

    # Skip if identical to the latest snapshot
    existing = sorted(HISTORY_DIR.glob("*.md"), reverse=True)
    if existing and existing[0].read_text(encoding="utf-8") == content:
        return None

    ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    name = f"{ts}.md"
    (HISTORY_DIR / name).write_text(content, encoding="utf-8")
    return name


def publish_all_drafts() -> dict:
    """Publish all drafts: write to rules/*.md, run assemble.py, clear drafts.

    Force-snapshots the current CLAUDE.md before making any changes.
    Returns {rules_changed, snapshot_name, error?}.
    """
    db = get_db()
    try:
        drafts = db.execute("SELECT * FROM rule_drafts").fetchall()
        if not drafts:
            return {"rules_changed": 0, "snapshot_name": None}

        # Force snapshot BEFORE any file writes
        pre_snapshot = _force_snapshot()

        # Build a map of rule_id → source_file
        rules_map: dict[str, dict] = {}
        for f in RULES_DIR.glob("*.md"):
            content = f.read_text(encoding="utf-8")
            meta, yaml_str, body = parse_frontmatter(content)
            rid = meta.get("id")
            if rid:
                rules_map[rid] = {"source_file": f, "yaml": yaml_str, "body": body}

        written = 0
        for draft in drafts:
            rule_id = draft[0]
            draft_yaml = draft[1] or ""
            draft_body = draft[2] or ""
            order_override = draft[3]

            rule = rules_map.get(rule_id)
            if rule:
                # Existing rule — modify in place (preserves prior behavior)
                target_file = rule["source_file"]
                yaml_out = draft_yaml or rule["yaml"]
                body_out = draft_body or rule["body"]
                if order_override is not None:
                    yaml_out = re.sub(r"^order:\s*\d+", f"order: {order_override}", yaml_out, flags=re.MULTILINE)
            else:
                # New rule_id — create rules/<NN>_<sanitized_title>.md
                # Fix: drafts for rule_ids that don't yet have a rules file
                # used to be silently dropped. Now we create the file so
                # users can add new rules via the draft/publish flow alone.
                draft_meta, _, _ = parse_frontmatter(f"---\n{draft_yaml}\n---\n{draft_body}")
                effective_order = order_override if order_override is not None else int(draft_meta.get("order", 999))
                title = str(draft_meta.get("title", rule_id))
                safe_title = re.sub(r"[^\w一-鿿-]+", "-", title).strip("-") or rule_id
                target_file = RULES_DIR / f"{effective_order:02d}_{safe_title}.md"
                i = 2
                while target_file.exists():
                    target_file = RULES_DIR / f"{effective_order:02d}_{safe_title}-{i}.md"
                    i += 1
                yaml_out = draft_yaml
                if order_override is not None:
                    yaml_out = re.sub(r"^order:\s*\d+", f"order: {order_override}", yaml_out, flags=re.MULTILINE)
                body_out = draft_body

            target_file.write_text(f"---\n{yaml_out}\n---\n{body_out}", encoding="utf-8")
            written += 1

        # Run assemble.py
        snapshot_name = pre_snapshot
        error_msg = None
        try:
            result = subprocess.run(
                [sys.executable, "build/assemble.py"],
                capture_output=True, text=True, timeout=30,
                cwd=str(PROJECT_DIR),
            )
            if result.returncode != 0:
                error_msg = result.stderr.strip() or result.stdout.strip() or "assemble.py failed"
        except subprocess.TimeoutExpired:
            error_msg = "assemble.py timed out"
        except Exception as e:
            error_msg = str(e)

        # Record publish event with explicit transaction + verification
        status = "failed" if error_msg else "success"
        db.execute("BEGIN IMMEDIATE")
        cursor = db.execute(
            "INSERT INTO publish_history (published_at, rules_changed, snapshot_name, status, error_message) VALUES (datetime('now'), ?, ?, ?, ?)",
            (written, snapshot_name, status, error_msg),
        )
        row_id = cursor.lastrowid

        # Clear drafts on success
        if not error_msg:
            db.execute("DELETE FROM rule_drafts")

        db.commit()

        # Verify the commit persisted
        verify = db.execute("SELECT id FROM publish_history WHERE id = ?", (row_id,)).fetchone()
        if not verify:
            error_msg = error_msg or "publish_history commit verification failed"

        return {"rules_changed": written, "snapshot_name": snapshot_name, "error": error_msg}
    finally:
        db.close()


# ── Read current CLAUDE.md ──

def read_claude_md() -> str | None:
    """Read the current ~/.claude/CLAUDE.md. Returns content or None."""
    if OUTPUT_PATH.exists():
        return OUTPUT_PATH.read_text(encoding="utf-8")
    return None


# ── Publish history ──

def get_publish_history_from_db(limit: int = 20) -> list[dict]:
    """Get recent publish history."""
    db = get_db()
    try:
        rows = db.execute(
            "SELECT id, published_at, rules_changed, snapshot_name, status, error_message FROM publish_history ORDER BY published_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {
                "id": r[0], "published_at": r[1], "rules_changed": r[2],
                "snapshot_name": r[3], "status": r[4], "error_message": r[5],
            }
            for r in rows
        ]
    finally:
        db.close()


# ── Snapshots ──

def list_snapshot_files() -> list[dict]:
    """List available snapshot files."""
    if not HISTORY_DIR.exists():
        return []
    snapshots = []
    for f in sorted(HISTORY_DIR.glob("*.md"), reverse=True):
        snapshots.append({
            "filename": f.name,
            "timestamp": f.name.replace(".md", ""),
            "size": f.stat().st_size,
        })
    return snapshots


# ── Citation recording (Phase 2: MCP tool) ──

def record_citation(rule_id: str, matched_keyword: str, session_id: str | None = None) -> dict:
    """Record a rule citation from Claude's explicit reference.

    This is the highest-confidence source (mcp_tool), used when Claude
    proactively reports that it referenced a specific rule.

    Returns {recorded, rule_id, keyword, session_id}.
    """
    import uuid
    if not session_id:
        session_id = f"mcp-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"

    db = get_db()
    try:
        upsert_session(db, session_id)
        record_references(db, session_id, [{
            "rule_id": rule_id,
            "keyword": matched_keyword,
            "confidence": "high",
        }], source="mcp_tool")
    finally:
        db.close()

    return {
        "recorded": True,
        "rule_id": rule_id,
        "keyword": matched_keyword,
        "session_id": session_id,
    }
