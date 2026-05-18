"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RuleFile } from "./types";
import { EditorLayout } from "./EditorLayout";
import { RuleListPanel } from "./RuleListPanel";
import { EditorPanel } from "./EditorPanel";
import { PreviewPanel } from "./PreviewPanel";
import { PublishDialog } from "./PublishDialog";
import { useI18n } from "@/i18n";
import { toast } from "sonner";

export default function EditorPage() {
  const [rules, setRules] = useState<RuleFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frontmatter, setFrontmatter] = useState("");
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { t } = useI18n();

  const selectedRule = rules.find((r) => r.rule_id === selectedId) ?? null;

  useEffect(() => {
    fetch("/api/editor/rules")
      .then((r) => r.json())
      .then((data) => {
        setRules(data.rules);
        if (data.rules.length > 0 && !selectedId) {
          setSelectedId(data.rules[0].rule_id);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedRule) return;

    fetch(`/api/editor/rules/${encodeURIComponent(selectedRule.rule_id)}/draft`)
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((draft) => {
        if (draft) {
          setFrontmatter(draft.frontmatter_yaml);
          setBody(draft.markdown_body);
          setHasDraft(true);
        } else {
          setFrontmatter(selectedRule.frontmatter_yaml);
          setBody(selectedRule.markdown_body);
          setHasDraft(false);
        }
      });
  }, [selectedId, rules]);

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
      toast.success(t('editor.draftSaved'));
      const refreshed = await fetch("/api/editor/rules").then((r) => r.json());
      setRules(refreshed.rules);
    } catch (err) {
      toast.error(t('editor.draftSaveFailed'));
    }
  }, [selectedId, frontmatter, body, t]);

  const handleDiscardDraft = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/editor/rules/${encodeURIComponent(selectedId)}/draft`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFrontmatter(selectedRule?.frontmatter_yaml ?? "");
      setBody(selectedRule?.markdown_body ?? "");
      setHasDraft(false);
      toast.success(t('editor.draftDiscarded'));
      const refreshed = await fetch("/api/editor/rules").then((r) => r.json());
      setRules(refreshed.rules);
    } catch (err) {
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
      setRules(refreshed.rules);
    } catch (err) {
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
      const res = await fetch("/api/editor/rules");
      const refreshed = await res.json();
      setRules(refreshed.rules);
      setHasDraft(false);
    }
  }, [t]);

  const draftCount = rules.filter((r) => r.has_draft).length;

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

      <EditorLayout rules={rules}>
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
