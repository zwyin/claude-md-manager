import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getRulesWithStats, getSectionsWithStats, getTotalSessionCount, getTotalCitationCount, getCitations, getRecentCitations, getSessionTrend, getRecentBuilds, getModelDistribution, getRecentSessions } from '@/lib/db';
import { parseDays, zeroFillTrend } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

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
        recent_builds: getRecentBuilds(5, db),
        model_distribution: getModelDistribution(days, db),
        recent_sessions: getRecentSessions(8, days, db),
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
