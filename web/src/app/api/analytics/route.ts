import { NextRequest, NextResponse } from 'next/server';
import { getAnalytics, getCitations } from '@/lib/db';
import { parseDays, parseEnum } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));
    const trendGroup = parseEnum(searchParams.get('trend_group'), ['day', 'week', 'month'] as const, 'day');

    const analytics = getAnalytics(days);
    const citation_trend = getCitations({ days, group_by: trendGroup });

    return NextResponse.json({ ...analytics, citation_trend });
  } catch (error) {
    return handleApiError(error);
  }
}
