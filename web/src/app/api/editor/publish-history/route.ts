import { NextResponse } from "next/server";
import { getPublishHistory } from "@/lib/editor-db";
import { handleApiError } from "@/lib/api-handler";

export async function GET() {
  try {
    const history = getPublishHistory();
    return NextResponse.json({ history });
  } catch (error) {
    return handleApiError(error);
  }
}
