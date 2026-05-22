'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, GitCompare, RotateCcw, Check, X, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoader, PageError } from '@/components/page-states';
import { toast } from 'sonner';
import type { SnapshotInfo, DiffResult } from '@/lib/snapshots';

export default function HistoryPage() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { data: historyData, loading, error } = useFetch<{ snapshots: SnapshotInfo[] }>('/api/history');
  const snapshots = historyData?.snapshots ?? [];
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

  if (loading) return <PageLoader message={t('status.loading')} />;
  if (error) return <PageError message={t('status.error', { error })} />;

  const formatTs = (ts: string) => ts.replace('T', ' ').replace(/(\d{2})-(\d{2})-(\d{2})$/, '$1:$2:$3');

  // Group snapshots by date
  const grouped = useMemo(() => {
    const groups: Record<string, SnapshotInfo[]> = {};
    for (const s of snapshots) {
      const date = s.timestamp.slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(s);
    }
    return groups;
  }, [snapshots]);

  const formatDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('history.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('history.subtitle')}</p>
          {snapshots.length > 0 && (
            <Badge variant="outline" className="text-xs mt-2">{t('history.snapshotCount', { count: snapshots.length })}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('history.selected', { count: selected.length })} — {t('history.selectHint')}
            </span>
          )}
          {selected.length === 2 && (
            <Button size="sm" onClick={handleCompare} disabled={diffLoading}>
              <GitCompare className="w-4 h-4 mr-1" />
              {t('history.compare')}
            </Button>
          )}
        </div>
      </div>

      {rollbackStatus && (
        <div className={`rounded-xl p-3 text-sm ${rollbackStatus.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
          {rollbackStatus.msg}
        </div>
      )}

      {snapshots.length > 0 ? (
        <div className="relative pl-8 space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="relative -left-8 mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-card pr-2">{formatDate(date)}</span>
              </div>
              <div className="relative">
                <div className="absolute left-[-17px] top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3">
                  {items.map((s) => {
                    const isSelected = selected.includes(s.filename);
                    const isConfirming = rollbackTarget === s.filename;
                    return (
                      <div key={s.filename} className="relative">
                        <div className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 border-card transition-colors ${isSelected ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
                  <Card className={`rounded-xl border bg-card ml-4 transition-colors ${isSelected ? 'border-indigo-500/50' : 'border-border'}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleSelect(s.filename)}
                          aria-label={t('history.selectSnapshot', { ts: formatTs(s.timestamp) })}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-muted-foreground/30 hover:border-indigo-400'}`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatTs(s.timestamp)}</span>
                        <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                          {t('history.size', { size: s.size })}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleViewContent(s.filename)}>
                          <FileText className="w-4 h-4 mr-1" />
                          {t('history.content')}
                        </Button>
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="destructive" onClick={() => handleRollback(s.filename)}>
                              <Check className="w-4 h-4 mr-1" />
                              {t('history.rollbackConfirm')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRollbackTarget(null)} aria-label={t('editor.cancel')}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setRollbackTarget(s.filename)}>
                            <RotateCcw className="w-4 h-4 mr-1" />
                            {t('history.rollback')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-border flex items-center justify-center">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('history.noSnapshots')}</p>
        </div>
      )}

      {/* Content Viewer */}
      {contentView && (
        <Card className="rounded-xl border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">{contentView}</h3>
              <Button size="sm" variant="ghost" onClick={() => setContentView(null)} aria-label={t('history.close')}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {contentLoading ? (
              <div className="text-muted-foreground text-sm">{t('status.loading')}</div>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none
                prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground
                prose-code:text-foreground prose-a:text-indigo-400
                prose-code:before:content-[''] prose-code:after:content-['']
                max-h-96 overflow-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {contentText}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diff View */}
      {diffLoading && (
        <div className="text-muted-foreground p-4">{t('status.loading')}</div>
      )}
      {diffResult && !diffLoading && (
        <Card className="rounded-xl border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">{t('history.diff.title')}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="text-emerald-400">+{diffResult.stats.added}</span>
                <span className="text-rose-400">-{diffResult.stats.removed}</span>
                {diffResult.stats.added === 0 && diffResult.stats.removed === 0 && (
                  <span>{t('history.diff.noDiff')}</span>
                )}
              </div>
            </div>
            <div className="rounded-lg overflow-auto max-h-[500px] bg-muted/20 font-mono text-xs">
              {diffResult.lines.map((line, i) => (
                <div
                  key={i}
                  className={`flex ${
                    line.type === 'added'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : line.type === 'removed'
                        ? 'bg-rose-500/10 text-rose-300'
                        : 'text-muted-foreground'
                  }`}
                >
                  <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/50 select-none">
                    {line.lineNum.old ?? ''}
                  </span>
                  <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/50 select-none">
                    {line.lineNum.new ?? ''}
                  </span>
                  <span className="w-5 shrink-0 text-center select-none">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{line.content}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
