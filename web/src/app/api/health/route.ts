import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getTotalSessionCount } from '@/lib/db';

export async function GET() {
  const start = Date.now();
  try {
    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const sessions = getTotalSessionCount(undefined, db);
      return NextResponse.json({
        status: 'ok',
        sessions,
        response_ms: Date.now() - start,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'unknown' },
      { status: 503 },
    );
  }
}
