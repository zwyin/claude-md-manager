import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getRuleDetail, getTotalSessionCount, getTotalCitationCount } from '@/lib/db';
import { parseDays, sanitizeRuleId } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

function extractBody(sourceFile: string): string {
  const RULES_DIR = path.join(process.cwd(), '..', 'rules');
  try {
    const content = fs.readFileSync(path.join(RULES_DIR, sourceFile), 'utf-8');
    const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

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
      const body = extractBody(result.rule.source_file);

      return NextResponse.json({
        ...result,
        rule: { ...result.rule, body },
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
