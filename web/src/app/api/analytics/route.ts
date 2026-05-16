import { NextRequest, NextResponse } from 'next/server';
import { getAnalytics, getCitations } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = searchParams.get('days')
      ? parseInt(searchParams.get('days')!, 10)
      : undefined;
    const trendGroup = (searchParams.get('trend_group') || 'day') as 'day' | 'week' | 'month';

    const analytics = getAnalytics(days);
    const citation_trend = getCitations({ days: 30, group_by: trendGroup });

    return NextResponse.json({ ...analytics, citation_trend });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: String(error) },
      { status: 500 }
    );
  }
}
