import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getCitations } from '@/lib/db';
import { parseDays, parseEnum, sanitizeRuleId } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawRuleId = searchParams.get('rule_id') || undefined;
    const rule_id = rawRuleId ? sanitizeRuleId(rawRuleId) : undefined;
    const days = parseDays(searchParams.get('days'));
    const group_by = parseEnum(searchParams.get('group_by'), ['day', 'week', 'month'] as const, 'day');

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const citations = getCitations({ rule_id, days, group_by }, db);
      return NextResponse.json(citations);
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
