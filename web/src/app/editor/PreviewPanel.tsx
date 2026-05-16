"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "@/i18n";

interface PreviewPanelProps {
  markdownBody: string;
  title: string;
}

export function PreviewPanel({ markdownBody, title }: PreviewPanelProps) {
  const { t } = useI18n();

  return (
    <div className="p-3">
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        {t('editor.preview')}
      </div>
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdownBody}
        </ReactMarkdown>
      </div>
    </div>
  );
}