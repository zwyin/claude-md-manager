'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { useFetch } from '@/hooks/use-fetch';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/relative-time';
import { PageError, SessionsSkeleton } from '@/components/page-states';
import type { RecentSession as SessionEntry } from '@/lib/types';

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

const MODEL_STYLES: Record<string, { bg: string; color: string }> = {
  'claude': { bg: 'var(--accent-soft)', color: 'var(--accent)' },
  'claude-opus': { bg: 'var(--accent-soft)', color: 'var(--accent)' },
  'claude-sonnet': { bg: 'color-mix(in oklch, var(--chart-blue) 14%, transparent)', color: 'var(--chart-blue)' },
  'claude-haiku': { bg: 'color-mix(in oklch, var(--chart-3) 14%, transparent)', color: 'var(--chart-3)' },
  'gpt-4': { bg: 'color-mix(in oklch, var(--chart-green) 14%, transparent)', color: 'var(--chart-green)' },
  'gpt-4o': { bg: 'color-mix(in oklch, var(--chart-green) 14%, transparent)', color: 'var(--chart-green)' },
  'gpt-3.5': { bg: 'color-mix(in oklch, var(--chart-green) 14%, transparent)', color: 'var(--chart-green)' },
  'gemini': { bg: 'color-mix(in oklch, var(--chart-blue) 14%, transparent)', color: 'var(--chart-blue)' },
  'glm': { bg: 'color-mix(in oklch, var(--chart-2) 14%, transparent)', color: 'var(--chart-2)' },
};

function modelBadgeStyle(model: string): { bg: string; color: string } {
  const key = Object.keys(MODEL_STYLES).find((k) => model.toLowerCase().includes(k));
  return key ? MODEL_STYLES[key] : { bg: 'var(--accent-soft)', color: 'var(--accent)' };
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

  const { data, loading, error, refresh } = useFetch<SessionsData>(url);

  const filteredSessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

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
      <div className="flex items-center gap-3">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 500, lineHeight: 'var(--leading-tight)' }}>{t('session.listTitle')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>{t('session.listSubtitle')}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-[var(--muted)] hover:text-[var(--fg)] py-1.5 px-2.5 text-sm mt-1 disabled:opacity-50"
          title={t('dashboard.refresh')}
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <input
          ref={searchRef}
          placeholder={`${t('session.searchPlaceholder')} (⌘K)`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 h-8 text-sm border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          style={{ color: 'var(--fg)', fontSize: 'var(--text-sm)' }}
        />
        <div className="time-filter">
          <button
            className={days === null ? 'active' : ''}
            onClick={() => handleFilterChange(null)}
          >
            {t('session.allTime')}
          </button>
          {TIME_RANGES.map((d) => (
            <button
              key={d}
              className={days === d ? 'active' : ''}
              onClick={() => handleFilterChange(d)}
            >
              {t(`analytics.time.${d}d`)}
            </button>
          ))}
        </div>
        {data.models && data.models.length > 1 && (
          <select
            value={modelFilter}
            onChange={(e) => handleModelChange(e.target.value)}
            className="h-7 text-xs rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] px-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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
          className="h-7 text-xs rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] px-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">{t('session.allConfidence')}</option>
          <option value="high">{t('analytics.confidence.high')}</option>
          <option value="medium">{t('analytics.confidence.medium')}</option>
          <option value="low">{t('analytics.confidence.low')}</option>
        </select>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="tag">{t('dashboard.totalSessions')}: {total}</span>
          {data.avg_duration != null && (
            <span className="tag">{t('session.avgDuration')}: {formatDuration(data.avg_duration)}</span>
          )}
          {data.avg_citations != null && (
            <span className="tag">{t('session.avgCitations')}: {data.avg_citations}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginRight: '4px' }}>{t('session.sortBy')}</span>
        {(['time', 'citations', 'rules', 'duration'] as const).map((key) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`py-1.5 px-2 text-sm transition-colors ${sortBy === key ? 'text-[var(--fg)] font-medium' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            {t(`session.sort.${key}`)}
            {sortBy === key && (
              <svg className={`w-3 h-3 ml-0.5 inline-block transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {filteredSessions.length > 0 ? (
        <div className="panel" style={{ padding: 0 }}>
          <div>
            {filteredSessions.map((s, idx) => {
              const ms = s.model ? modelBadgeStyle(s.model) : null;
              return (
                <Link
                  key={s.session_id}
                  href={`/sessions/${encodeURIComponent(s.session_id)}`}
                  ref={selectedIdx === idx ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  className={`flex items-center justify-between px-6 py-3 hover:bg-[var(--fg-soft)] transition-colors ${selectedIdx === idx ? 'bg-[var(--accent-soft)] ring-1 ring-inset' : ''}`}
                  style={selectedIdx === idx ? { '--tw-ring-color': 'color-mix(in oklch, var(--accent) 20%, transparent)' } as React.CSSProperties : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      role="button"
                      tabIndex={0}
                      className="shrink-0 hover:text-[var(--fg)] transition-colors mono"
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)' }}
                      title={s.session_id}
                      aria-label={t('session.copyId')}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(s.session_id); toast.success(t('ruleDetail.copied')); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigator.clipboard.writeText(s.session_id); toast.success(t('ruleDetail.copied')); } }}
                    >
                      {s.session_id.slice(0, 8)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
                          {s.started_at
                            ? new Date(s.started_at).toLocaleString(locale, {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                        {s.model && ms && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-pill)',
                              background: ms.bg,
                              color: ms.color,
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {s.model}
                          </span>
                        )}
                        {formatDuration(s.duration_sec) && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                            {formatDuration(s.duration_sec)}
                          </span>
                        )}
                      </div>
                      {s.task_summary && (
                        <p className="truncate mt-0.5 max-w-[400px]" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{s.task_summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.rule_count > 0 && (
                      <span className="pill">
                        {s.rule_count} {t('table.rules').toLowerCase()}
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                      {s.citation_count} {t('table.matches').toLowerCase()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-warm)] flex items-center justify-center">
            <Users className="w-8 h-8" style={{ color: 'var(--muted)' }} />
          </div>
          <p style={{ color: 'var(--muted)' }}>{t('session.noSessions')}</p>
        </div>
      )}

      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={!hasPrev}
            onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setSelectedIdx(null); document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] py-1.5 px-3 text-sm rounded-[var(--radius-sm)] hover:border-[var(--fg)] transition-colors disabled:opacity-50"
          >
            ← {t('pagination.prev')}
          </button>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          <button
            disabled={!hasMore}
            onClick={() => { setOffset(offset + PAGE_SIZE); setSelectedIdx(null); document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] py-1.5 px-3 text-sm rounded-[var(--radius-sm)] hover:border-[var(--fg)] transition-colors disabled:opacity-50"
          >
            {t('pagination.next')} →
          </button>
        </div>
      )}
    </div>
  );
}
