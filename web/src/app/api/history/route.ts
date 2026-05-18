import { NextResponse } from 'next/server';
import { listSnapshotFiles } from '@/lib/snapshots';
import { handleApiError } from '@/lib/api-handler';

export async function GET() {
  try {
    const snapshots = listSnapshotFiles();
    return NextResponse.json({ snapshots });
  } catch (error) {
    return handleApiError(error);
  }
}
