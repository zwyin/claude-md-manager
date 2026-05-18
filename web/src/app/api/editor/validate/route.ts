import { NextRequest, NextResponse } from "next/server";
import { validateDrafts } from "@/lib/editor-db";
import { sanitizeRuleId } from "@/lib/api-utils";
import { handleApiError } from "@/lib/api-handler";

export async function POST(request: NextRequest) {
  try {
    const drafts = await request.json();
    if (!Array.isArray(drafts)) {
      return NextResponse.json({ error: 'Expected an array' }, { status: 400 });
    }
    for (const d of drafts) {
      if (!d.rule_id || typeof d.rule_id !== 'string') {
        return NextResponse.json({ error: 'Each draft must have a rule_id' }, { status: 400 });
      }
      try {
        d.rule_id = sanitizeRuleId(d.rule_id);
      } catch {
        return NextResponse.json({ error: `Invalid rule_id: ${d.rule_id}` }, { status: 400 });
      }
    }
    const errors = validateDrafts(drafts);
    return NextResponse.json({ valid: errors.length === 0, errors });
  } catch (error) {
    return handleApiError(error);
  }
}
