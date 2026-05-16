import { NextRequest, NextResponse } from 'next/server';
import { getRulesWithStats, getSectionsWithStats } from '@/lib/db';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = searchParams.get('days')
      ? parseInt(searchParams.get('days')!, 10)
      : undefined;

    const rules = getRulesWithStats(days);
    const total_rules = rules.length;
    const active_rules = rules.filter((r: any) => (r.citation_count || 0) > 0).length;
    const active_rule_pct = total_rules > 0 ? Math.round((active_rules / total_rules) * 100) : 0;

    const dbPath = path.join(process.cwd(), '..', 'data', 'usage.db');
    const db = new Database(dbPath, { readonly: true });
    const total_sessions = (db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any).count;
    db.close();

    return NextResponse.json({
      rules,
      sections: getSectionsWithStats(),
      total_rules,
      total_sessions,
      active_rule_pct,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch rules', details: String(error) },
      { status: 500 }
    );
  }
}
