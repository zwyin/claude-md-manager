import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET() {
  const start = Date.now();
  try {
    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const { total } = db.prepare('SELECT COUNT(*) AS total FROM sessions').get() as { total: number };
      return NextResponse.json({
        status: 'ok',
        sessions: total,
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
