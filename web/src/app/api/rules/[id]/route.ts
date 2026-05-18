import { NextRequest, NextResponse } from 'next/server';
import { getRuleDetail } from '@/lib/db';
import { parseDays, sanitizeRuleId } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));

    const result = getRuleDetail(sanitizeRuleId(id), days);

    if (!result) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch rule detail', details: String(error) },
      { status: 500 }
    );
  }
}
