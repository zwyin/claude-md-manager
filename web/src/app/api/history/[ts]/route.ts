import { NextResponse } from 'next/server';
import { getSnapshotContent, listSnapshotFiles } from '@/lib/snapshots';
import { handleApiError } from '@/lib/api-handler';

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ts: string }> }
) {
  try {
    const { ts } = await params;
    if (!TIMESTAMP_RE.test(ts)) {
      return NextResponse.json({ error: 'Invalid timestamp format' }, { status: 400 });
    }
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
    return handleApiError(error);
  }
}
