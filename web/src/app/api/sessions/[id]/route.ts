import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { handleApiError } from '@/lib/api-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sessionId = decodeURIComponent(id);

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const session = db.prepare(
        'SELECT session_id, started_at, ended_at, model, task_summary FROM sessions WHERE session_id = ?'
      ).get(sessionId) as Record<string, unknown> | undefined;

      const citations = db.prepare(`
        SELECT r.rule_id, m.title, m.section_id, r.matched_keyword, r.confidence, r.timestamp
        FROM rule_references r
        JOIN rules_metadata m ON m.rule_id = r.rule_id
        WHERE r.session_id = ?
        ORDER BY r.timestamp ASC
      `).all(sessionId);

      const sections = db.prepare(`
        SELECT DISTINCT m.section_id, COALESCE(s.title, m.section_id) AS section_title
        FROM rule_references r
        JOIN rules_metadata m ON m.rule_id = r.rule_id
        LEFT JOIN sections_metadata s ON s.section_id = m.section_id
        WHERE r.session_id = ?
        ORDER BY section_title
      `).all(sessionId);

      return NextResponse.json({
        session: session ?? { session_id: sessionId },
        citations,
        sections,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
