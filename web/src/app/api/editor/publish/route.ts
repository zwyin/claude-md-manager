import { NextResponse } from "next/server";
import { publishDrafts } from "@/lib/editor-db";

export async function POST() {
  try {
    const result = publishDrafts();
    if (result.error) {
      return NextResponse.json({ error: result.error, rulesChanged: result.rulesChanged }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
