import { NextResponse } from "next/server";
import { getAllRulesWithDraftStatus } from "@/lib/editor-db";

export async function GET() {
  try {
    const rules = getAllRulesWithDraftStatus();
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
