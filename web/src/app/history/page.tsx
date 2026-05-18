'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, GitCompare, RotateCcw, Check, X, FileText } from 'lucide-react';
import { useI18n } from '@/i18n';
import { fetchJson } from '@/lib/fetch';
import { toast } from 'sonner';

interface SnapshotInfo {
  filename: string;
  timestamp: string;
  size: number;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNum: { old?: number; new?: number };
}

interface DiffResult {
  from: string;
  to: string;
  lines: DiffLine[];
  stats: { added: number; removed: number; unchanged: number };
}

export default function HistoryPage() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [rollbackStatus, setRollbackStatus] = useState<{ ts: string; ok: boolean; msg: string } | null>(null);
  const [contentView, setContentView] = useState<string | null>(null);
  const [contentText, setContentText] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    fetchJson<{ snapshots: SnapshotInfo[] }>('/api/history')
      .then((json) => { setSnapshots(json.snapshots || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
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
    } catch (err) {
      setDiffResult(null);
      toast.error(t('history.diffFailed'));
    } finally {
      setDiffLoading(false);
    }
  }, [selected]);

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
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;

  const formatTs = (ts: string) => ts.replace('T', ' ').replace(/-/g, (m, i) => i > 9 ? '-' : m).replace(/(\d{2})-(\d{2})-(\d{2})$/, '$1:$2:$3');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('history.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('history.subtitle')}</p>
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
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {snapshots.map((s) => {
              const isSelected = selected.includes(s.filename);
              const isConfirming = rollbackTarget === s.filename;
              return (
                <div key={s.filename} className="relative">
                  <div className={`absolute -left-5 top-4 w-3 h-3 rounded-full border-2 border-card transition-colors ${isSelected ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
                  <Card className={`rounded-xl border bg-card ml-4 transition-colors ${isSelected ? 'border-indigo-500/50' : 'border-border'}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleSelect(s.filename)}
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
                            <Button size="sm" variant="ghost" onClick={() => setRollbackTarget(null)}>
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
              <Button size="sm" variant="ghost" onClick={() => setContentView(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {contentLoading ? (
              <div className="text-muted-foreground text-sm">{t('status.loading')}</div>
            ) : (
              <pre className="text-xs bg-muted/30 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap break-words">
                {contentText}
              </pre>
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
