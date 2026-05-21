import Database from 'better-sqlite3';
import path from 'path';
import type {
  RuleWithStats,
  RuleDetail,
  SiblingRule,
  SectionWithStats,
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

export function getSectionsWithStats(days?: number, db?: Database.Database): SectionWithStats[] {
  const own = !db;
  const conn = db || getDb();
  try {
    const timeFilter = days
      ? `AND r.timestamp >= datetime('now', ? || ' days')`
      : '';
    const params = days ? [`-${days}`] : [];

    return conn
      .prepare(
        `
        SELECT
          s.section_id,
          s.title,
          s.source_file,
          s.rule_count,
          COUNT(r.id) AS total_citations,
          COUNT(DISTINCT r.session_id) AS total_sessions
        FROM sections_metadata s
        LEFT JOIN rules_metadata m ON m.section_id = s.section_id
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${timeFilter}
        GROUP BY s.section_id
        ORDER BY total_citations DESC
        `
      )
      .bind(...params)
      .all() as SectionWithStats[];
  } finally {
    if (own) conn.close();
  }
}

// ── Rules ──

export function getRulesWithStats(days?: number, db?: Database.Database): RuleWithStats[] {
  const own = !db;
  const conn = db || getDb();
  try {
    const timeFilter = days
      ? `AND r.timestamp >= datetime('now', ? || ' days')`
      : '';
    const params = days ? [`-${days}`] : [];

    const rows = conn
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
      .bind(...params)
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

    const totalCitations = rows.reduce((s, r) => s + (r.citation_count || 0), 0);
    const totalSessions = getTotalSessionCount(days, conn);

    return rows.map((row) => {
      const mc = row.citation_count || 0;
      const sc = row.session_count || 0;
      return {
        ...row,
        keywords: JSON.parse(row.keywords || '[]'),
        session_count: sc,
        match_count: mc,
        session_coverage: totalSessions > 0 ? sc / totalSessions : 0,
        avg_depth: sc > 0 ? mc / sc : 0,
        citation_share: totalCitations > 0 ? mc / totalCitations : 0,
      };
    });
  } finally {
    if (own) conn.close();
  }
}

export function getRuleDetail(
  ruleId: string,
  days?: number,
  db?: Database.Database
): { rule: RuleDetail; citations: CitationRecord[]; siblings: SiblingRule[] } | null {
  const own = !db;
  const conn = db || getDb();
  try {
    const ruleRow = conn
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
      ? `AND r.timestamp >= datetime('now', ? || ' days')`
      : '';
    const timeParams = days ? [`-${days}`] : [];

    const citationCountRow = conn
      .prepare(
        `SELECT COUNT(*) AS citation_count, MAX(r.timestamp) AS last_cited
         FROM rule_references r WHERE r.rule_id = ? ${timeFilter}`
      )
      .bind(ruleId, ...timeParams)
      .get() as { citation_count: number; last_cited: string | null };

    const citations = conn
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
      .bind(ruleId, ...timeParams)
      .all() as CitationRecord[];

    const siblings = conn
      .prepare(
        `
        SELECT m.rule_id, m.title,
               COUNT(r.id) AS match_count,
               COUNT(DISTINCT r.session_id) AS session_count
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${timeFilter}
        WHERE m.section_id = ? AND m.rule_id != ?
        GROUP BY m.rule_id
        ORDER BY match_count DESC
        `
      )
      .bind(...timeParams, ruleRow.section_id, ruleId)
      .all() as Array<{
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
    if (own) conn.close();
  }
}

// ── Global totals ──

export function getTotalCitationCount(days?: number, db?: Database.Database): number {
  const own = !db;
  const conn = db || getDb();
  try {
    if (days) {
      return (
        conn
          .prepare(`SELECT COUNT(*) AS c FROM rule_references WHERE timestamp >= datetime('now', ? || ' days')`)
          .get(`-${days}`) as { c: number }
      ).c;
    }
    return (conn.prepare('SELECT COUNT(*) AS c FROM rule_references').get() as { c: number }).c;
  } finally {
    if (own) conn.close();
  }
}

// ── Sessions ──

export function getTotalSessionCount(days?: number, db?: Database.Database): number {
  const own = !db;
  const conn = db || getDb();
  try {
    if (days) {
      return (
        conn
          .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE started_at >= datetime('now', ? || ' days')`)
          .get(`-${days}`) as { c: number }
      ).c;
    }
    return (conn.prepare('SELECT COUNT(*) AS c FROM sessions').get() as { c: number }).c;
  } finally {
    if (own) conn.close();
  }
}

// ── Citations ──

export function getCitations(filters: {
  rule_id?: string;
  days?: number;
  group_by?: 'day' | 'week' | 'month';
}, db?: Database.Database): CitationTimePoint[] {
  const own = !db;
  const conn = db || getDb();
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
      conditions.push(`timestamp >= datetime('now', ? || ' days')`);
      params.push(`-${days}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = conn
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
    if (own) conn.close();
  }
}

// ── Analytics ──

export function getAnalytics(days?: number, db?: Database.Database): Omit<AnalyticsData, 'citation_trend'> {
  const own = !db;
  const conn = db || getDb();
  try {
    const subqueryFilter = days
      ? `WHERE timestamp >= datetime('now', ? || ' days')`
      : '';
    const joinFilter = days
      ? `AND r.timestamp >= datetime('now', ? || ' days')`
      : '';
    const statsParams = days ? [`-${days}`, `-${days}`] : [];
    const joinParams = days ? [`-${days}`] : [];

    const stats = conn.prepare(`
      SELECT
        (SELECT COUNT(*) FROM rules_metadata) AS total_rules,
        (SELECT COUNT(*) FROM rule_references ${subqueryFilter}) AS total_citations
    `).bind(...statsParams.slice(0, days ? 1 : 0)).get() as { total_rules: number; total_citations: number };

    const totalSessions = getTotalSessionCount(days, conn);

    const topRules = conn
      .prepare(
        `
        SELECT m.rule_id, m.title,
               COUNT(r.id) AS citation_count,
               COUNT(DISTINCT r.session_id) AS session_count
        FROM rule_references r
        JOIN rules_metadata m ON m.rule_id = r.rule_id
        WHERE 1=1 ${joinFilter}
        GROUP BY m.rule_id
        ORDER BY citation_count DESC
        LIMIT 10
        `
      )
      .bind(...joinParams)
      .all() as Array<TopRule & { session_count: number }>;

    const topRulesWithMetrics: TopRule[] = topRules.map((r) => ({
      rule_id: r.rule_id,
      title: r.title,
      citation_count: r.citation_count,
      session_coverage: totalSessions > 0 ? r.session_count / totalSessions : 0,
      avg_depth: r.session_count > 0 ? r.citation_count / r.session_count : 0,
    }));

    const havingClause = days
      ? `HAVING MAX(r.timestamp) IS NULL OR MAX(r.timestamp) < datetime('now', ? || ' days')`
      : 'HAVING MAX(r.timestamp) IS NULL';
    const coldParams = days ? [`-${days}`] : [];

    const coldRules = conn
      .prepare(
        `
        SELECT m.rule_id, m.title,
               CAST(julianday('now') - julianday(MAX(r.timestamp)) AS INTEGER) AS days_since_last_citation
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id
        GROUP BY m.rule_id
        ${havingClause}
        ORDER BY days_since_last_citation DESC
        LIMIT 20
        `
      )
      .bind(...coldParams)
      .all() as ColdRule[];

    const categoryDistribution = conn
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
      .bind(...joinParams)
      .all() as CategoryDistribution[];

    // Compute per-rule coverage/depth for all rules (not just top 10)
    const allRulesStats = conn
      .prepare(
        `
        SELECT COUNT(r.id) AS citation_count,
               COUNT(DISTINCT r.session_id) AS session_count
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${joinFilter}
        GROUP BY m.rule_id
        HAVING citation_count > 0
        `
      )
      .bind(...joinParams)
      .all() as Array<{ citation_count: number; session_count: number }>;

    const avgCoverage = allRulesStats.length > 0
      ? allRulesStats.reduce((s, r) => s + (totalSessions > 0 ? r.session_count / totalSessions : 0), 0) / allRulesStats.length
      : 0;
    const avgDepth = allRulesStats.length > 0
      ? allRulesStats.reduce((s, r) => s + (r.session_count > 0 ? r.citation_count / r.session_count : 0), 0) / allRulesStats.length
      : 0;

    return {
      total_rules: stats.total_rules,
      total_citations: stats.total_citations,
      total_sessions: totalSessions,
      avg_coverage: avgCoverage,
      avg_depth: avgDepth,
      top_rules: topRulesWithMetrics,
      cold_rules: coldRules,
      category_distribution: categoryDistribution,
    };
  } finally {
    if (own) conn.close();
  }
}
