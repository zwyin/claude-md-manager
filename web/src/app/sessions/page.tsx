'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoader, PageError } from '@/components/page-states';
import { relativeTime } from '@/lib/relative-time';

interface SessionEntry {
  session_id: string;
  started_at: string | null;
  ended_at: string | null;
  model: string | null;
  citation_count: number;
  rule_count: number;
}

interface SessionsData {
  sessions: SessionEntry[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;

function formatDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m${remSec > 0 ? `${remSec}s` : ''}`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h${remMin > 0 ? `${remMin}m` : ''}`;
}

export default function SessionsPage() {
  const [offset, setOffset] = useState(0);
  const { t, locale } = useI18n();
  usePageTitle('session.listTitle');

  const url = useMemo(() => `/api/sessions?limit=${PAGE_SIZE}&offset=${offset}`, [offset]);
  const { data, loading, error } = useFetch<SessionsData>(url);

  if (loading && !data) return <PageLoader message={t('status.loading')} />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!data) return null;

  const { sessions, total } = data;
  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('session.listTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('session.listSubtitle')}</p>
        <Badge variant="outline" className="text-xs mt-2">{t('dashboard.totalSessions')}: {total}</Badge>
      </div>

      {sessions.length > 0 ? (
        <Card className="rounded-xl border-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {sessions.map((s) => (
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
                      <div className="flex items-center gap-2">
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
                        {formatDuration(s.started_at, s.ended_at) && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDuration(s.started_at, s.ended_at)}
                          </span>
                        )}
                      </div>
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
