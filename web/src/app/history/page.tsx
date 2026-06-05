'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Clock, GitCompare, RotateCcw, Check, X, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { useFetch } from '@/hooks/use-fetch';
import { PageError, HistorySkeleton } from '@/components/page-states';
import { toast } from 'sonner';
import type { SnapshotInfo, DiffResult } from '@/lib/snapshots';

export default function HistoryPage() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { data: historyData, loading, error } = useFetch<{ snapshots: SnapshotInfo[] }>('/api/history');
  const snapshots = useMemo(() => historyData?.snapshots ?? [], [historyData?.snapshots]);
  const [selected, setSelected] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [rollbackStatus, setRollbackStatus] = useState<{ ts: string; ok: boolean; msg: string } | null>(null);
  const [contentView, setContentView] = useState<string | null>(null);
  const [contentText, setContentText] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);
  const { t, locale } = useI18n();
  usePageTitle('history.title');

  const grouped = useMemo(() => {
    const groups: Record<string, SnapshotInfo[]> = {};
    for (const s of snapshots) {
      const date = s.timestamp.slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(s);
    }
    return groups;
  }, [snapshots]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const toggleSelect = useCallback((filename: string) => {
    setSelected((prev) => {
      if (prev.includes(filename)) return prev.filter((f) => f !== filename);
      if (prev.length >= 2) return [prev[1], filename];
      return [...prev, filename];
    });
    setDiffResult(null);
  }, []);

  const handleCompare = useCallback(async () => {
    if (selected.length !== 2) return;
    setDiffLoading(true);
    try {
      const res = await fetch(`/api/history/diff?from=${encodeURIComponent(selected[0])}&to=${encodeURIComponent(selected[1])}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDiffResult(data);
    } catch {
      setDiffResult(null);
      toast.error(t('history.diffFailed'));
    } finally {
      setDiffLoading(false);
    }
  }, [selected, t]);

  const handleRollback = useCallback(async (filename: string) => {
    try {
      const res = await fetch('/api/history/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      const ts = filename.replace('.md', '');
      if (data.success) {
        setRollbackStatus({ ts, ok: true, msg: t('history.rollbackSuccess', { ts }) });
      } else {
        setRollbackStatus({ ts, ok: false, msg: t('history.rollbackFailed') });
      }
    } catch {
      setRollbackStatus({ ts: filename, ok: false, msg: t('history.rollbackFailed') });
      toast.error(t('history.rollbackFailed'));
    }
    setRollbackTarget(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRollbackStatus(null), 3000);
  }, [t]);

  const handleViewContent = useCallback(async (filename: string) => {
    const ts = filename.replace('.md', '');
    setContentLoading(true);
    setContentView(ts);
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(ts)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setContentText(data.content || '');
    } catch {
      setContentText('');
      toast.error(t('history.contentFailed'));
    } finally {
      setContentLoading(false);
    }
  }, [t]);

  if (loading) return <HistorySkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;

  const formatTs = (ts: string) => ts.replace('T', ' ').replace(/(\d{2})-(\d{2})-(\d{2})$/, '$1:$2:$3');

  const formatDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 500, lineHeight: 'var(--leading-tight)' }}>{t('history.title')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>{t('history.subtitle')}</p>
          {snapshots.length > 0 && (
            <span className="tag mt-2 inline-block">{t('history.snapshotCount', { count: snapshots.length })}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
              {t('history.selected', { count: selected.length })} — {t('history.selectHint')}
            </span>
          )}
          {selected.length === 2 && (
            <button
              onClick={handleCompare}
              disabled={diffLoading}
              className="bg-[var(--accent)] text-[var(--accent-on)] py-1.5 px-3.5 text-sm rounded-[var(--radius-sm)] disabled:opacity-50 flex items-center gap-1"
            >
              <GitCompare className="w-4 h-4" />
              {t('history.compare')}
            </button>
          )}
        </div>
      </div>

      {rollbackStatus && (
        <div
          className="rounded-[var(--radius-md)] p-3"
          style={{
            fontSize: 'var(--text-sm)',
            background: rollbackStatus.ok ? 'color-mix(in oklch, var(--success) 10%, transparent)' : 'color-mix(in oklch, var(--danger) 10%, transparent)',
            border: `1px solid ${rollbackStatus.ok ? 'color-mix(in oklch, var(--success) 20%, transparent)' : 'color-mix(in oklch, var(--danger) 20%, transparent)'}`,
            color: rollbackStatus.ok ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {rollbackStatus.msg}
        </div>
      )}

      {snapshots.length > 0 ? (
        <div className="relative pl-8 space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="relative -left-8 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider bg-[var(--surface)] pr-2 pb-1 border-b border-[var(--border)]" style={{ color: 'var(--muted)' }}>{formatDate(date)}</span>
              </div>
              <div className="relative">
                <div className="absolute left-[-17px] top-0 bottom-0 w-px bg-[var(--border)]" />
                <div className="space-y-3">
                  {items.map((s) => {
                    const isSelected = selected.includes(s.filename);
                    const isConfirming = rollbackTarget === s.filename;
                    return (
                      <div key={s.filename} className="relative">
                        <div className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 border-[var(--surface)] transition-colors bg-[var(--accent)]`} />
                        <div className={`panel ml-4 transition-colors ${isSelected ? 'border-[var(--accent)]' : ''}`} style={{ padding: 'var(--space-4)' }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleSelect(s.filename)}
                                aria-label={t('history.selectSnapshot', { ts: formatTs(s.timestamp) })}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--meta)] hover:border-[var(--accent)]'}`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </button>
                              <Clock className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                              <span className="pill">v{s.version}</span>
                              <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{formatTs(s.timestamp)}</span>
                              <span className="tag" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                                {t('history.size', { size: s.size })}
                              </span>
                              {s.diffStats && (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                                  <span style={{ color: 'var(--success)' }}>+{s.diffStats.added}</span>
                                  <span style={{ color: 'var(--muted)', margin: '0 2px' }}>/</span>
                                  <span style={{ color: 'var(--danger)' }}>-{s.diffStats.removed}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleViewContent(s.filename)}
                                className="text-[var(--muted)] hover:text-[var(--fg)] py-1.5 px-2.5 text-sm flex items-center gap-1 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                {t('history.content')}
                              </button>
                              {isConfirming ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleRollback(s.filename)}
                                    className="bg-[var(--danger)] text-white py-1.5 px-3.5 text-sm rounded-[var(--radius-sm)] flex items-center gap-1"
                                  >
                                    <Check className="w-4 h-4" />
                                    {t('history.rollbackConfirm')}
                                  </button>
                                  <button
                                    onClick={() => setRollbackTarget(null)}
                                    aria-label={t('editor.cancel')}
                                    className="text-[var(--muted)] hover:text-[var(--fg)] py-1.5 px-2.5 text-sm"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRollbackTarget(s.filename)}
                                  className="border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] py-1.5 px-3 text-sm rounded-[var(--radius-sm)] hover:border-[var(--fg)] transition-colors flex items-center gap-1"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  {t('history.rollback')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-warm)] flex items-center justify-center">
            <Clock className="w-8 h-8" style={{ color: 'var(--muted)' }} />
          </div>
          <p style={{ color: 'var(--muted)' }}>{t('history.noSnapshots')}</p>
        </div>
      )}

      {/* Content Viewer */}
      {contentView && (
        <div className="panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{contentView}</h3>
            <button
              onClick={() => setContentView(null)}
              aria-label={t('history.close')}
              className="text-[var(--muted)] hover:text-[var(--fg)] py-1.5 px-2.5 text-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {contentLoading ? (
            <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>{t('status.loading')}</div>
          ) : (
            <div className="prose prose-sm max-w-none
              prose-headings:text-[var(--fg)] prose-p:text-[var(--fg-2)] prose-strong:text-[var(--fg)]
              prose-code:text-[var(--fg)] prose-a:text-[var(--accent)]
              prose-code:before:content-[''] prose-code:after:content-['']
              max-h-96 overflow-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {contentText}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Diff View */}
      {diffLoading && (
        <div style={{ color: 'var(--muted)', padding: 'var(--space-4)' }}>{t('status.loading')}</div>
      )}
      {diffResult && !diffLoading && (
        <div className="panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{t('history.diff.title')}</h3>
            <div className="flex items-center gap-3" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
              <span style={{ color: 'var(--success)' }}>+{diffResult.stats.added}</span>
              <span style={{ color: 'var(--danger)' }}>-{diffResult.stats.removed}</span>
              {diffResult.stats.added === 0 && diffResult.stats.removed === 0 && (
                <span>{t('history.diff.noDiff')}</span>
              )}
            </div>
          </div>
          <div className="rounded-[var(--radius-sm)] overflow-auto max-h-[500px] font-mono" style={{ fontSize: 'var(--text-xs)', background: 'var(--surface-warm)' }}>
            <div className="flex border-b border-[var(--border)] px-2 py-1" style={{ background: 'color-mix(in oklch, var(--surface-warm) 60%, transparent)', color: 'var(--muted)' }}>
              <span style={{ color: 'var(--danger)' }}>{diffResult.from.replace('.md', '')}</span>
              <span className="mx-2">→</span>
              <span style={{ color: 'var(--success)' }}>{diffResult.to.replace('.md', '')}</span>
            </div>
            {diffResult.lines.map((line, i) => (
              <div
                key={i}
                className="flex"
                style={{
                  background: line.type === 'added'
                    ? 'color-mix(in oklch, var(--success) 10%, transparent)'
                    : line.type === 'removed'
                      ? 'color-mix(in oklch, var(--danger) 10%, transparent)'
                      : 'transparent',
                  color: line.type === 'added'
                    ? 'var(--success)'
                    : line.type === 'removed'
                      ? 'var(--danger)'
                      : 'var(--muted)',
                }}
              >
                <span className="w-10 shrink-0 text-right pr-2 select-none" style={{ color: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}>
                  {line.lineNum.old ?? ''}
                </span>
                <span className="w-10 shrink-0 text-right pr-2 select-none" style={{ color: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}>
                  {line.lineNum.new ?? ''}
                </span>
                <span className="w-5 shrink-0 text-center select-none font-bold">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span className="whitespace-pre-wrap break-all">{line.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
