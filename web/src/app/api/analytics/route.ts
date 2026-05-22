import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getAnalytics, getCitations, getHeatmapData } from '@/lib/db';
import { parseDays, parseEnum } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseDays(searchParams.get('days'));
    const trendGroup = parseEnum(searchParams.get('trend_group'), ['day', 'week', 'month'] as const, 'day');

    const db = new Database(path.join(process.cwd(), '..', 'data', 'usage.db'), { readonly: true });
    try {
      const analytics = getAnalytics(days, db);
      const citation_trend = getCitations({ days, group_by: trendGroup }, db);
      const heatmap = getHeatmapData(days, 50, db);

      return NextResponse.json({ ...analytics, citation_trend, heatmap });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
