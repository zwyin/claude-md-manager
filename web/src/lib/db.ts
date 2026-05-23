import Database from 'better-sqlite3';
import path from 'path';
import type {
  RuleWithStats,
  RuleDetail,
  SiblingRule,
  CoOccurringRule,
  SectionWithStats,
  CitationRecord,
  CitationTimePoint,
  AnalyticsData,
  TopRule,
  ColdRule,
  CategoryDistribution,
  HeatmapCell,
  ConfidenceDistribution,
  PublishEvent,
  ModelDistribution,
  RecentSession,
  RecentCitation,
  SessionCitation,
  SessionSection,
  Session,
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
): { rule: RuleDetail; citations: CitationRecord[]; siblings: SiblingRule[]; co_occurring: CoOccurringRule[] } | null {
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

    const sectionTitle = conn
      .prepare('SELECT title FROM sections_metadata WHERE section_id = ?')
      .get(ruleRow.section_id) as { title: string } | null;

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
        SELECT r.id, r.rule_id, r.session_id, r.matched_keyword, r.confidence, r.timestamp,
               s.model, s.task_summary
        FROM rule_references r
        LEFT JOIN sessions s ON s.session_id = r.session_id
        WHERE r.rule_id = ? ${timeFilter}
        ORDER BY r.timestamp DESC
        `
      )
      .bind(ruleId, ...timeParams)
      .all() as CitationRecord[];

    const totalSessionsForSiblings = getTotalSessionCount(days, conn);
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

    const siblingsWithStats = siblings.map((s) => ({
      ...s,
      session_coverage: totalSessionsForSiblings > 0 ? s.session_count / totalSessionsForSiblings : 0,
      avg_depth: s.session_count > 0 ? s.match_count / s.session_count : 0,
    }));

    // Co-occurring rules: rules from OTHER sections cited in the same sessions
    const coTimeFilter = days ? `AND r1.timestamp >= datetime('now', ? || ' days')` : '';
    const coOccurring = conn
      .prepare(
        `
        SELECT m.rule_id, m.title, m.section_id,
               COUNT(DISTINCT r2.session_id) AS co_sessions,
               COUNT(*) AS total_matches
        FROM rule_references r1
        JOIN rule_references r2 ON r1.session_id = r2.session_id AND r2.rule_id != ?
        JOIN rules_metadata m ON m.rule_id = r2.rule_id AND m.section_id != ?
        WHERE r1.rule_id = ? ${coTimeFilter}
        GROUP BY m.rule_id
        ORDER BY co_sessions DESC
        LIMIT 10
        `
      )
      .bind(ruleId, ruleRow.section_id, ruleId, ...timeParams)
      .all() as CoOccurringRule[];

    return {
      rule: {
        ...ruleRow,
        section_title: sectionTitle?.title ?? ruleRow.section_id,
        keywords: JSON.parse(ruleRow.keywords || '[]'),
        citation_count: citationCountRow.citation_count,
        last_cited: citationCountRow.last_cited,
      },
      citations,
      siblings: siblingsWithStats,
      co_occurring: coOccurring,
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

export function getSessionTrend(days: number | undefined, db: Database.Database): { period: string; count: number }[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (days) {
    conditions.push(`started_at >= datetime('now', ? || ' days')`);
    params.push(`-${days}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(
    `SELECT strftime('%Y-%m-%d', started_at) AS period, COUNT(*) AS count
     FROM sessions ${where}
     GROUP BY period ORDER BY period`
  ).bind(...params).all() as { period: string; count: number }[];
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

export function getAnalytics(days?: number, db?: Database.Database): Omit<AnalyticsData, 'citation_trend' | 'heatmap' | 'confidence_distribution'> {
  const own = !db;
  const conn = db || getDb();
  try {
    const subqueryFilter = days
      ? `WHERE timestamp >= datetime('now', ? || ' days')`
      : '';
    const joinFilter = days
      ? `AND r.timestamp >= datetime('now', ? || ' days')`
      : '';
    const statsParams = days ? [`-${days}`] : [];
    const joinParams = days ? [`-${days}`] : [];

    const stats = conn.prepare(`
      SELECT
        (SELECT COUNT(*) FROM rules_metadata) AS total_rules,
        (SELECT COUNT(*) FROM rule_references ${subqueryFilter}) AS total_citations
    `).bind(...statsParams).get() as { total_rules: number; total_citations: number };

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

    const coldRules = conn
      .prepare(
        `
        SELECT m.rule_id, m.title, m.section_id,
               COUNT(r.id) AS citation_count,
               COUNT(DISTINCT r.session_id) AS session_count,
               MAX(r.timestamp) AS last_cited
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${joinFilter}
        GROUP BY m.rule_id
        ORDER BY citation_count ASC, m.rule_id
        LIMIT 20
        `
      )
      .bind(...joinParams)
      .all() as ColdRule[];

    const categoryDistribution = conn
      .prepare(
        `
        SELECT m.section_id,
               COALESCE(s.title, m.section_id) AS title,
               COUNT(DISTINCT m.rule_id) AS rule_count,
               COUNT(r.id) AS citation_count
        FROM rules_metadata m
        LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${joinFilter}
        LEFT JOIN sections_metadata s ON s.section_id = m.section_id
        GROUP BY m.section_id
        ORDER BY citation_count DESC
        `
      )
      .bind(...joinParams)
      .all() as CategoryDistribution[];

    // Compute avg coverage/depth across all active rules in a single aggregation
    const aggStats = conn
      .prepare(
        `
        SELECT
          COUNT(*) AS active_rule_count,
          SUM(CASE WHEN ? > 0 THEN CAST(sessions_per_rule AS REAL) / ? ELSE 0 END) AS sum_coverage,
          SUM(CASE WHEN sessions_per_rule > 0 THEN CAST(citations_per_rule AS REAL) / sessions_per_rule ELSE 0 END) AS sum_depth
        FROM (
          SELECT
            COUNT(r.id) AS citations_per_rule,
            COUNT(DISTINCT r.session_id) AS sessions_per_rule
          FROM rules_metadata m
          LEFT JOIN rule_references r ON r.rule_id = m.rule_id ${joinFilter}
          GROUP BY m.rule_id
          HAVING citations_per_rule > 0
        )
        `
      )
      .bind(totalSessions, totalSessions, ...joinParams)
      .get() as { active_rule_count: number; sum_coverage: number; sum_depth: number };

    const avgCoverage = (aggStats?.active_rule_count ?? 0) > 0
      ? (aggStats?.sum_coverage ?? 0) / aggStats.active_rule_count
      : 0;
    const avgDepth = (aggStats?.active_rule_count ?? 0) > 0
      ? (aggStats?.sum_depth ?? 0) / aggStats.active_rule_count
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

export function getRecentCitations(limit: number, days?: number, db?: Database.Database): RecentCitation[] {
  const own = !db;
  const conn = db || getDb();
  try {
    const timeFilter = days ? `AND r.timestamp >= datetime('now', ? || ' days')` : '';
    const params = days ? [`-${days}`, limit] : [limit];
    return conn
      .prepare(
        `SELECT r.rule_id, m.title, m.section_id, r.matched_keyword, r.timestamp, r.session_id, s.model, r.confidence
         FROM rule_references r
         JOIN rules_metadata m ON m.rule_id = r.rule_id
         LEFT JOIN sessions s ON s.session_id = r.session_id
         WHERE 1=1 ${timeFilter}
         ORDER BY r.timestamp DESC
         LIMIT ?`
      )
      .bind(...params).all() as RecentCitation[];
  } finally {
    if (own) conn.close();
  }
}

export function getHeatmapData(days: number | undefined, limit: number, db?: Database.Database): HeatmapCell[] {
  const own = !db;
  const conn = db || getDb();
  try {
    const timeFilter = days
      ? `AND r.timestamp >= datetime('now', ? || ' days')`
      : '';
    const params = days ? [`-${days}`] : [];

    return conn.prepare(`
      SELECT m.rule_id, m.title, m.section_id,
             DATE(r.timestamp) AS day,
             COUNT(*) AS count
      FROM rule_references r
      JOIN rules_metadata m ON m.rule_id = r.rule_id
      WHERE 1=1 ${timeFilter}
      GROUP BY m.rule_id, day
      ORDER BY count DESC
      LIMIT ?
    `).bind(...params, limit * 90).all() as HeatmapCell[];
  } finally {
    if (own) conn.close();
  }
}

// ── Dashboard extras ──

export function getRecentBuilds(limit: number, db?: Database.Database): PublishEvent[] {
  const own = !db;
  const conn = db || getDb();
  try {
    return conn.prepare(
      'SELECT id, published_at, rules_changed, status FROM publish_history ORDER BY published_at DESC LIMIT ?'
    ).bind(limit).all() as PublishEvent[];
  } finally {
    if (own) conn.close();
  }
}

export function getModelDistribution(days: number | undefined, db?: Database.Database): ModelDistribution[] {
  const own = !db;
  const conn = db || getDb();
  try {
    const timeFilter = days ? `AND started_at >= datetime('now', ? || ' days')` : '';
    const params = days ? [`-${days}`] : [];
    return conn.prepare(
      `SELECT model, COUNT(*) AS count FROM sessions
       WHERE model IS NOT NULL AND model != '' ${timeFilter}
       GROUP BY model ORDER BY count DESC LIMIT 10`
    ).bind(...params).all() as ModelDistribution[];
  } finally {
    if (own) conn.close();
  }
}

export function getRecentSessions(limit: number, days: number | undefined, db?: Database.Database): RecentSession[] {
  const own = !db;
  const conn = db || getDb();
  try {
    const timeFilter = days ? `WHERE started_at >= datetime('now', ? || ' days')` : '';
    const params = days ? [`-${days}`] : [];
    const sessions = conn.prepare(`
      SELECT session_id, started_at, ended_at, model, task_summary
      FROM sessions ${timeFilter}
      ORDER BY started_at DESC LIMIT ?
    `).bind(...params, limit).all() as RecentSession[];

    const statsStmt = conn.prepare(
      `SELECT COUNT(*) AS citation_count, COUNT(DISTINCT rule_id) AS rule_count FROM rule_references WHERE session_id = ?`
    );
    return sessions.map((s) => {
      const stats = statsStmt.get(s.session_id) as { citation_count: number; rule_count: number };
      return {
        ...s,
        citation_count: stats.citation_count,
        rule_count: stats.rule_count,
        duration_sec: s.started_at && s.ended_at
          ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000)
          : 0,
      };
    });
  } finally {
    if (own) conn.close();
  }
}

// ── Confidence distribution ──

export function getConfidenceDistribution(days: number | undefined, db?: Database.Database): ConfidenceDistribution[] {
  const own = !db;
  const conn = db || getDb();
  try {
    const timeFilter = days ? `WHERE r.timestamp >= datetime('now', ? || ' days')` : '';
    const params = days ? [`-${days}`] : [];

    const rows = conn.prepare(`
      SELECT confidence, rule_id, title, per_conf_count, rule_count,
             ROW_NUMBER() OVER (PARTITION BY confidence ORDER BY rule_count DESC) AS rn
      FROM (
        SELECT r.confidence, r.rule_id, m.title,
               COUNT(*) OVER (PARTITION BY r.confidence) AS per_conf_count,
               COUNT(*) AS rule_count
        FROM rule_references r
        JOIN rules_metadata m ON m.rule_id = r.rule_id
        ${timeFilter}
        GROUP BY r.confidence, r.rule_id
      )
      ORDER BY per_conf_count DESC, rn ASC
    `).bind(...params).all() as {
      confidence: string; rule_id: string; title: string;
      per_conf_count: number; rule_count: number; rn: number;
    }[];

    const grouped: Record<string, { confidence: string; count: number; top_rules: { rule_id: string; title: string; count: number }[] }> = {};
    for (const row of rows) {
      if (!grouped[row.confidence]) {
        grouped[row.confidence] = { confidence: row.confidence, count: row.per_conf_count, top_rules: [] };
      }
      if (row.rn <= 5) {
        grouped[row.confidence].top_rules.push({ rule_id: row.rule_id, title: row.title, count: row.rule_count });
      }
    }
    return Object.values(grouped).sort((a, b) => b.count - a.count);
  } finally {
    if (own) conn.close();
  }
}

// ── Session detail ──

export function getSessionDetail(
  sessionId: string,
  db?: Database.Database,
): { session: Session; citations: SessionCitation[]; sections: SessionSection[] } {
  const own = !db;
  const conn = db || getDb();
  try {
    const session = conn.prepare(
      'SELECT session_id, started_at, ended_at, model, task_summary FROM sessions WHERE session_id = ?'
    ).get(sessionId) as Session | undefined;

    const citations = conn.prepare(`
      SELECT r.rule_id, m.title, m.section_id, r.matched_keyword, r.confidence, r.timestamp
      FROM rule_references r
      JOIN rules_metadata m ON m.rule_id = r.rule_id
      WHERE r.session_id = ?
      ORDER BY r.timestamp ASC
    `).all(sessionId) as SessionCitation[];

    const sections = conn.prepare(`
      SELECT DISTINCT m.section_id, COALESCE(s.title, m.section_id) AS section_title
      FROM rule_references r
      JOIN rules_metadata m ON m.rule_id = r.rule_id
      LEFT JOIN sections_metadata s ON s.section_id = m.section_id
      WHERE r.session_id = ?
      ORDER BY section_title
    `).all(sessionId) as SessionSection[];

    return {
      session: session ?? { session_id: sessionId, started_at: null, ended_at: null, model: null, task_summary: null },
      citations,
      sections,
    };
  } finally {
    if (own) conn.close();
  }
}

// ── Filtered sessions list ──

export function getFilteredSessions(
  opts: {
    days?: number;
    limit: number;
    offset: number;
    sort: string;
    dir: 'ASC' | 'DESC';
    search?: string;
    model?: string;
    confidence?: string;
  },
  db?: Database.Database,
): { sessions: RecentSession[]; total: number; avg_duration: number | null; avg_citations: number | null; models: string[] } {
  const own = !db;
  const conn = db || getDb();
  try {
    const { days, limit, offset, search, model, confidence } = opts;
    const dir = opts.dir;
    const validSorts: Record<string, string> = {
      time: 's.started_at', citations: 'citation_count', rules: 'rule_count', duration: 'duration_sec',
    };
    const orderCol = validSorts[opts.sort] ?? validSorts.time;

    const timeFilter = days ? `AND s.started_at >= datetime('now', ? || ' days')` : '';
    const searchFilter = search ? `AND (LOWER(s.session_id) LIKE ? OR LOWER(s.task_summary) LIKE ?)` : '';
    const modelFilter = model ? `AND s.model = ?` : '';
    const confidenceFilter = confidence ? `AND EXISTS (SELECT 1 FROM rule_references rr WHERE rr.session_id = s.session_id AND rr.confidence = ?)` : '';
    const searchParam = search ? `%${search}%` : '';
    const baseParams = [
      ...(days ? [`-${days}`] : []),
      ...(search ? [searchParam, searchParam] : []),
      ...(model ? [model] : []),
      ...(confidence ? [confidence] : []),
    ];

    const sessions = conn.prepare(`
      SELECT s.session_id, s.started_at, s.ended_at, s.model, s.task_summary,
        COUNT(r.id) AS citation_count, COUNT(DISTINCT r.rule_id) AS rule_count,
        CASE WHEN s.started_at AND s.ended_at
          THEN CAST((julianday(s.ended_at) - julianday(s.started_at)) * 86400 AS INTEGER)
          ELSE 0 END AS duration_sec
      FROM sessions s LEFT JOIN rule_references r ON r.session_id = s.session_id
      WHERE 1=1 ${timeFilter} ${searchFilter} ${modelFilter} ${confidenceFilter}
      GROUP BY s.session_id ORDER BY ${orderCol} ${dir} LIMIT ? OFFSET ?
    `).bind(...baseParams, limit, offset).all() as RecentSession[];

    const totalResult = conn.prepare(`
      SELECT COUNT(*) AS total FROM sessions WHERE 1=1
      ${days ? "AND started_at >= datetime('now', ? || ' days')" : ''}
      ${search ? "AND (LOWER(session_id) LIKE ? OR LOWER(task_summary) LIKE ?)" : ''}
      ${model ? "AND model = ?" : ''}
      ${confidence ? "AND EXISTS (SELECT 1 FROM rule_references rr WHERE rr.session_id = session_id AND rr.confidence = ?)" : ''}
    `).bind(...baseParams).get() as { total: number };

    const statsResult = conn.prepare(`
      SELECT
        AVG(CASE WHEN s.started_at AND s.ended_at
          THEN (julianday(s.ended_at) - julianday(s.started_at)) * 86400 ELSE NULL END) AS avg_duration,
        AVG(sub.cnt) AS avg_citations
      FROM sessions s
      LEFT JOIN (SELECT session_id, COUNT(*) AS cnt FROM rule_references GROUP BY session_id) sub ON sub.session_id = s.session_id
      WHERE 1=1
      ${days ? "AND s.started_at >= datetime('now', ? || ' days')" : ''}
      ${search ? "AND (LOWER(s.session_id) LIKE ? OR LOWER(s.task_summary) LIKE ?)" : ''}
      ${model ? "AND s.model = ?" : ''}
      ${confidence ? "AND EXISTS (SELECT 1 FROM rule_references rr WHERE rr.session_id = s.session_id AND rr.confidence = ?)" : ''}
    `).bind(...baseParams).get() as { avg_duration: number | null; avg_citations: number | null };

    const models = conn.prepare(
      "SELECT DISTINCT model FROM sessions WHERE model IS NOT NULL AND model != '' ORDER BY model"
    ).all() as { model: string }[];

    return {
      sessions,
      total: totalResult.total,
      avg_duration: statsResult.avg_duration ? Math.round(statsResult.avg_duration) : null,
      avg_citations: statsResult.avg_citations ? Math.round(statsResult.avg_citations * 10) / 10 : null,
      models: models.map((m) => m.model),
    };
  } finally {
    if (own) conn.close();
  }
}
