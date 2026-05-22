#!/usr/bin/env python3
"""Export citation analytics report as markdown.

Usage:
    python scripts/export-report.py              # Print to stdout
    python scripts/export-report.py -o report.md # Write to file
    python scripts/export-report.py --days 30    # Last 30 days only
"""

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from hooks.db import get_db


def date_range(days: int | None):
    if days is None:
        return None
    return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")


def export_report(days: int | None = None) -> str:
    db = get_db()
    cutoff = date_range(days)

    # Section stats
    sections = db.execute(f"""
        SELECT s.section_id, s.title, COUNT(r.id) as refs,
               COUNT(DISTINCT r.session_id) as sessions
        FROM sections_metadata s
        LEFT JOIN rules_metadata rm ON rm.section_id = s.section_id
        LEFT JOIN rule_references r ON r.rule_id = rm.rule_id
        {"AND r.timestamp >= '" + cutoff + "'" if cutoff else ""}
        GROUP BY s.section_id
        ORDER BY refs DESC
    """).fetchall()

    # Top rules
    top_rules = db.execute(f"""
        SELECT rm.rule_id, rm.title, rm.section_id,
               COUNT(r.id) as refs,
               COUNT(DISTINCT r.session_id) as sessions
        FROM rules_metadata rm
        LEFT JOIN rule_references r ON r.rule_id = rm.rule_id
        {"WHERE r.timestamp >= '" + cutoff + "'" if cutoff else ""}
        GROUP BY rm.rule_id
        ORDER BY refs DESC
        LIMIT 20
    """).fetchall()

    # Cold rules (0 citations in period)
    cold_rules = db.execute(f"""
        SELECT rm.rule_id, rm.title, rm.section_id
        FROM rules_metadata rm
        WHERE rm.rule_id NOT IN (
            SELECT DISTINCT rule_id FROM rule_references r
            {"WHERE r.timestamp >= '" + cutoff + "'" if cutoff else ""}
        )
        ORDER BY rm.section_id, rm.title
    """).fetchall()

    # Confidence breakdown
    confidence = db.execute(f"""
        SELECT confidence, source, COUNT(*) as cnt
        FROM rule_references r
        {"WHERE r.timestamp >= '" + cutoff + "'" if cutoff else ""}
        GROUP BY confidence, source
        ORDER BY cnt DESC
    """).fetchall()

    # Totals
    total_refs = db.execute(f"""
        SELECT COUNT(*) FROM rule_references r
        {"WHERE r.timestamp >= '" + cutoff + "'" if cutoff else ""}
    """).fetchone()[0]
    total_sessions = db.execute(f"""
        SELECT COUNT(DISTINCT session_id) FROM rule_references r
        {"WHERE r.timestamp >= '" + cutoff + "'" if cutoff else ""}
    """).fetchone()[0]
    total_rules = db.execute("SELECT COUNT(*) FROM rules_metadata").fetchone()[0]

    # Build report
    period = f"Last {days} days" if days else "All time"
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        f"# CLAUDE.md Citation Report",
        f"",
        f"> Generated: {now} | Period: {period}",
        f"",
        f"## Summary",
        f"",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total rules | {total_rules} |",
        f"| Total citations | {total_refs} |",
        f"| Total sessions | {total_sessions} |",
        f"| Active rules | {total_rules - len(cold_rules)} ({100*(total_rules - len(cold_rules))//total_rules if total_rules else 0}%) |",
        f"| Cold rules | {len(cold_rules)} |",
        f"",
    ]

    # Section breakdown
    lines += [
        f"## Sections by Citations",
        f"",
        f"| Section | Citations | Sessions |",
        f"|---------|-----------|----------|",
    ]
    for sec_id, title, refs, sess in sections:
        lines.append(f"| {title or sec_id} | {refs} | {sess} |")
    lines.append("")

    # Top rules
    lines += [
        f"## Top 20 Rules",
        f"",
        f"| Rule | Section | Citations | Sessions |",
        f"|------|---------|-----------|----------|",
    ]
    for rule_id, title, sec_id, refs, sess in top_rules:
        lines.append(f"| {title or rule_id} | {sec_id} | {refs} | {sess} |")
    lines.append("")

    # Cold rules
    if cold_rules:
        lines += [
            f"## Cold Rules (no citations in period)",
            f"",
            f"| Rule | Section |",
            f"|------|---------|",
        ]
        for rule_id, title, sec_id in cold_rules:
            lines.append(f"| {title or rule_id} | {sec_id} |")
        lines.append("")

    # Confidence breakdown
    lines += [
        f"## Confidence Breakdown",
        f"",
        f"| Confidence | Source | Count |",
        f"|------------|--------|-------|",
    ]
    for conf, source, cnt in confidence:
        lines.append(f"| {conf} | {source} | {cnt} |")
    lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Export citation analytics report")
    parser.add_argument("-o", "--output", help="Output file path (default: stdout)")
    parser.add_argument("--days", type=int, default=None, help="Limit to last N days")
    args = parser.parse_args()

    report = export_report(args.days)

    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"Report written to {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
