import { NextRequest, NextResponse } from 'next/server';
import { getRulesWithStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = searchParams.get('days')
      ? parseInt(searchParams.get('days')!, 10)
      : undefined;

    const rules = getRulesWithStats(days);
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch rules', details: String(error) },
      { status: 500 }
    );
  }
}
