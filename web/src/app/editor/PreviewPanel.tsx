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
      <div className="px-2 py-1 text-[10px] font-semibold text-[var(--meta)] mb-2 uppercase tracking-wider font-mono">
        {t('editor.preview')}
      </div>
      <div className="prose prose-sm max-w-none
        prose-headings:text-[var(--fg)] prose-p:text-[var(--fg-2)] prose-strong:text-[var(--fg)]
        prose-code:text-[var(--fg)] prose-a:text-[var(--accent)]
        prose-code:bg-[var(--surface-warm)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-code:before:content-[''] prose-code:after:content-['']">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdownBody}
        </ReactMarkdown>
      </div>
    </div>
  );
});