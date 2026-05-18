"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div ref={dialogRef} tabIndex={-1} className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl outline-none">
        <h3 className="text-lg font-semibold mb-4">{t('editor.publishTitle')}</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {t('editor.publishDesc')}
        </p>
        <ul className="text-sm space-y-1 mb-4 max-h-48 overflow-y-auto">
          {draftRules.map((r) => (
            <li key={r.rule_id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              {r.title}
              <span className="text-xs text-muted-foreground">({r.source_file})</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t('editor.cancel')}
          </Button>
          <Button onClick={onPublish}>
            {t('editor.publish')} ({draftRules.length})
          </Button>
        </div>
      </div>
    </div>
  );
}