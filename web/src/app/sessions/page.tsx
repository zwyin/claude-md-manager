'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { useFetch } from '@/hooks/use-fetch';
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
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;
const TIME_RANGES = [7, 30, 90] as const;
type SortKey = 'time' | 'citations' | 'rules' | 'duration';

export default function SessionsPage() {
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const { t, locale } = useI18n();
  usePageTitle('session.listTitle');

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (days) params.set('days', String(days));
    params.set('sort', sortBy);
    params.set('dir', sortDir);
    if (search.trim()) params.set('search', search.trim());
    return `/api/sessions?${params}`;
  }, [offset, days, sortBy, sortDir, search]);

  const { data, loading, error } = useFetch<SessionsData>(url);

  const filteredSessions = data?.sessions ?? [];

  const handleFilterChange = useCallback((newDays: number | null) => {
    setDays(newDays);
    setOffset(0);
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
          placeholder={t('session.searchPlaceholder')}
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
        <Badge variant="outline" className="text-xs">{t('dashboard.totalSessions')}: {total}</Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">{t('analytics.timeRange')}:</span>
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
              {filteredSessions.map((s) => (
                <Link
                  key={s.session_id}
                  href={`/sessions/${encodeURIComponent(s.session_id)}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
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
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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
          <p className="text-muted-foreground">{t('session.noSessions')}</p>
        </div>
      )}

      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={!hasPrev}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
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
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            {t('pagination.next')} →
          </Button>
        </div>
      )}
    </div>
  );
}
