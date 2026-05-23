'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Home, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { useFetch } from '@/hooks/use-fetch';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/relative-time';
import { PageLoader, PageError, SessionsSkeleton } from '@/components/page-states';

interface SessionEntry {
  session_id: string;
  started_at: string | null;
  ended_at: string | null;
  model: string | null;
  task_summary: string | null;
  citation_count: number;
  rule_count: number;
  duration_sec: number;
}

interface SessionsData {
  sessions: SessionEntry[];
  total: number;
  avg_duration: number | null;
  avg_citations: number | null;
  models: string[];
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;
const TIME_RANGES = [7, 30, 90] as const;
type SortKey = 'time' | 'citations' | 'rules' | 'duration';

const MODEL_COLORS: Record<string, string> = {
  'claude': 'bg-orange-500/15 text-orange-300',
  'claude-opus': 'bg-orange-500/15 text-orange-300',
  'claude-sonnet': 'bg-blue-500/15 text-blue-300',
  'claude-haiku': 'bg-purple-500/15 text-purple-300',
  'gpt-4': 'bg-emerald-500/15 text-emerald-300',
  'gpt-4o': 'bg-emerald-500/15 text-emerald-300',
  'gpt-3.5': 'bg-teal-500/15 text-teal-300',
  'gemini': 'bg-blue-500/15 text-blue-300',
  'glm': 'bg-indigo-500/15 text-indigo-300',
};

function modelBadgeClass(model: string): string {
  const key = Object.keys(MODEL_COLORS).find((k) => model.toLowerCase().includes(k));
  return key ? MODEL_COLORS[key] : '';
}

export default function SessionsPage() {
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const { t, locale } = useI18n();
  const router = useRouter();
  usePageTitle('session.listTitle');
  const searchRef = useRef<HTMLInputElement>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (days) params.set('days', String(days));
    params.set('sort', sortBy);
    params.set('dir', sortDir);
    if (search.trim()) params.set('search', search.trim());
    if (modelFilter) params.set('model', modelFilter);
    if (confidenceFilter) params.set('confidence', confidenceFilter);
    return `/api/sessions?${params}`;
  }, [offset, days, sortBy, sortDir, search, modelFilter, confidenceFilter]);

  const { data, loading, error } = useFetch<SessionsData>(url);

  const filteredSessions = data?.sessions ?? [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (filteredSessions.length === 0) return;
      if (e.key === 'ArrowDown' || (e.key === 'j' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setSelectedIdx((idx) => idx === null ? 0 : Math.min(idx + 1, filteredSessions.length - 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'k' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setSelectedIdx((idx) => idx === null ? filteredSessions.length - 1 : Math.max(idx - 1, 0));
      } else if (e.key === 'Enter' && selectedIdx !== null) {
        e.preventDefault();
        router.push(`/sessions/${encodeURIComponent(filteredSessions[selectedIdx].session_id)}`);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredSessions, selectedIdx, router]);

  const handleFilterChange = useCallback((newDays: number | null) => {
    setDays(newDays);
    setOffset(0);
    setSelectedIdx(null);
  }, []);

  const handleModelChange = useCallback((m: string) => {
    setModelFilter(m);
    setOffset(0);
    setSelectedIdx(null);
  }, []);

  const handleConfidenceChange = useCallback((c: string) => {
    setConfidenceFilter(c);
    setOffset(0);
    setSelectedIdx(null);
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
    setOffset(0);
  }, [sortBy]);

  if (loading && !data) return <SessionsSkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!data) return null;

  const total = data.total;
  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors"><Home className="w-3.5 h-3.5" /></Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{t('session.listTitle')}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">{t('session.listTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('session.listSubtitle')}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Input
          ref={searchRef}
          placeholder={`${t('session.searchPlaceholder')} (⌘K)`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 h-8 text-sm"
        />
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={days === null ? 'default' : 'outline'}
            className="h-7 text-xs px-2.5"
            onClick={() => handleFilterChange(null)}
          >
            {t('session.allTime')}
          </Button>
          {TIME_RANGES.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              className="h-7 text-xs px-2.5"
              onClick={() => handleFilterChange(d)}
            >
              {t(`analytics.time.${d}d`)}
            </Button>
          ))}
        </div>
        {data.models && data.models.length > 1 && (
          <select
            value={modelFilter}
            onChange={(e) => handleModelChange(e.target.value)}
            className="h-7 text-xs rounded-md border border-border bg-card text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">{t('session.allModels')}</option>
            {data.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        <select
          value={confidenceFilter}
          onChange={(e) => handleConfidenceChange(e.target.value)}
          className="h-7 text-xs rounded-md border border-border bg-card text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">{t('session.allConfidence')}</option>
          <option value="high">{t('analytics.confidence.high')}</option>
          <option value="medium">{t('analytics.confidence.medium')}</option>
          <option value="low">{t('analytics.confidence.low')}</option>
        </select>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-xs">{t('dashboard.totalSessions')}: {total}</Badge>
          {data.avg_duration != null && (
            <Badge variant="outline" className="text-xs">{t('session.avgDuration')}: {formatDuration(data.avg_duration)}</Badge>
          )}
          {data.avg_citations != null && (
            <Badge variant="outline" className="text-xs">{t('session.avgCitations')}: {data.avg_citations}</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">{t('session.sortBy')}</span>
        {(['time', 'citations', 'rules', 'duration'] as const).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={sortBy === key ? 'default' : 'ghost'}
            className="text-xs h-7 px-2"
            onClick={() => handleSort(key)}
          >
            {t(`session.sort.${key}`)}
            {sortBy === key && (
              <svg className={`w-3 h-3 ml-0.5 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </Button>
        ))}
      </div>

      {filteredSessions.length > 0 ? (
        <Card className="rounded-xl border-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filteredSessions.map((s, idx) => (
                <Link
                  key={s.session_id}
                  href={`/sessions/${encodeURIComponent(s.session_id)}`}
                  ref={selectedIdx === idx ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  className={`flex items-center justify-between px-6 py-3 hover:bg-accent/30 transition-colors ${selectedIdx === idx ? 'bg-accent/40 ring-1 ring-inset ring-indigo-500/20' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="text-xs font-mono text-muted-foreground shrink-0 hover:text-foreground transition-colors"
                      title={s.session_id}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(s.session_id); toast.success(t('ruleDetail.copied')); }}
                    >
                      {s.session_id.slice(0, 8)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">
                          {s.started_at
                            ? new Date(s.started_at).toLocaleString(locale, {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                        {s.model && (
                          <Badge variant="secondary" className={"text-[10px] px-1.5 py-0 border-0 " + modelBadgeClass(s.model)}>
                            {s.model}
                          </Badge>
                        )}
                        {formatDuration(s.duration_sec) && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDuration(s.duration_sec)}
                          </span>
                        )}
                      </div>
                      {s.task_summary && (
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5 max-w-[400px]">{s.task_summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.rule_count > 0 && (
                      <Badge variant="default" className="text-[10px]">
                        {s.rule_count} {t('table.rules').toLowerCase()}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">
                      {s.citation_count} {t('table.matches').toLowerCase()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-border flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('session.noSessions')}</p>
        </div>
      )}

      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={!hasPrev}
            onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setSelectedIdx(null); document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            ← {t('pagination.prev')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasMore}
            onClick={() => { setOffset(offset + PAGE_SIZE); setSelectedIdx(null); document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            {t('pagination.next')} →
          </Button>
        </div>
      )}
    </div>
  );
}
