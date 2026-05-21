import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getRuleDetail, getTotalSessionCount, getTotalCitationCount } from '@/lib/db';
import { parseDays, sanitizeRuleId } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const result = getRuleDetail(sanitizeRuleId(id), days, db);

      if (!result) {
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      const total_sessions = getTotalSessionCount(days, db);
      const total_citations = getTotalCitationCount(days, db);

      return NextResponse.json({
        ...result,
        total_sessions,
        total_citations,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
