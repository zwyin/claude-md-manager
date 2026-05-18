import { NextResponse } from "next/server";
import { getAllRulesWithDraftStatus } from "@/lib/editor-db";
import { handleApiError } from "@/lib/api-handler";

export async function GET() {
  try {
    const rules = getAllRulesWithDraftStatus();
    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}
