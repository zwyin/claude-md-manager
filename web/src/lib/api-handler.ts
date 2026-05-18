import { NextResponse } from 'next/server';
import { ValidationError } from './api-utils';

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { error: 'Internal server error', details: String(error) },
    { status: 500 }
  );
}
