import Database from 'better-sqlite3';
import path from 'path';
import type {
  RuleWithStats,
  CitationRecord,
  CitationTimePoint,
  AnalyticsData,
  TopRule,
  ColdRule,
  CategoryDistribution,
} from './types';

const DB_PATH = path.join(process.cwd(), '..', 'data', 'usage.db');

function getDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true });
}

// ── Sections ──

export interface SectionWithStats {
  section_id: string;
  title: string;
  source_file: string;
  rule_count: number;
  total_citations: number;
  total_sessions: number;
}

export function getSectionsWithStats(): SectionWithStats[] {
  const db = getDb();
  try {
    return db
      .prepare(
        `
        SELECT
          s.section_id,
          s.title,
          s.source_file,
          s.rule_count,
          COALESCE(SUM(citation_count), 0) AS total_citations,
          COALESCE(SUM(session_count), 0) AS total_sessions
        FROM sections_metadata s
        LEFT JOIN (
          SELECT section_id, COUNT(r.id) AS citation_count,
                 COUNT(DISTINCT r.session_id) AS session_count
          FROM rules_metadata m
          LEFT JOIN rule_references r ON r.rule_id = m.rule_id
          GROUP BY m.rule_id
        ) agg ON agg.section_id = s.section_id
        GROUP BY s.section_id
        ORDER BY total_citations DESC
        `
      )
      .all() as SectionWithStats[];
  } finally {
    db.close();
  }
}

// ── Rules ──

export function getRulesWithStats(days?: number): RuleWithStats[] {
  const db = getDb();
  try {
    const timeFilter = days
      ? `AND r.timestamp >= datetime('now', '-${days} days')`
      : '';

    const rows = db
      .prepare(
        `
        SELECT
          m.rule_id,
          m.section_id,
          s.title AS section_title,
          m.title,
          m.keywords,
          m.source_file,
          m.updated_at,
          COUNT(r.id) AS citation_count,
          COUNT(DISTINCT r.session_id) AS session_count,
          MAX(r.timestamp) AS last_cited
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${timeFilter}
        LEFT JOIN sections_metadata s ON s.section_id = m.section_id
        GROUP BY m.rule_id
        ORDER BY citation_count DESC, m.section_id
        `
      )
      .all() as Array<{
      rule_id: string;
      section_id: string;
      section_title: string;
      title: string;
      keywords: string;
      source_file: string;
      updated_at: string;
      citation_count: number;
      session_count: number;
      last_cited: string | null;
    }>;

    return rows.map((row) => ({
      ...row,
      keywords: JSON.parse(row.keywords || '[]'),
      session_count: row.session_count || 0,
      match_count: row.citation_count || 0,
    }));
  } finally {
    db.close();
  }
}

export function getRuleDetail(
  ruleId: string,
  days?: number
): { rule: RuleWithStats; citations: CitationRecord[]; siblings: Array<{ rule_id: string; title: string; match_count: number; session_count: number }> } | null {
  const db = getDb();
  try {
    const ruleRow = db
      .prepare('SELECT * FROM rules_metadata WHERE rule_id = ?')
      .get(ruleId) as {
      rule_id: string;
      section_id: string;
      title: string;
      keywords: string;
      source_file: string;
      updated_at: string;
    } | null;

    if (!ruleRow) return null;

    const timeFilter = days
      ? `AND r.timestamp >= datetime('now', '-${days} days')`
      : '';

    const citationCountRow = db
      .prepare(
        `SELECT COUNT(*) AS citation_count, MAX(timestamp) AS last_cited
         FROM rule_references WHERE rule_id = ? ${timeFilter}`
      )
      .get(ruleId) as { citation_count: number; last_cited: string | null };

    const citations = db
      .prepare(
        `
        SELECT r.id, r.rule_id, r.session_id, r.matched_keyword, r.timestamp,
               s.model, s.task_summary
        FROM rule_references r
        LEFT JOIN sessions s ON s.session_id = r.session_id
        WHERE r.rule_id = ? ${timeFilter}
        ORDER BY r.timestamp DESC
        `
      )
      .all(ruleId) as CitationRecord[];

    const siblings = db
      .prepare(
        `
        SELECT m.rule_id, m.title,
               COUNT(r.id) AS match_count,
               COUNT(DISTINCT r.session_id) AS session_count
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id
        WHERE m.section_id = ? AND m.rule_id != ?
        GROUP BY m.rule_id
        ORDER BY match_count DESC
        `
      )
      .all(ruleRow.section_id, ruleId) as Array<{
      rule_id: string; title: string; match_count: number; session_count: number;
    }>;

    return {
      rule: {
        ...ruleRow,
        keywords: JSON.parse(ruleRow.keywords || '[]'),
        citation_count: citationCountRow.citation_count,
        last_cited: citationCountRow.last_cited,
      },
      citations,
      siblings,
    };
  } finally {
    db.close();
  }
}

