"use client";

import { useEffect, useRef } from "react";
import type { RuleFile } from "./types";
import { useI18n } from "@/i18n";

interface PublishDialogProps {
  rules: RuleFile[];
  onPublish: () => void;
  onCancel: () => void;
}

export function PublishDialog({ rules, onPublish, onCancel }: PublishDialogProps) {
  const draftRules = rules.filter((r) => r.has_draft);
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true" aria-label={t('editor.publishTitle')} onClick={onCancel}>
      <div ref={dialogRef} tabIndex={-1} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 max-w-md w-full mx-4 shadow-xl outline-none" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-semibold mb-4 text-[var(--fg)]">{t('editor.publishTitle')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">
          {t('editor.publishDesc')}
        </p>
        <ul className="text-sm space-y-1 mb-4 max-h-48 overflow-y-auto">
          {draftRules.map((r) => (
            <li key={r.rule_id} className="flex items-center gap-2 text-[var(--fg)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              {r.title}
              <span className="text-xs text-[var(--meta)]">({r.source_file})</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] py-2 px-4 rounded-[var(--radius-sm)] text-sm hover:bg-[var(--fg-soft)] transition-colors"
          >
            {t('editor.cancel')}
          </button>
          <button
            onClick={onPublish}
            className="bg-[var(--accent)] text-[var(--accent-on)] py-2 px-4 rounded-[var(--radius-sm)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('editor.publish')} ({draftRules.length})
          </button>
        </div>
      </div>
    </div>
  );
}
