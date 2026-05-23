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

    const search = searchParams.get('search')?.trim().toLowerCase() ?? '';
    const model = searchParams.get('model')?.trim() ?? '';
    const confidence = searchParams.get('confidence')?.trim() ?? '';

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const timeFilter = days ? `AND s.started_at >= datetime('now', ? || ' days')` : '';
      const searchFilter = search
        ? `AND (LOWER(s.session_id) LIKE ? OR LOWER(s.task_summary) LIKE ?)`
        : '';
      const modelFilter = model ? `AND s.model = ?` : '';
      const confidenceFilter = confidence ? `AND EXISTS (SELECT 1 FROM rule_references rr WHERE rr.session_id = s.session_id AND rr.confidence = ?)` : '';
      const searchParam = search ? `%${search}%` : '';
      const baseParams = [
        ...(days ? [`-${days}`] : []),
        ...(search ? [searchParam, searchParam] : []),
        ...(model ? [model] : []),
        ...(confidence ? [confidence] : []),
      ];
      const params = [...baseParams, limit, offset];

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
        WHERE 1=1 ${timeFilter} ${searchFilter} ${modelFilter} ${confidenceFilter}
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
        WHERE 1=1
        ${days ? "AND started_at >= datetime('now', ? || ' days')" : ''}
        ${search ? "AND (LOWER(session_id) LIKE ? OR LOWER(task_summary) LIKE ?)" : ''}
        ${model ? "AND model = ?" : ''}
        ${confidence ? "AND EXISTS (SELECT 1 FROM rule_references rr WHERE rr.session_id = session_id AND rr.confidence = ?)" : ''}
      `).bind(...baseParams).get() as { total: number };

      const statsResult = db.prepare(`
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

      const models = db.prepare(
        `SELECT DISTINCT model FROM sessions WHERE model IS NOT NULL AND model != '' ORDER BY model`
      ).all() as { model: string }[];

      return NextResponse.json({
        sessions,
        total: totalResult.total,
        avg_duration: statsResult.avg_duration ? Math.round(statsResult.avg_duration) : null,
        avg_citations: statsResult.avg_citations ? Math.round(statsResult.avg_citations * 10) / 10 : null,
        models: models.map((m) => m.model),
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
