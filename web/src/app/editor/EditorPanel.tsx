"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { useI18n } from "@/i18n";

interface EditorPanelProps {
  frontmatterYaml: string;
  markdownBody: string;
  hasDraft: boolean;
  dirty: boolean;
  onFrontmatterChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
}

export function EditorPanel({
  frontmatterYaml,
  markdownBody,
  hasDraft,
  dirty,
  onFrontmatterChange,
  onBodyChange,
  onSaveDraft,
  onDiscardDraft,
}: EditorPanelProps) {
  const { t } = useI18n();

  const stats = useMemo(() => {
    const chars = markdownBody.length;
    const lines = markdownBody ? markdownBody.split('\n').length : 0;
    const words = markdownBody.trim() ? markdownBody.trim().split(/\s+/).length : 0;
    return { chars, lines, words };
  }, [markdownBody]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onSaveDraft}
          className={dirty
            ? "bg-[var(--accent)] text-[var(--accent-on)] rounded-[var(--radius-sm)] py-1.5 px-3.5 text-sm font-medium hover:opacity-90 transition-opacity"
            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] rounded-[var(--radius-sm)] py-1.5 px-3.5 text-sm hover:bg-[var(--fg-soft)] transition-colors"
          }
        >
          {t('editor.saveDraft')} <span className="text-[10px] opacity-60 ml-1">⌘S</span>
        </button>
        {hasDraft && (
          <button
            onClick={onDiscardDraft}
            className="border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] rounded-[var(--radius-sm)] py-1.5 px-3.5 text-sm hover:bg-[var(--fg-soft)] transition-colors"
          >
            {t('editor.discardDraft')}
          </button>
        )}
        {dirty && (
          <span className="text-[10px] text-[var(--accent)] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            {t('editor.unsavedChanges')}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="h-[40%] flex flex-col border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden bg-[var(--surface)]">
          <div className="shrink-0 px-2 py-1 text-[10px] font-semibold text-[var(--meta)] bg-[var(--surface-warm)] border-b border-[var(--border)]">
            {t('editor.yamlFrontmatter')}
          </div>
          <div className="flex-1 min-h-0">
            <CodeMirror
              value={frontmatterYaml}
              height="100%"
              extensions={[yaml()]}
              onChange={onFrontmatterChange}
              className="text-sm h-full"
              theme="light"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden min-h-0 bg-[var(--surface)]">
          <div className="shrink-0 px-2 py-1 text-[10px] font-semibold text-[var(--meta)] bg-[var(--surface-warm)] border-b border-[var(--border)] flex items-center justify-between">
            <span>{t('editor.markdownBody')}</span>
            <span className="font-mono text-[var(--meta)] text-xs font-normal opacity-60">{stats.words} {t('editor.words')} · {stats.lines} {t('editor.lines')}</span>
          </div>
          <div className="flex-1 min-h-0">
            <CodeMirror
              value={markdownBody}
              height="100%"
              extensions={[markdown()]}
              onChange={onBodyChange}
              className="text-sm h-full"
              theme="light"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
