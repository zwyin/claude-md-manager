"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "@/i18n";

interface PreviewPanelProps {
  markdownBody: string;
}

export const PreviewPanel = memo(function PreviewPanel({ markdownBody }: PreviewPanelProps) {
  const { t } = useI18n();

  return (
    <div className="p-3">
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        {t('editor.preview')}
      </div>
      <div className="prose prose-sm prose-invert max-w-none
        prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground
        prose-code:text-foreground prose-a:text-indigo-400
        prose-code:before:content-[''] prose-code:after:content-['']">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdownBody}
        </ReactMarkdown>
      </div>
    </div>
  );
});