"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

interface EditorLayoutProps {
  children: {
    ruleList: React.ReactNode;
    editor: React.ReactNode;
    preview: React.ReactNode;
  };
}

export function EditorLayout({ children }: EditorLayoutProps) {
  const [previewOpen, setPreviewOpen] = useState(true);
  const { t } = useI18n();

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 min-w-0">
      <div className="w-[240px] lg:w-[280px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
        {children.ruleList}
      </div>
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreviewOpen((v) => !v)}
            className="text-xs h-7 px-2"
          >
            {previewOpen ? t('editor.hidePreview') : t('editor.showPreview')}
            <svg className={`w-3.5 h-3.5 ml-1 transition-transform ${previewOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
        {children.editor}
      </div>
      {previewOpen && (
        <div className="hidden md:block w-[280px] lg:w-[320px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
          {children.preview}
        </div>
      )}
    </div>
  );
}
