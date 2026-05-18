import { NextRequest, NextResponse } from "next/server";
import { getDraft, saveDraft, deleteDraft } from "@/lib/editor-db";
import { sanitizeRuleId } from "@/lib/api-utils";
import { handleApiError } from "@/lib/api-handler";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const draft = getDraft(sanitizeRuleId(id));
    if (!draft) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(draft);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    if (!body || typeof body.frontmatter_yaml !== 'string' || typeof body.markdown_body !== 'string') {
      return NextResponse.json({ error: 'frontmatter_yaml and markdown_body are required strings' }, { status: 400 });
    }
    saveDraft(
      sanitizeRuleId(id),
      body.frontmatter_yaml,
      body.markdown_body,
      body.order_override
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    deleteDraft(sanitizeRuleId(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
