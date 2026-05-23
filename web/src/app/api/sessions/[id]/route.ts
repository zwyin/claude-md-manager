import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getSessionDetail } from '@/lib/db';
import { handleApiError } from '@/lib/api-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sessionId = decodeURIComponent(id);

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const detail = getSessionDetail(sessionId, db);
      return NextResponse.json(detail);
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
