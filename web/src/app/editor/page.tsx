"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RuleFile } from "./types";
import { EditorLayout } from "./EditorLayout";
import { RuleListPanel } from "./RuleListPanel";
import { EditorPanel } from "./EditorPanel";
import { PreviewPanel } from "./PreviewPanel";
import { PublishDialog } from "./PublishDialog";
import { useI18n } from "@/i18n";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageLoader } from "@/components/page-states";
import { toast } from "sonner";

export default function EditorPage() {
  const [rules, setRules] = useState<RuleFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frontmatter, setFrontmatter] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { t } = useI18n();
  usePageTitle('editor.title');
  const initialLoadDone = useRef(false);
  const prevSelectedId = useRef<string | null>(null);
  const baselineFm = useRef("");
  const baselineBody = useRef("");

  const dirty = frontmatter !== baselineFm.current || body !== baselineBody.current;

  const selectedRule = rules.find((r) => r.rule_id === selectedId) ?? null;

  useEffect(() => {
    fetch("/api/editor/rules")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setRules(data.rules);
        setLoaded(true);
        if (!initialLoadDone.current && data.rules.length > 0) {
          setSelectedId(data.rules[0].rule_id);
        }
        initialLoadDone.current = true;
      })
      .catch(() => toast.error(t('editor.loadFailed')));
  }, [t]);

  useEffect(() => {
    if (!selectedId || prevSelectedId.current === selectedId) return;
    prevSelectedId.current = selectedId;

    const currentRule = rules.find((r) => r.rule_id === selectedId);
    if (!currentRule) return;

    fetch(`/api/editor/rules/${encodeURIComponent(selectedId)}/draft`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((draft) => {
        if (draft) {
          setFrontmatter(draft.frontmatter_yaml);
          setBody(draft.markdown_body);
          baselineFm.current = draft.frontmatter_yaml;
          baselineBody.current = draft.markdown_body;
          setHasDraft(true);
        } else {
          setFrontmatter(currentRule.frontmatter_yaml);
          setBody(currentRule.markdown_body);
          baselineFm.current = currentRule.frontmatter_yaml;
          baselineBody.current = currentRule.markdown_body;
          setHasDraft(false);
        }
      })
      .catch(() => toast.error(t('editor.draftLoadFailed')));
  }, [selectedId, rules, t]);

  const handleSaveDraft = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/editor/rules/${encodeURIComponent(selectedId)}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontmatter_yaml: frontmatter,
          markdown_body: body,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHasDraft(true);
      baselineFm.current = frontmatter;
      baselineBody.current = body;
      toast.success(t('editor.draftSaved'));
      const refreshed = await fetch("/api/editor/rules").then((r) => r.json());
      if (Array.isArray(refreshed.rules)) setRules(refreshed.rules);
    } catch {
      toast.error(t('editor.draftSaveFailed'));
    }
  }, [selectedId, frontmatter, body, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveDraft();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSaveDraft]);

  const handleDiscardDraft = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/editor/rules/${encodeURIComponent(selectedId)}/draft`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fm = selectedRule?.frontmatter_yaml ?? "";
      const bd = selectedRule?.markdown_body ?? "";
      setFrontmatter(fm);
      setBody(bd);
      baselineFm.current = fm;
      baselineBody.current = bd;
      setHasDraft(false);
      toast.success(t('editor.draftDiscarded'));
      const refreshed = await fetch("/api/editor/rules").then((r) => r.json());
      if (Array.isArray(refreshed.rules)) setRules(refreshed.rules);
    } catch {
      toast.error(t('editor.draftDiscardFailed'));
    }
  }, [selectedId, selectedRule, t]);

  const handleReorder = useCallback(async (items: Array<{ rule_id: string; order: number }>) => {
    try {
      const res = await fetch("/api/editor/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const refreshed = await fetch("/api/editor/rules").then((r) => r.json());
      if (Array.isArray(refreshed.rules)) setRules(refreshed.rules);
    } catch {
      toast.error(t('editor.reorderFailed'));
    }
  }, [t]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/editor/publish", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(t('editor.publishFailed', { error: data.error }));
      } else {
        toast.success(t('editor.published', { count: data.rulesChanged }));
      }
    } catch {
      toast.error(t('editor.publishFailed', { error: 'Network error' }));
    } finally {
      setPublishing(false);
      setShowPublish(false);
      try {
        const res = await fetch("/api/editor/rules");
        const refreshed = await res.json();
        if (Array.isArray(refreshed.rules)) setRules(refreshed.rules);
      } catch { /* best-effort refresh */ }
      setHasDraft(false);
    }
  }, [t]);

  const draftCount = rules.filter((r) => r.has_draft).length;

  if (!loaded) return <PageLoader message={t('status.loading')} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{t('editor.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('editor.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="text-xs text-orange-400">
              {t('editor.unsavedDrafts', { count: draftCount })}
            </span>
          )}
          <Button
            onClick={() => setShowPublish(true)}
            disabled={draftCount === 0 || publishing}
          >
            {t('editor.publishAll')}
          </Button>
        </div>
      </div>

      <EditorLayout>
        {{
          ruleList: (
            <RuleListPanel
              rules={rules}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReorder={handleReorder}
            />
          ),
          editor: selectedRule ? (
            <EditorPanel
              frontmatterYaml={frontmatter}
              markdownBody={body}
              hasDraft={hasDraft}
              dirty={dirty}
              onFrontmatterChange={setFrontmatter}
              onBodyChange={setBody}
              onSaveDraft={handleSaveDraft}
              onDiscardDraft={handleDiscardDraft}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              {t('editor.selectRule')}
            </div>
          ),
          preview: selectedRule ? (
            <PreviewPanel markdownBody={body} title={selectedRule.title} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t('editor.preview')}
            </div>
          ),
        }}
      </EditorLayout>

      {showPublish && (
        <PublishDialog
          rules={rules}
          onPublish={handlePublish}
          onCancel={() => setShowPublish(false)}
        />
      )}
    </div>
  );
}
