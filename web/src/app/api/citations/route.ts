import { NextRequest, NextResponse } from 'next/server';
import { getCitations } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rule_id = searchParams.get('rule_id') || undefined;
    const days = searchParams.get('days')
      ? parseInt(searchParams.get('days')!, 10)
      : undefined;
    const group_by = (searchParams.get('group_by') as 'day' | 'week' | 'month') || 'day';

    const citations = getCitations({ rule_id, days, group_by });
    return NextResponse.json(citations);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch citations', details: String(error) },
      { status: 500 }
    );
  }
}
