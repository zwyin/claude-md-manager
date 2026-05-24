import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getFilteredSessions } from '@/lib/db';
import { parseDays } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200);
    const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
    const sort = searchParams.get('sort') ?? 'time';
    const dir = searchParams.get('dir') === 'asc' ? 'ASC' as const : 'DESC' as const;

    const search = searchParams.get('search')?.trim().toLowerCase() ?? '';
    const model = searchParams.get('model')?.trim() ?? '';
    const confidence = searchParams.get('confidence')?.trim() ?? '';

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const result = getFilteredSessions({ days, limit, offset, sort, dir, search, model, confidence }, db);
      return NextResponse.json({ ...result, limit, offset });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
