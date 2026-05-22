import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { parseDays } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50'), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0);

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const timeFilter = days ? `AND s.started_at >= datetime('now', ? || ' days')` : '';
      const params = days ? [`-${days}`, limit, offset] : [limit, offset];

      const sessions = db.prepare(`
        SELECT
          s.session_id,
          s.started_at,
          s.ended_at,
          s.model,
          COUNT(r.id) AS citation_count,
          COUNT(DISTINCT r.rule_id) AS rule_count
        FROM sessions s
        LEFT JOIN rule_references r ON r.session_id = s.session_id
        WHERE 1=1 ${timeFilter}
        GROUP BY s.session_id
        ORDER BY s.started_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params).all() as Array<{
        session_id: string;
        started_at: string | null;
        ended_at: string | null;
        model: string | null;
        citation_count: number;
        rule_count: number;
      }>;

      const totalResult = db.prepare(`
        SELECT COUNT(*) AS total FROM sessions
        ${days ? "WHERE started_at >= datetime('now', ? || ' days')" : ''}
      `).bind(...(days ? [`-${days}`] : [])).get() as { total: number };

      return NextResponse.json({
        sessions,
        total: totalResult.total,
        limit,
        offset,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
