'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { useDynamicPageTitle } from '@/hooks/use-page-title';
import { PageError, SessionDetailSkeleton } from '@/components/page-states';
import { toast } from 'sonner';
import { relativeTime, formatDuration } from '@/lib/relative-time';
import { SECTION_COLORS } from '@/lib/chart-colors';
import type { SessionCitation, SessionSection } from '@/lib/types';

interface SessionData {
  session: { session_id: string; started_at: string | null; ended_at: string | null; model: string | null; task_summary: string | null };
  citations: SessionCitation[];
  sections: SessionSection[];
}

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  const { t, locale } = useI18n();
  useDynamicPageTitle(sessionId ? `Session ${sessionId.slice(0, 8)}` : undefined);

  const url = sessionId ? `/api/sessions/${encodeURIComponent(sessionId)}` : null;
  const { data: resp, loading, error } = useFetch<SessionData>(url);

  const citations = useMemo(() => resp?.citations ?? [], [resp?.citations]);
  const timeline = useMemo(() => {
    const session = resp?.session;
    if (!session?.started_at || citations.length < 2) return null;
    const start = new Date(session.started_at).getTime();
    const end = session.ended_at ? new Date(session.ended_at).getTime() : new Date(citations[citations.length - 1].timestamp).getTime();
    const dur = end - start;
    if (dur <= 0) return null;
    return citations.map((c) => {
      const t = new Date(c.timestamp).getTime();
      const pct = Math.max(0, Math.min(1, (t - start) / dur));
      return { pct, confidence: c.confidence, rule_id: c.rule_id, title: c.title };
    });
  }, [resp?.session, citations]);

  if (loading) return <SessionDetailSkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!resp) return null;

  const session = resp.session;
  const sections = resp.sections ?? [];
  const displayId = sessionId.replace('historical_', '');

  const uniqueRules = new Set(citations.map((c) => c.rule_id)).size;
  const confCounts = { high: 0, medium: 0, low: 0 };
  for (const c of citations) {
    if (c.confidence === 'high') confCounts.high++;
    else if (c.confidence === 'medium') confCounts.medium++;
    else confCounts.low++;
  }
  const confBadge = (conf: string) => {
    const label = conf === 'high' ? t('analytics.confidence.high') : conf === 'medium' ? t('analytics.confidence.medium') : t('analytics.confidence.low');
    const cls = conf === 'high' ? 'conf-high' : conf === 'medium' ? 'conf-medium' : 'conf-low';
    return <span className={`conf ${cls}`}>{label}</span>;
  };
  const sectionColorMap: Record<string, string> = {};
  sections.forEach((s, i) => {
    sectionColorMap[s.section_id] = SECTION_COLORS[i % SECTION_COLORS.length];
  });

  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="panel-title" style={{ fontFamily: 'var(--font-display)' }}>{t('session.title')}</h2>
              <p
                className="mono text-[var(--meta)] mt-1 cursor-pointer hover:text-[var(--accent)] transition-colors"
                title="Click to copy"
                onClick={() => { navigator.clipboard.writeText(displayId); toast.success(t('ruleDetail.copied')); }}
              >{displayId}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="pill">{uniqueRules} {t('table.rules').toLowerCase()}</span>
              <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{citations.length} {t('table.matches').toLowerCase()}</span>
              {session.model && <span className="tag mono">{session.model}</span>}
            </div>
          </div>
          {citations.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-[var(--muted)]">{t('session.confidence')}:</span>
              {confCounts.high > 0 && <span className="conf conf-high">{confCounts.high} {t('analytics.confidence.high')}</span>}
              {confCounts.medium > 0 && <span className="conf conf-medium">{confCounts.medium} {t('analytics.confidence.medium')}</span>}
              {confCounts.low > 0 && <span className="conf conf-low">{confCounts.low} {t('analytics.confidence.low')}</span>}
            </div>
          )}
          {session.task_summary && (
            <p className="text-sm text-[var(--muted)] mt-2">{session.task_summary}</p>
          )}
          {session.started_at && (
            <p className="text-xs text-[var(--muted)] mt-2">
              {new Date(session.started_at).toLocaleString(locale)}
              {session.ended_at && (
                <>
                  {` → ${new Date(session.ended_at).toLocaleString(locale)}`}
                  {(() => {
                    const sec = Math.floor((new Date(session.ended_at!).getTime() - new Date(session.started_at!).getTime()) / 1000);
                    const dur = formatDuration(sec);
                    return dur ? <span className="ml-2 mono">({dur})</span> : null;
                  })()}
                </>
              )}
            </p>
          )}
        </div>
        {sections.length > 0 && (
          <div className="border-t border-[var(--border)] pt-4 px-5 pb-5">
            <p className="text-xs font-medium text-[var(--muted)] uppercase mb-2">{t('session.sectionsHit')}</p>
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <Link key={s.section_id} href={`/rules?section=${s.section_id}`}>
                  <span
                    className="border rounded-full text-xs px-2.5 py-0.5 cursor-pointer transition-colors hover:bg-[var(--accent-soft)]"
                    style={{ borderColor: sectionColorMap[s.section_id], color: sectionColorMap[s.section_id] }}
                  >
                    {s.section_title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {timeline && (
        <div className="panel">
          <div className="px-5 py-4">
            <div className="relative h-6">
              <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" />
              {timeline.map((pt, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-transform hover:scale-150"
                    style={{
                      left: `${pt.pct * 100}%`,
                      backgroundColor: pt.confidence === 'high' ? 'var(--success)' : pt.confidence === 'medium' ? 'var(--warn)' : 'var(--danger)',
                    }}
                  >
                    <Link href={`/rules/${pt.rule_id}`} className="block w-full h-full" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                    <span className="font-medium">{pt.title}</span>
                    <br />
                    <span className="text-[var(--muted)]">
                      {pt.confidence === 'high' ? t('analytics.confidence.high') : pt.confidence === 'medium' ? t('analytics.confidence.medium') : t('analytics.confidence.low')}
                    </span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">{t('session.citations')}</h3>
        </div>
        {citations.length > 0 ? (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-[var(--border)]">
              {citations.map((c, i) => (
                <div key={`${c.rule_id}-${i}`} className="px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link href={`/rules/${c.rule_id}`} className="text-sm text-[var(--fg)] hover:text-[var(--accent)] transition-colors truncate">
                      {c.title}
                    </Link>
                    <span className="mono text-[var(--meta)] text-[10px] shrink-0 ml-2">{relativeTime(c.timestamp, locale)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link href={`/rules?section=${c.section_id}`}>
                      <span
                        className="border rounded-full text-[10px] px-2 py-0.5 cursor-pointer transition-colors hover:opacity-80"
                        style={{ borderColor: sectionColorMap[c.section_id], color: sectionColorMap[c.section_id] }}
                      >
                        {c.section_id}
                      </span>
                    </Link>
                    <Link href={`/rules?search=${encodeURIComponent(c.matched_keyword)}`}>
                      <span
                        className="border rounded-full text-[10px] px-2 py-0.5 cursor-pointer transition-colors hover:bg-[var(--accent-soft)]"
                        style={{ borderColor: 'color-mix(in oklch, var(--accent) 30%, transparent)', color: 'var(--accent)' }}
                      >
                        {c.matched_keyword}
                      </span>
                    </Link>
                    {confBadge(c.confidence)}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table layout */}
            <div className="hidden sm:block">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>{t('table.time')}</th>
                    <th>{t('rules.ruleName')}</th>
                    <th>{t('table.keyword')}</th>
                    <th>{t('session.confidence')}</th>
                  </tr>
                </thead>
                <tbody>
                  {citations.map((c, i) => (
                    <tr key={`${c.rule_id}-${i}`}>
                      <td className="mono whitespace-nowrap">
                        {relativeTime(c.timestamp, locale)}
                      </td>
                      <td>
                        <Link href={`/rules/${c.rule_id}`} className="text-sm text-[var(--fg)] hover:text-[var(--accent)] transition-colors">
                          {c.title}
                        </Link>
                        <Link href={`/rules?section=${c.section_id}`}>
                          <span
                            className="border rounded-full text-[10px] ml-2 px-2 py-0.5 cursor-pointer transition-colors hover:opacity-80"
                            style={{ borderColor: sectionColorMap[c.section_id], color: sectionColorMap[c.section_id] }}
                          >
                            {c.section_id}
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Link href={`/rules?search=${encodeURIComponent(c.matched_keyword)}`}>
                          <span
                            className="border rounded-full text-[10px] px-2 py-0.5 cursor-pointer transition-colors hover:bg-[var(--accent-soft)]"
                            style={{ borderColor: 'color-mix(in oklch, var(--accent) 30%, transparent)', color: 'var(--accent)' }}
                          >
                            {c.matched_keyword}
                          </span>
                        </Link>
                      </td>
                      <td>
                        {confBadge(c.confidence)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-6 py-8 text-sm text-[var(--muted)] text-center">{t('ruleDetail.noCitations')}</div>
        )}
      </div>
    </div>
  );
}
