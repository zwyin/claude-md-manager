"use client";

import { useEffect, useState } from "react";
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
  const [listOpen, setListOpen] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPreviewOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 min-w-0">
      {listOpen && (
        <div className="w-[240px] lg:w-[280px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card sm:block">
          {children.ruleList}
        </div>
      )}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setListOpen((v) => !v)}
            className="text-xs h-7 px-2"
          >
            {listOpen ? t('editor.hideRules') : t('editor.showRules')}
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreviewOpen((v) => !v)}
            className="text-xs h-7 px-2"
          >
            {previewOpen ? t('editor.hidePreview') : t('editor.showPreview')} <kbd className="ml-1 text-[10px] opacity-50">⇧⌘P</kbd>
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
