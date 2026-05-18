import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getRulesWithStats, getSectionsWithStats, getTotalSessionCount } from '@/lib/db';
import { parseDays } from '@/lib/api-utils';
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

      return NextResponse.json({
        rules,
        sections: getSectionsWithStats(days, db),
        total_rules,
        total_sessions: getTotalSessionCount(days, db),
        active_rule_pct,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
