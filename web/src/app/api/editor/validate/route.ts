import { NextRequest, NextResponse } from "next/server";
import { validateDrafts } from "@/lib/editor-db";

export async function POST(request: NextRequest) {
  try {
    const drafts = await request.json();
    const errors = validateDrafts(drafts);
    return NextResponse.json({ valid: errors.length === 0, errors });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
