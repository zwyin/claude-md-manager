import { NextRequest, NextResponse } from 'next/server';
import { getRuleDetail } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const days = searchParams.get('days')
      ? parseInt(searchParams.get('days')!, 10)
      : undefined;

    const result = getRuleDetail(id, days);

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
