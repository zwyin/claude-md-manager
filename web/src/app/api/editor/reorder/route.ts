import { NextRequest, NextResponse } from "next/server";
import { saveReorder } from "@/lib/editor-db";

export async function POST(request: NextRequest) {
  try {
    const items = await request.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Expected an array' }, { status: 400 });
    }
    for (const item of items) {
      if (!item.rule_id || typeof item.order !== 'number') {
        return NextResponse.json({ error: 'Each item must have rule_id (string) and order (number)' }, { status: 400 });
      }
    }
    saveReorder(items);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
