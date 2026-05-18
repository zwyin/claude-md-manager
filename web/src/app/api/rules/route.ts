import { NextRequest, NextResponse } from 'next/server';
import { getRulesWithStats, getSectionsWithStats, getTotalSessionCount } from '@/lib/db';
import { parseDays } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));

    const rules = getRulesWithStats(days);
    const total_rules = rules.length;
    const active_rules = rules.filter((r) => (r.citation_count || 0) > 0).length;
    const active_rule_pct = total_rules > 0 ? Math.round((active_rules / total_rules) * 100) : 0;

    return NextResponse.json({
      rules,
      sections: getSectionsWithStats(days),
      total_rules,
      total_sessions: getTotalSessionCount(days),
      active_rule_pct,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch rules', details: String(error) },
      { status: 500 }
    );
  }
}
