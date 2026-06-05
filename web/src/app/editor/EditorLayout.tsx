"use client";

import { useEffect, useState } from "react";
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
        <div className="hidden sm:block w-[240px] lg:w-[280px] shrink-0 overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)]">
          {children.ruleList}
        </div>
      )}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setListOpen((v) => !v)}
            className="text-sm text-[var(--muted)] hover:text-[var(--fg)] py-1.5 px-3 transition-colors"
          >
            {listOpen ? t('editor.hideRules') : t('editor.showRules')}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            className="text-sm text-[var(--muted)] hover:text-[var(--fg)] py-1.5 px-3 transition-colors inline-flex items-center gap-1"
          >
            {previewOpen ? t('editor.hidePreview') : t('editor.showPreview')}
            <kbd className="font-mono text-[11px] text-[var(--meta)] bg-[var(--bg)] px-1.5 py-0.5 border border-[var(--border)] rounded">⇧⌘P</kbd>
            <svg className={`w-3.5 h-3.5 transition-transform ${previewOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {children.editor}
      </div>
      {previewOpen && (
        <div className="hidden md:block w-[280px] lg:w-[320px] shrink-0 overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)]">
          {children.preview}
        </div>
      )}
    </div>
  );
}
