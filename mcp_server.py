"""CLAUDE.md Manager MCP Server.

Exposes rule management as MCP tools for Claude Code CLI.
Uses the draft system — changes are saved as drafts and must be explicitly published.

Usage:
    python mcp_server.py              # Start MCP server (stdio transport)
"""

from fastmcp import FastMCP
import mcp_lib

mcp = FastMCP(
    name="claude-md-manager",
    instructions="Manage system-level ~/.claude/CLAUDE.md rules. Use draft system for safety — all changes need user confirmation before publishing.",
)


@mcp.tool
def list_rules() -> list[dict]:
    """List all CLAUDE.md rules with metadata. Shows rule_id, title, order, and draft status.
    Use this first to see what rules exist before editing."""
    return mcp_lib.list_rules_from_disk()


@mcp.tool
def get_rule(rule_id: str) -> dict | None:
    """Get full content of a specific rule (frontmatter YAML + markdown body).
    Returns the current disk version, not any pending draft."""
    return mcp_lib.read_rule_file(rule_id)


@mcp.tool
def get_draft(rule_id: str) -> dict | None:
    """Get the current draft for a rule, if one exists.
    Returns frontmatter_yaml, markdown_body, and order_override."""
    return mcp_lib.get_draft_from_db(rule_id)


@mcp.tool
def save_draft(rule_id: str, frontmatter_yaml: str, markdown_body: str, order_override: int | None = None) -> dict | None:
    """Save a draft for a rule. Does NOT modify the actual rule file yet.
    The draft will be visible in both MCP and the web UI.
    Use publish_drafts() after validation to apply changes.

    Args:
        rule_id: The rule's id field from frontmatter
        frontmatter_yaml: Complete YAML frontmatter (must include id, title, order)
        markdown_body: Rule content in markdown
        order_override: Optional new order position
    """
    return mcp_lib.save_draft_to_db(rule_id, frontmatter_yaml, markdown_body, order_override)


@mcp.tool
def delete_draft(rule_id: str) -> bool:
    """Delete a pending draft. The actual rule file is not affected."""
    return mcp_lib.delete_draft_from_db(rule_id)


@mcp.tool
def validate_drafts() -> list[dict]:
    """Validate all pending drafts. Checks for required frontmatter fields (id, title, order).
    Always call this before publish_drafts(). Returns list of issues found."""
    return mcp_lib.validate_all_drafts()


@mcp.tool
def publish_drafts() -> dict:
    """Publish all pending drafts to disk and rebuild ~/.claude/CLAUDE.md.
    THIS IS A DESTRUCTIVE OPERATION — always get user confirmation first.
    Steps: writes drafts to rules/*.md, runs assemble.py, clears drafts."""
    return mcp_lib.publish_all_drafts()


@mcp.tool
def get_claude_md() -> str | None:
    """Read the current ~/.claude/CLAUDE.md content. Returns None if file doesn't exist."""
    return mcp_lib.read_claude_md()


@mcp.tool
def get_publish_history(limit: int = 20) -> list[dict]:
    """Get recent publish history. Shows when rules were last published and if it succeeded."""
    return mcp_lib.get_publish_history_from_db(limit)


@mcp.tool
def list_snapshots() -> list[dict]:
    """List available snapshot files for rollback. Each snapshot is a full CLAUDE.md backup."""
    return mcp_lib.list_snapshot_files()


@mcp.tool
def record_citation(rule_id: str, matched_keyword: str, session_id: str | None = None) -> dict:
    """Record a rule citation when you explicitly reference a rule in your work.
    This is the highest-confidence citation source. Use when you consciously apply
    a rule from CLAUDE.md (e.g., following the surgical-changes principle).

    Args:
        rule_id: The rule's id field from frontmatter
        matched_keyword: The keyword or phrase that was referenced
        session_id: Optional session identifier (auto-generated if omitted)
    """
    return mcp_lib.record_citation(rule_id, matched_keyword, session_id)


if __name__ == "__main__":
    mcp.run()
