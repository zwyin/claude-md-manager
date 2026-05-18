import { NextResponse } from 'next/server';
import { getSnapshotContent, listSnapshotFiles } from '@/lib/snapshots';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ts: string }> }
) {
  try {
    const { ts } = await params;
    // Find matching snapshot file
    const snapshots = listSnapshotFiles();
    const match = snapshots.find(
      (s) => s.filename === `${ts}.md` || s.timestamp === ts
    );
    if (!match) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    const content = getSnapshotContent(match.filename);
    if (content === null) {
      return NextResponse.json({ error: 'Failed to read snapshot' }, { status: 500 });
    }

    return NextResponse.json({
      filename: match.filename,
      timestamp: match.timestamp,
      size: match.size,
      content,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch snapshot', details: String(error) },
      { status: 500 }
    );
  }
}
