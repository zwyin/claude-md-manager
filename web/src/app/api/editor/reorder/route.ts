import { NextRequest, NextResponse } from "next/server";
import { saveReorder } from "@/lib/editor-db";

export async function POST(request: NextRequest) {
  try {
    const items = await request.json();
    saveReorder(items);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
