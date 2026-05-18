import { NextRequest, NextResponse } from 'next/server';
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

    const citations = getCitations({ rule_id, days, group_by });
    return NextResponse.json(citations);
  } catch (error) {
    return handleApiError(error);
  }
}
