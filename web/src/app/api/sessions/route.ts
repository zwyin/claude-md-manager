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
    const sort = searchParams.get('sort') ?? 'time';
    const dir = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';

    const validSorts: Record<string, string> = {
      time: 's.started_at',
      citations: 'citation_count',
      rules: 'rule_count',
      duration: 'duration_sec',
    };
    const orderCol = validSorts[sort] ?? validSorts.time;

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
          s.task_summary,
          COUNT(r.id) AS citation_count,
          COUNT(DISTINCT r.rule_id) AS rule_count,
          CASE WHEN s.started_at AND s.ended_at
            THEN CAST((julianday(s.ended_at) - julianday(s.started_at)) * 86400 AS INTEGER)
            ELSE 0 END AS duration_sec
        FROM sessions s
        LEFT JOIN rule_references r ON r.session_id = s.session_id
        WHERE 1=1 ${timeFilter}
        GROUP BY s.session_id
        ORDER BY ${orderCol} ${dir}
        LIMIT ? OFFSET ?
      `).bind(...params).all() as Array<{
        session_id: string;
        started_at: string | null;
        ended_at: string | null;
        model: string | null;
        citation_count: number;
        rule_count: number;
        duration_sec: number;
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
