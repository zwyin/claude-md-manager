import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getAnalytics, getCitations, getHeatmapData } from '@/lib/db';
import { parseDays, parseEnum } from '@/lib/api-utils';
import { handleApiError } from '@/lib/api-handler';
import type { ConfidenceDistribution } from '@/lib/types';

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

      const timeFilter = days ? `WHERE r.timestamp >= datetime('now', ? || ' days')` : '';
      const confParams = days ? [`-${days}`] : [];
      const rawConf = db.prepare(
        `SELECT confidence, COUNT(*) as count FROM rule_references r ${timeFilter} GROUP BY confidence ORDER BY count DESC`
      ).bind(...confParams).all() as { confidence: string; count: number }[];

      const confidence_distribution: ConfidenceDistribution[] = rawConf.map((row) => {
        const top_rules = db.prepare(
          `SELECT r.rule_id, m.title, COUNT(*) as count
           FROM rule_references r
           JOIN rules_metadata m ON r.rule_id = m.rule_id
           WHERE r.confidence = ? ${days ? "AND r.timestamp >= datetime('now', ? || ' days')" : ''}
           GROUP BY r.rule_id
           ORDER BY count DESC
           LIMIT 5`
        ).bind(row.confidence, ...(days ? [`-${days}`] : [])).all() as { rule_id: string; title: string; count: number }[];
        return { ...row, top_rules };
      });

      return NextResponse.json({ ...analytics, citation_trend, heatmap, confidence_distribution });
    } finally {
      db.close();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
