import { NextResponse } from "next/server";
import { publishDrafts } from "@/lib/editor-db";
import { handleApiError } from "@/lib/api-handler";

export async function POST() {
  try {
    const result = publishDrafts();
    if (result.error) {
      return NextResponse.json({ error: result.error, rulesChanged: result.rulesChanged }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
