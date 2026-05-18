import { NextResponse } from 'next/server';
import { rollbackToSnapshot } from '@/lib/snapshots';
import { handleApiError } from '@/lib/api-handler';

export async function POST(request: Request) {
  try {
    const { filename } = await request.json();
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }

    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    if (safe !== filename) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const success = rollbackToSnapshot(safe);
    if (!success) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, filename: safe });
  } catch (error) {
    return handleApiError(error);
  }
}
