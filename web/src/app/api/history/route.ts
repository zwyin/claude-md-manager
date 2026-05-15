import { NextResponse } from 'next/server';
import { getHistory } from '@/lib/db';

export async function GET() {
  try {
    const history = getHistory();
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch history', details: String(error) },
      { status: 500 }
    );
  }
}
