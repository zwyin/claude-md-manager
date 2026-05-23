import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getRulesWithStats, getSectionsWithStats, getTotalSessionCount, getTotalCitationCount, getCitations, getRecentCitations, getSessionTrend } from '@/lib/db';
import { parseDays, zeroFillTrend } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

interface PublishEvent {
  id: number;
  published_at: string;
  rules_changed: number;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const rules = getRulesWithStats(days, db);
      const total_rules = rules.length;
      const active_rules = rules.filter((r) => (r.citation_count || 0) > 0).length;
      const active_rule_pct = total_rules > 0 ? Math.round((active_rules / total_rules) * 100) : 0;

      const total_citations = getTotalCitationCount(days, db);
      const total_sessions = getTotalSessionCount(days, db);
      const activeRules = rules.filter((r) => r.match_count > 0);
      const avg_coverage = activeRules.length > 0
        ? activeRules.reduce((s, r) => s + r.session_coverage, 0) / activeRules.length
        : 0;
      const avg_depth = activeRules.length > 0
        ? activeRules.reduce((s, r) => s + r.avg_depth, 0) / activeRules.length
        : 0;

      const citation_trend = zeroFillTrend(getCitations({ days, group_by: 'day' }, db), days);
      const session_trend = zeroFillTrend(getSessionTrend(days, db), days);
      const recent_citations = getRecentCitations(20, days, db);

      const recent_builds = db.prepare(
        "SELECT id, published_at, rules_changed, status FROM publish_history ORDER BY published_at DESC LIMIT 5"
      ).all() as PublishEvent[];

      const model_distribution = db.prepare(
        `SELECT model, COUNT(*) AS count FROM sessions WHERE model IS NOT NULL AND model != ''
         ${days ? `AND started_at >= datetime('now', ? || ' days')` : ''}
         GROUP BY model ORDER BY count DESC LIMIT 10`
      ).bind(...(days ? [`-${days}`] : [])).all() as { model: string; count: number }[];

      const recent_sessions = db.prepare(`
        SELECT s.session_id, s.started_at, s.ended_at, s.model, s.task_summary,
          COUNT(r.id) AS citation_count, COUNT(DISTINCT r.rule_id) AS rule_count,
          CASE WHEN s.started_at AND s.ended_at
            THEN CAST((julianday(s.ended_at) - julianday(s.started_at)) * 86400 AS INTEGER)
            ELSE 0 END AS duration_sec
        FROM sessions s LEFT JOIN rule_references r ON r.session_id = s.session_id
        ${days ? `WHERE s.started_at >= datetime('now', ? || ' days')` : ''}
        GROUP BY s.session_id ORDER BY s.started_at DESC LIMIT 8
      `).bind(...(days ? [`-${days}`] : [])).all();

      return NextResponse.json({
        rules,
        sections: getSectionsWithStats(days, db),
        total_rules,
        total_sessions,
        total_citations,
        active_rule_pct,
        avg_coverage,
        avg_depth,
        citation_trend,
        session_trend,
        recent_citations,
        recent_builds,
        model_distribution,
        recent_sessions,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
