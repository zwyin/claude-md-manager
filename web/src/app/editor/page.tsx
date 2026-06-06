"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RuleFile, PublishEvent } from "./types";
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
  return (
    <Suspense fallback={<PageLoader message="..." />}>
      <EditorContent />
    </Suspense>
  );
}

function EditorContent() {
  const searchParams = useSearchParams();
  const [rules, setRules] = useState<RuleFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frontmatter, setFrontmatter] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishHistory, setPublishHistory] = useState<PublishEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [baselineFm, setBaselineFm] = useState("");
  const [baselineBody, setBaselineBody] = useState("");
  const { t, locale } = useI18n();
  usePageTitle('editor.title');
  const initialLoadDone = useRef(false);
  const prevSelectedId = useRef<string | null>(null);

  const dirty = frontmatter !== baselineFm || body !== baselineBody;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    const orig = document.title;
    if (dirty) document.title = `● ${orig}`;
    return () => { if (document.title.startsWith('● ')) document.title = orig; };
  }, [dirty]);

  const selectedRule = rules.find((r) => r.rule_id === selectedId) ?? null;

  const fetchPublishHistory = useCallback(() => {
    fetch("/api/editor/publish-history")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.history)) setPublishHistory(data.history); })
      .catch((err) => { console.warn('Failed to fetch publish history:', err); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const preselected = searchParams.get('rule');
    fetch("/api/editor/rules")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRules(data.rules);
        setLoaded(true);
        fetchPublishHistory();
        if (!initialLoadDone.current && data.rules.length > 0) {
          if (preselected && data.rules.some((r: RuleFile) => r.rule_id === preselected)) {
            setSelectedId(preselected);
          } else {
            setSelectedId(data.rules[0].rule_id);
          }
        }
        initialLoadDone.current = true;
      })
      .catch(() => {
        if (!cancelled) toast.error(t('editor.loadFailed'));
      });
    return () => { cancelled = true; };
  }, [t, searchParams, fetchPublishHistory]);

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
          setBaselineFm(draft.frontmatter_yaml);
          setBaselineBody(draft.markdown_body);
          setHasDraft(true);
        } else {
          setFrontmatter(currentRule.frontmatter_yaml);
          setBody(currentRule.markdown_body);
          setBaselineFm(currentRule.frontmatter_yaml);
          setBaselineBody(currentRule.markdown_body);
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
      setBaselineFm(frontmatter);
      setBaselineBody(body);
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
      setBaselineFm(fm);
      setBaselineBody(bd);
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
      } catch { /* best-effort: ignore failures after publish */ }
      setHasDraft(false);
    }
  }, [t]);

  const draftCount = rules.filter((r) => r.has_draft).length;

  if (!loaded) return <PageLoader message={t('status.loading')} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 500 }}>
            {t('editor.title')}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
            {t('editor.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="text-[10px] text-[var(--accent)] font-medium">
              {t('editor.unsavedDrafts', { count: draftCount })}
            </span>
          )}
          <button
            onClick={() => setShowPublish(true)}
            disabled={draftCount === 0 || publishing}
            className="bg-[var(--accent)] text-[var(--accent-on)] rounded-[var(--radius-sm)] py-1.5 px-3.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('editor.publishAll')}
          </button>
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
            <div className="flex-1 flex items-center justify-center text-[var(--muted)]">
              {t('editor.selectRule')}
            </div>
          ),
          preview: selectedRule ? (
            <PreviewPanel markdownBody={body} />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
              {t('editor.preview')}
            </div>
          ),
        }}
      </EditorLayout>

      <div className="panel mt-4">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3 hover:bg-[var(--fg-soft)] transition-colors text-left rounded-[var(--radius-md)]"
        >
          <div className="flex items-center gap-3">
            <svg className={`w-4 h-4 text-[var(--meta)] transition-transform ${historyOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-semibold text-[var(--fg)]">{t('editor.publishHistory')}</span>
          </div>
          {publishHistory.length > 0 && (
            <span className="pill text-xs">{publishHistory.length}</span>
          )}
        </button>
        {historyOpen && (
          publishHistory.length > 0 ? (
            <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
              {publishHistory.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between px-6 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-[var(--radius-pill)] ${
                      ev.status === 'success'
                        ? 'bg-[var(--success)]/10 text-[var(--success)]'
                        : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                    }`}>
                      {ev.status === 'success' ? t('dashboard.buildStatus.success') : t('dashboard.buildStatus.failed')}
                    </span>
                    <span className="text-sm text-[var(--meta)]">
                      {new Date(ev.published_at).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--meta)]">{t('editor.published', { count: ev.rules_changed })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t border-[var(--border)] px-6 py-8 flex flex-col items-center gap-2 text-[var(--meta)]">
              <svg className="w-6 h-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.243l.256.512a2.25 2.25 0 002.013 1.243h3.218a2.25 2.25 0 002.013-1.243l.256-.512a2.25 2.25 0 012.013-1.243h3.859m-17.5 0V6.75A2.25 2.25 0 014.5 4.5h15A2.25 2.25 0 0121.75 6.75v6.75m-17.5 0v4.5A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25v-4.5" />
              </svg>
              <span className="text-sm">{t('editor.noPublishHistory')}</span>
            </div>
          )
        )}
      </div>

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
