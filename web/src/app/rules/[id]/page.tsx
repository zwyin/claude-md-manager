'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight, Home, Pencil } from 'lucide-react';
import { TermTooltip } from '@/components/term-tooltip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { STAT_COLORS, PRIMARY } from '@/lib/chart-colors';
import { relativeTime } from '@/lib/relative-time';
import { DetailMetricBar, DepthGauge } from '@/components/metric-visualizations';
import { PageError, RuleDetailSkeleton } from '@/components/page-states';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { useDynamicPageTitle } from '@/hooks/use-page-title';
import { toast } from 'sonner';
import type { RuleDetail, CitationRecord, SiblingRule, CoOccurringRule } from '@/lib/types';

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params?.id as string;
  const { t, locale } = useI18n();
  const [citeLimit, setCiteLimit] = useState(50);
  const [trendRange, setTrendRange] = useState<number | undefined>(undefined);
  const prevRuleId = useRef(ruleId);
  if (prevRuleId.current !== ruleId) {
    prevRuleId.current = ruleId;
    setCiteLimit(50);
  }

  const url = ruleId ? `/api/rules/${encodeURIComponent(ruleId)}` : null;
  const { data: resp, loading, error } = useFetch<{ rule: RuleDetail; citations: CitationRecord[]; siblings: SiblingRule[]; co_occurring: CoOccurringRule[]; total_sessions: number; total_citations: number }>(url);
  const rule = resp?.rule ?? null;
  const siblings = resp?.siblings ?? [];
  const coOccurring = resp?.co_occurring ?? [];
  const totalSessions = resp?.total_sessions ?? 0;
  const totalCitations = resp?.total_citations ?? 0;

  useDynamicPageTitle(rule?.title);
  const chartTheme = useChartTheme();
  const tooltipStyle = useTooltipStyle();

  const citations = useMemo(() => resp?.citations ?? [], [resp?.citations]);
  const trendData = useMemo(() => {
    const src = resp?.citations ?? [];
    if (src.length === 0) return [];
    // eslint-disable-next-line react-hooks/purity -- cutoff needs current time for accuracy
    const cutoffMs = trendRange ? Date.now() - trendRange * 86400000 : 0;
    const counts: Record<string, number> = {};
    for (const c of src) {
      if (cutoffMs && new Date(c.timestamp).getTime() < cutoffMs) continue;
      const day = c.timestamp.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }));
  }, [resp?.citations, trendRange]);

  if (loading && !resp) return <RuleDetailSkeleton />;
  if (error) return (
    <div className="space-y-4">
      <Link href="/rules" className="text-sm text-[var(--accent)] hover:underline">&larr; {t('ruleDetail.backTo', { section: t('rules.title') })}</Link>
      <PageError message={t('status.error', { error })} />
    </div>
  );
  if (!rule) return null;

  const uniqueSessions = new Set(citations.map((c) => c.session_id)).size;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--fg)] transition-colors"><Home className="w-3.5 h-3.5" /></Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/rules" className="hover:text-[var(--fg)] transition-colors">{t('rules.title')}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/rules?section=${rule.section_id}`} className="hover:text-[var(--fg)] transition-colors">{rule.section_title}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[var(--fg)]">{rule.title}</span>
      </nav>

      <div className="panel">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-mono text-[var(--meta)]">{rule.rule_id}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(rule.rule_id); toast.success(t('ruleDetail.copied')); }}
                className="text-[var(--meta)] hover:text-[var(--fg)] transition-colors"
                aria-label={t('ruleDetail.copyId')}
                title={t('ruleDetail.copyId')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <h1 className="text-xl font-display font-semibold text-[var(--fg)]">{rule.title}</h1>
            <p className="text-sm text-[var(--meta)] mt-2 space-x-2">
              <span>{t('ruleDetail.section')}:
                <Link href={`/rules?section=${rule.section_id}`} className="font-medium text-[var(--accent)] hover:underline ml-1">{rule.section_title}</Link>
              </span>
              <span>·</span>
              <span>{t('ruleDetail.source')}:
                <span className="font-medium text-[var(--fg)] ml-1">{rule.source_file}</span>
              </span>
            </p>
            {rule.last_cited && (
              <p className="text-xs text-[var(--meta)] mt-1">
                {t('ruleDetail.lastCited')}: {new Date(rule.last_cited).toLocaleString(locale)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/editor?rule=${encodeURIComponent(rule.rule_id)}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--accent)] transition-colors">
              <Pencil className="w-3 h-3" />
              {t('ruleDetail.editInEditor')}
            </Link>
            <span className="pill bg-[var(--surface-warm)] text-[var(--fg-2)]">{uniqueSessions} {t('table.sessions')}</span>
            <span className={`pill ${rule.citation_count === 0 ? 'bg-[var(--danger)] text-white' : 'bg-[var(--accent)] text-[var(--accent-on)]'}`}>{rule.citation_count} {t('table.matches')}</span>
          </div>
        </div>
        <div className="border-t border-[var(--border)] pt-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col items-center">
              <p className="text-xs text-[var(--meta)] mb-1">
                <TermTooltip term={t('metric.coverage.full')} explanation={t('metric.coverage.desc')} />
              </p>
              <p className="text-lg font-bold">{totalSessions > 0 ? ((uniqueSessions / totalSessions) * 100).toFixed(1) : '0'}%</p>
              <p className="text-[10px] font-mono text-[var(--meta)]">{uniqueSessions}/{totalSessions} {t('table.sessions').toLowerCase()}</p>
              <DetailMetricBar value={totalSessions > 0 ? uniqueSessions / totalSessions : 0} color={STAT_COLORS.avgCoverage} />
            </div>
            <div className="flex flex-col items-center">
              <p className="text-xs text-[var(--meta)] mb-1">
                <TermTooltip term={t('metric.depth.full')} explanation={t('metric.depth.desc')} />
              </p>
              <p className="text-lg font-bold">{uniqueSessions > 0 ? (rule.citation_count / uniqueSessions).toFixed(1) : '0'}</p>
              <p className="text-[10px] font-mono text-[var(--meta)]">{rule.citation_count}/{uniqueSessions} {t('table.matches').toLowerCase()}/{t('table.sessions').toLowerCase()}</p>
              <DepthGauge value={uniqueSessions > 0 ? rule.citation_count / uniqueSessions : 0} max={5} />
            </div>
            <div className="flex flex-col items-center">
              <p className="text-xs text-[var(--meta)] mb-1">
                <TermTooltip term={t('metric.share.full')} explanation={t('metric.share.desc')} />
              </p>
              <p className="text-lg font-bold">{totalCitations > 0 ? ((rule.citation_count / totalCitations) * 100).toFixed(1) : '0'}%</p>
              <p className="text-[10px] font-mono text-[var(--meta)]">{rule.citation_count}/{totalCitations} {t('table.matches').toLowerCase()}</p>
              <DetailMetricBar value={totalCitations > 0 ? rule.citation_count / totalCitations : 0} color={STAT_COLORS.citations} />
            </div>
          </div>
        </div>
        {rule.keywords && rule.keywords.length > 0 && (
          <div className="border-t border-[var(--border)] pt-4 mt-4">
            <p className="text-xs font-medium text-[var(--meta)] uppercase mb-2">
              <TermTooltip term={t('term.keywords')} explanation={t('term.keywords.desc')} />
            </p>
            <div className="flex flex-wrap gap-2">
              {rule.keywords.map((kw) => (
                <Link key={kw} href={`/rules?search=${encodeURIComponent(kw)}`}>
                  <span className="tag">{kw}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-semibold text-[var(--fg)]">{t('ruleDetail.content')}</h2>
          {rule.body && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--meta)] font-mono">
                {rule.body.trim().split(/\s+/).filter(Boolean).length} {t('editor.words')} · {rule.body.split('\n').length} {t('editor.lines')}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(rule.body!); toast.success(t('ruleDetail.copyContent')); }}
                className="text-[var(--meta)] hover:text-[var(--fg)] transition-colors"
                aria-label={t('ruleDetail.copyContent')}
                title={t('ruleDetail.copyContent')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {rule.body ? (
          <div className="prose prose-sm max-w-none
            prose-headings:text-[var(--fg)] prose-p:text-[var(--fg-2)] prose-strong:text-[var(--fg)]
            prose-code:text-[var(--fg)] prose-a:text-[var(--accent)]
            prose-code:before:content-[''] prose-code:after:content-['']">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {rule.body}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="py-6 text-sm text-[var(--meta)] text-center">{t('ruleDetail.noContent')}</div>
        )}
      </div>

      {siblings.length > 0 && (
        <div className="panel">
          <h2 className="text-base font-display font-semibold text-[var(--fg)] mb-4">{t('ruleDetail.sameSection')} ({rule.section_title})</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {siblings.map((sib) => (
              <Link key={sib.rule_id} href={`/rules/${sib.rule_id}`}
                className="shrink-0 w-48 p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-warm)] hover:border-[var(--accent)] transition-colors">
                <p className="text-xs font-mono text-[var(--meta)] mb-1">{sib.rule_id}</p>
                <p className="text-sm font-medium text-[var(--fg)] truncate">{sib.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="pill bg-[var(--surface-warm)] text-[var(--fg-2)] text-[10px] font-mono">{sib.match_count} {t('table.matches').toLowerCase()}</span>
                  <span className="pill text-[10px] font-mono" style={{ borderColor: STAT_COLORS.avgCoverage, color: STAT_COLORS.avgCoverage }}>{(sib.session_coverage * 100).toFixed(0)}%</span>
                  <span className="pill text-[10px] font-mono" style={{ borderColor: STAT_COLORS.avgDepth, color: STAT_COLORS.avgDepth }}>{sib.avg_depth.toFixed(1)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {coOccurring.length > 0 && (
        <div className="panel">
          <h2 className="text-base font-display font-semibold text-[var(--fg)] mb-1">{t('ruleDetail.coOccurring')}</h2>
          <p className="text-xs text-[var(--meta)] mb-4">{t('ruleDetail.coOccurring.desc')}</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {coOccurring.map((co) => (
              <Link key={co.rule_id} href={`/rules/${co.rule_id}`}
                className="shrink-0 w-48 p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-warm)] hover:border-[var(--accent)] transition-colors">
                <p className="text-xs font-mono text-[var(--meta)] mb-1">{co.section_id}</p>
                <p className="text-sm font-medium text-[var(--fg)] truncate">{co.title}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="pill bg-[var(--surface-warm)] text-[var(--fg-2)] text-[10px] font-mono">{co.co_sessions} {t('table.sessions').toLowerCase()}</span>
                  <span className="pill text-[10px] font-mono">{co.total_matches} {t('table.matches').toLowerCase()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {trendData.length > 1 && (
        <div className="panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-display font-semibold text-[var(--fg)]">{t('ruleDetail.citationTrend')}</h2>
            <div className="flex gap-1">
              {([
                { value: undefined, key: 'all' },
                { value: 7, key: '7d' },
                { value: 30, key: '30d' },
                { value: 90, key: '90d' },
              ] as const).map(({ value, key }) => (
                <button
                  key={key}
                  onClick={() => setTrendRange(value)}
                  className={`text-xs h-7 px-2 rounded-[var(--radius-sm)] border transition-colors ${
                    trendRange === value
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]'
                  }`}
                >
                  {t(`analytics.time.${key}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: 0, right: 10 }}>
                <defs>
                  <linearGradient id="ruleTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                <YAxis tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                <RechartsTooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke={PRIMARY} fill="url(#ruleTrendGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="panel">
        <h2 className="text-base font-display font-semibold text-[var(--fg)] flex items-center gap-2 mb-4">
          <TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />
          <span className="text-[var(--meta)] font-normal">({citations.length})</span>
        </h2>
        {citations.length > 0 ? (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-[var(--border)]">
              {citations.slice(0, citeLimit).map((c) => (
                <div key={c.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="tag text-[10px]">{c.matched_keyword}</span>
                    <span className="text-[10px] text-[var(--meta)] font-mono shrink-0 ml-2">{relativeTime(c.timestamp, locale)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link href={`/sessions/${encodeURIComponent(c.session_id)}`} className="text-[10px] font-mono text-[var(--meta)] hover:text-[var(--accent)] transition-colors truncate">
                      {c.session_id.replace('historical_', '').slice(0, 12)}
                    </Link>
                    {c.model && <span className="pill bg-[var(--surface-warm)] text-[var(--fg-2)] text-[10px] font-mono">{c.model}</span>}
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
                    <th>{t('table.keyword')}</th>
                    <th>{t('ruleDetail.model')}</th>
                    <th>{t('session.confidence')}</th>
                    <th>{t('table.sessionId')}</th>
                  </tr>
                </thead>
                <tbody>
                  {citations.slice(0, citeLimit).map((c) => (
                    <tr key={c.id}>
                      <td className="text-xs font-mono whitespace-nowrap" title={new Date(c.timestamp).toLocaleString(locale)}>
                        {relativeTime(c.timestamp, locale)}
                      </td>
                      <td><span className="tag text-xs">{c.matched_keyword}</span></td>
                      <td className="text-xs">
                        {c.model ? <span className="pill bg-[var(--surface-warm)] text-[var(--fg-2)] text-[10px] font-mono">{c.model}</span> : <span className="text-[var(--meta)]">—</span>}
                      </td>
                      <td><span className={`conf conf-${c.confidence} text-[10px]`}>{c.confidence === "high" ? t("analytics.confidence.high") : c.confidence === "medium" ? t("analytics.confidence.medium") : t("analytics.confidence.low")}</span></td>
                      <td className="text-xs font-mono text-[var(--meta)] max-w-[200px] truncate" title={c.task_summary || undefined}>
                        <Link href={`/sessions/${encodeURIComponent(c.session_id)}`} className="hover:text-[var(--accent)] transition-colors">
                          {c.session_id.replace('historical_', '')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {citations.length > citeLimit && (
              <div className="px-6 py-3 text-center border-t border-[var(--border)]">
                <span className="text-xs text-[var(--meta)] mr-3">
                  {t('ruleDetail.showing', { shown: citeLimit, total: citations.length })}
                </span>
                <button
                  onClick={() => setCiteLimit((l) => l + 50)}
                  className="px-3 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                >
                  {t('ruleDetail.loadMore')}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-sm text-[var(--meta)] text-center">{t('ruleDetail.noCitations')}</div>
        )}
      </div>
    </div>
  );
}
