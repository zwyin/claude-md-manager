import { NextResponse } from 'next/server';
import { computeDiff } from '@/lib/snapshots';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Missing "from" and "to" parameters' },
        { status: 400 }
      );
    }

    const safePattern = /^[a-zA-Z0-9._-]+$/;
    if (!safePattern.test(from) || !safePattern.test(to)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const fromFile = from.endsWith('.md') ? from : `${from}.md`;
    const toFile = to.endsWith('.md') ? to : `${to}.md`;

    const result = computeDiff(fromFile, toFile);
    if (!result) {
      return NextResponse.json(
        { error: 'Could not compute diff — snapshot not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute diff', details: String(error) },
      { status: 500 }
    );
  }
}
