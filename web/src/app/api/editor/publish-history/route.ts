import { NextResponse } from "next/server";
import { getPublishHistory } from "@/lib/editor-db";

export async function GET() {
  try {
    const history = getPublishHistory();
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
