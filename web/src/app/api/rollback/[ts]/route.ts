import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ts: string }> }
) {
  try {
    const { ts } = await params;

    const snapshot = getSnapshot(ts);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'No snapshot found for the given timestamp' },
        { status: 404 }
      );
    }

    // Stub: In a real implementation, this would restore rules from the snapshot
    // For now, just return the snapshot data as confirmation
    return NextResponse.json({
      success: true,
      message: `Rollback to ${ts} prepared (stub)`,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Rollback failed', details: String(error) },
      { status: 500 }
    );
  }
}
