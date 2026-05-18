import { NextResponse } from 'next/server';
import { listSnapshotFiles } from '@/lib/snapshots';

export async function GET() {
  try {
    const snapshots = listSnapshotFiles();
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch history', details: String(error) },
      { status: 500 }
    );
  }
}