// ── Sessions ──

export function getTotalSessionCount(days?: number): number {
  const db = getDb();
  try {
    const timeFilter = days
      ? `WHERE started_at >= datetime('now', '-${days} days')`
      : '';
    return (
      db
        .prepare(`SELECT COUNT(*) AS c FROM sessions ${timeFilter}`)
        .get() as { c: number }
    ).c;
  } finally {
    db.close();
  }
}

// ── Citations ──

export function getCitations(filters: {
  rule_id?: string;
  days?: number;
  group_by?: 'day' | 'week' | 'month';
}): CitationTimePoint[] {
  const db = getDb();
  try {
    const { rule_id, days, group_by } = filters;

    let dateFormat: string;
    switch (group_by) {
      case 'week':
        dateFormat = "strftime('%Y-W%W', timestamp)";
        break;
      case 'month':
        dateFormat = "strftime('%Y-%m', timestamp)";
        break;
      default:
        dateFormat = "strftime('%Y-%m-%d', timestamp)";
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (rule_id) {
      conditions.push('rule_id = ?');
      params.push(rule_id);
    }
    if (days) {
      conditions.push(`timestamp >= datetime('now', '-${days} days')`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `
        SELECT ${dateFormat} AS period, COUNT(*) AS count
        FROM rule_references
        ${where}
        GROUP BY period
        ORDER BY period
        `
      )
      .bind(...params)
      .all() as CitationTimePoint[];

    return rows;
  } finally {
    db.close();
  }
}

// ── Analytics ──

export function getAnalytics(days?: number): AnalyticsData {
  const db = getDb();
  try {
    const subqueryFilter = days
      ? `WHERE timestamp >= datetime('now', '-${days} days')`
      : '';
    const joinFilter = days
      ? `AND r.timestamp >= datetime('now', '-${days} days')`
      : '';

    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM rules_metadata) AS total_rules,
        (SELECT COUNT(*) FROM rule_references ${subqueryFilter}) AS total_citations,
        (SELECT COUNT(DISTINCT session_id) FROM rule_references ${subqueryFilter}) AS total_sessions
    `).get() as { total_rules: number; total_citations: number; total_sessions: number };

    const topRules = db
      .prepare(
        `
        SELECT m.rule_id, m.title, COUNT(r.id) AS citation_count
        FROM rule_references r
        JOIN rules_metadata m ON m.rule_id = r.rule_id
        WHERE 1=1 ${joinFilter}
        GROUP BY m.rule_id
        ORDER BY citation_count DESC
        LIMIT 10
        `
      )
      .all() as TopRule[];

    const coldRules = db
      .prepare(
        `
        SELECT m.rule_id, m.title,
               CAST(julianday('now') - julianday(MAX(r.timestamp)) AS INTEGER) AS days_since_last_citation
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${joinFilter}
        GROUP BY m.rule_id
        HAVING COUNT(r.id) = 0 OR MAX(r.timestamp) IS NULL
        ORDER BY days_since_last_citation DESC
        LIMIT 20
        `
      )
      .all() as ColdRule[];

    const categoryDistribution = db
      .prepare(
        `
        SELECT m.section_id,
               COUNT(DISTINCT m.rule_id) AS rule_count,
               COUNT(r.id) AS citation_count
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${joinFilter}
        GROUP BY m.section_id
        ORDER BY citation_count DESC
        `
      )
      .all() as CategoryDistribution[];

    return {
      total_rules: stats.total_rules,
      total_citations: stats.total_citations,
      total_sessions: stats.total_sessions,
      top_rules: topRules,
      cold_rules: coldRules,
      category_distribution: categoryDistribution,
    };
  } finally {
    db.close();
  }
}
