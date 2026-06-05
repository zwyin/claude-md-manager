'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StatCard } from '@/components/stat-card';
import { PageError, DashboardSkeleton } from '@/components/page-states';
import { ChartErrorBoundary } from '@/components/chart-error-boundary';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { useFetch } from '@/hooks/use-fetch';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { usePageTitle } from '@/hooks/use-page-title';
import { CHART_COLORS, STAT_COLORS } from '@/lib/chart-colors';
import { relativeTime } from '@/lib/relative-time';
import type { RuleWithStats, SectionWithStats, CitationTimePoint, RecentCitation, RecentSession } from '@/lib/types';

type SessionEntry = RecentSession;

interface BuildEvent {
  id: number;
  published_at: string;
  rules_changed: number;
  status: string;
}

interface DashboardData {
  rules: RuleWithStats[]; sections: SectionWithStats[];
  total_rules: number; total_sessions: number; active_rule_pct: number;
  total_citations: number; avg_coverage: number; avg_depth: number;
  citation_trend: CitationTimePoint[];
  session_trend: { period: string; count: number }[];
  recent_citations: RecentCitation[];
  recent_builds: BuildEvent[];
  model_distribution: { model: string; count: number }[];
  recent_sessions: SessionEntry[];
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<number | undefined>(undefined);
  const [coldOpen, setColdOpen] = useState(false);
  const { t, locale } = useI18n();
  const router = useRouter();
  const chartTheme = useChartTheme();
  usePageTitle('dashboard.title');
  const tooltipStyle = useTooltipStyle();

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (timeRange) params.set('days', String(timeRange));
    return `/api/rules${params.toString() ? '?' + params.toString() : ''}`;
  }, [timeRange]);

  const { data, loading, error, refresh, fetchedAt } = useFetch<DashboardData>(url);
  const recentSessions = data?.recent_sessions ?? [];

  if (loading && !data) return <DashboardSkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!data) return null;

  const topRules = [...(data.rules || [])].sort((a, b) => b.match_count - a.match_count).slice(0, 10);
  const coldRules = [...(data.rules || [])].sort((a, b) => a.match_count - b.match_count).slice(0, 10);
  const sections = data.sections || [];
  const totalCitations = data.total_citations ?? 0;
  const avgCoverage = data.avg_coverage ?? 0;
  const avgDepth = data.avg_depth ?? 0;

  // CSS bar chart helpers
  const maxSectionCitations = Math.max(...sections.map((s) => s.total_citations), 1);
  const maxTopRuleCitations = Math.max(...topRules.map((r) => r.match_count), 1);
  const maxModelCount = data.model_distribution ? Math.max(...data.model_distribution.map((m) => m.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 500, lineHeight: 'var(--leading-tight)' }}>
            {t('dashboard.title')}
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: 'var(--space-2)' }}>{t('dashboard.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {fetchedAt && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>
              {t('dashboard.lastUpdated', { ago: relativeTime(new Date(fetchedAt).toISOString(), locale) })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              width: 36, height: 36, display: 'grid', placeItems: 'center',
              borderRadius: 'var(--radius-sm)', color: 'var(--muted)',
              border: 'none', background: 'none', cursor: loading ? 'default' : 'pointer',
              transition: 'background var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard)',
            }}
            title={t('dashboard.refresh')}
            aria-label={t('dashboard.refresh')}
          >
            <svg className={loading ? 'animate-spin' : ''} style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <div className="time-filter">
            {([
              { value: undefined, key: 'all' },
              { value: 7, key: '7d' },
              { value: 30, key: '30d' },
              { value: 90, key: '90d' },
            ] as const).map(({ value, key }) => (
              <button
                key={key}
                className={timeRange === value ? 'active' : ''}
                onClick={() => setTimeRange(value)}
              >
                {t(`analytics.time.${key}`)}
              </button>
            ))}
          </div>
          {data.recent_citations && data.recent_citations.length > 0 && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {t('dashboard.lastActivity', { time: relativeTime(data.recent_citations[0].timestamp, locale) })}
            </span>
          )}
          {data.recent_builds && data.recent_builds.length > 0 && (
            <div className="build-status">
              <span className="status-dot"></span>
              {t('dashboard.recentBuilds')}: {relativeTime(data.recent_builds[0].published_at, locale)}
            </div>
          )}
        </div>
      </div>

      {/* ─── Stat Cards ─────────────────────────────────────────── */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard
          label={t('dashboard.totalRules')}
          value={data.total_rules}
          sublabel={t('dashboard.inSections', { count: sections.length })}
          color={STAT_COLORS.rules}
          href="/rules"
        />
        <StatCard
          label={t('dashboard.totalSessions')}
          value={data.total_sessions}
          color={STAT_COLORS.sessions}
          href="/sessions"
        />
        <StatCard
          label={<TermTooltip term={t('term.activeRate')} explanation={t('term.activeRate.desc')} />}
          value={data.active_rule_pct}
          percentage
          color={STAT_COLORS.activeRate}
        />
        <StatCard
          label={<TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />}
          value={totalCitations}
          color={STAT_COLORS.citations}
          href="/analytics"
          trend={(data.citation_trend || []).map((p) => ({ date: p.period, count: p.count }))}
        />
        <StatCard
          label={<TermTooltip term={t('metric.coverage')} explanation={t('metric.coverage.desc')} />}
          value={avgCoverage * 100}
          percentage
          color={STAT_COLORS.avgCoverage}
        />
        <StatCard
          label={<TermTooltip term={t('metric.depth')} explanation={t('metric.depth.desc')} />}
          value={avgDepth.toFixed(1)}
          color={STAT_COLORS.avgDepth}
        />
      </div>

      {/* ─── Citation Trend + Session Trend ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {data.citation_trend && data.citation_trend.length > 1 && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                {t('analytics.citationTrend')}
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--meta)', marginLeft: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>
                  ({t('analytics.avgPerDay')}: {Math.round(data.citation_trend.reduce((s, p) => s + p.count, 0) / (data.citation_trend.length || 1)).toLocaleString()})
                </span>
              </h3>
            </div>
            <div style={{ height: 180 }}>
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.citation_trend} margin={{ left: 0, right: 20 }}>
                    <defs>
                      <linearGradient id="dashTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c96442" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#c96442" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="period" tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                    <YAxis tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                    <RechartsTooltip {...tooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="#c96442" fill="url(#dashTrendGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            </div>
          </div>
        )}

        {data.session_trend && data.session_trend.length > 1 && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                {t('dashboard.sessionTrend')}
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--meta)', marginLeft: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>
                  ({t('analytics.avgPerDay')}: {Math.round(data.session_trend.reduce((s, p) => s + p.count, 0) / (data.session_trend.length || 1)).toLocaleString()})
                </span>
              </h3>
            </div>
            <div style={{ height: 180 }}>
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.session_trend} margin={{ left: 0, right: 20 }}>
                    <defs>
                      <linearGradient id="sessionTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5e5d59" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#5e5d59" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="period" tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                    <YAxis tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                    <RechartsTooltip {...tooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="#5e5d59" fill="url(#sessionTrendGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            </div>
          </div>
        )}
      </div>

      {/* ─── Section Overview + Top Rules (CSS bar charts) ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Section Overview */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">{t('dashboard.sections')}</h3>
            <Link href="/rules" className="panel-link">{t('dashboard.viewAll')} &rarr;</Link>
          </div>
          <div className="bar-list">
            {sections.map((s) => (
              <div
                key={s.section_id}
                className="bar-item clickable"
                onClick={() => router.push(`/rules?section=${s.section_id}`)}
              >
                <span className="bar-label">{s.title}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(s.total_citations / maxSectionCitations) * 100}%` }}></div>
                </div>
                <span className="bar-count">{s.total_citations}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 10 Rules */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">{t('dashboard.topRules')}</h3>
            <Link href="/analytics" className="panel-link">{t('dashboard.viewAll')} &rarr;</Link>
          </div>
          <div className="bar-list">
            {topRules.map((r) => (
              <div
                key={r.rule_id}
                className="bar-item clickable"
                onClick={() => router.push(`/rules/${r.rule_id}`)}
              >
                <span className="bar-label">{r.title}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(r.match_count / maxTopRuleCitations) * 100}%` }}></div>
                </div>
                <span className="bar-count">{r.match_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Model Distribution + Recent Citations ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Model Distribution */}
        {data.model_distribution && data.model_distribution.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">{t('dashboard.modelDistribution')}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {data.model_distribution.map((m, mi) => (
                <div key={m.model} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', width: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.model}>{m.model}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--border-soft)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 'var(--radius-pill)', width: `${(m.count / maxModelCount) * 100}%`, background: CHART_COLORS[mi % CHART_COLORS.length], transition: 'width 0.4s var(--ease-standard)' }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--muted)', width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Citations */}
        {data.recent_citations && data.recent_citations.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">{t('dashboard.recentCitations')}</h3>
              <Link href="/analytics" className="panel-link">{t('dashboard.viewAll')} &rarr;</Link>
            </div>
            <table className="records-table">
              <thead>
                <tr>
                  <th>{t('table.keyword')}</th>
                  <th>{t('table.rule')}</th>
                  <th>{t('table.model')}</th>
                  <th>{t('table.confidence')}</th>
                  <th>{t('table.time')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_citations.slice(0, 8).map((c, i) => (
                  <tr key={`${c.rule_id}-${c.timestamp}-${i}`}>
                    <td>
                      <Link href={`/rules?search=${encodeURIComponent(c.matched_keyword)}`}>
                        <span className="pill">{c.matched_keyword}</span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/rules/${c.rule_id}`} style={{ color: 'var(--fg-2)', transition: 'color var(--motion-fast)' }}>
                        {c.title}
                      </Link>
                    </td>
                    <td className="mono">{c.model || '—'}</td>
                    <td>
                      <span className={`conf conf-${c.confidence}`}>
                        <span className="conf-dot"></span>
                        {c.confidence}
                      </span>
                    </td>
                    <td className="mono" style={{ color: 'var(--meta)' }}>
                      <Link href={`/sessions/${encodeURIComponent(c.session_id)}`} style={{ color: 'var(--meta)' }} title={new Date(c.timestamp).toLocaleString(locale)}>
                        {relativeTime(c.timestamp, locale)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Recent Sessions + Recent Builds ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">{t('dashboard.recentSessions')}</h3>
              <Link href="/sessions" className="panel-link">{t('dashboard.viewAll')} &rarr;</Link>
            </div>
            <table className="records-table">
              <thead>
                <tr>
                  <th>{t('table.sessionId')}</th>
                  <th>{t('table.time')}</th>
                  <th>{t('table.model')}</th>
                  <th>{t('table.rules')}</th>
                  <th>{t('table.task')}</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr
                    key={s.session_id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/sessions/${encodeURIComponent(s.session_id)}`)}
                  >
                    <td className="mono" style={{ color: 'var(--accent)' }}>{s.session_id.slice(0, 8)}</td>
                    <td className="mono" style={{ color: 'var(--meta)' }}>
                      {s.started_at
                        ? new Date(s.started_at).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td>
                      {s.model ? <span className="tag">{s.model}</span> : '—'}
                    </td>
                    <td className="mono">{s.rule_count > 0 ? s.rule_count : '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.task_summary || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent Builds */}
        {data.recent_builds && data.recent_builds.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">{t('dashboard.recentBuilds')}</h3>
              <Link href="/history" className="panel-link">{t('dashboard.viewAll')} &rarr;</Link>
            </div>
            <table className="records-table">
              <thead>
                <tr>
                  <th>{t('table.status')}</th>
                  <th>{t('table.time')}</th>
                  <th>{t('table.rulesChanged')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_builds.map((build) => (
                  <tr
                    key={build.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push('/history')}
                  >
                    <td>
                      <span className={`conf ${build.status === 'success' ? 'conf-high' : 'conf-medium'}`}>
                        <span className="conf-dot"></span>
                        {build.status === 'success' ? t('dashboard.buildStatus.success') : t('dashboard.buildStatus.failed')}
                      </span>
                    </td>
                    <td className="mono" style={{ color: 'var(--meta)' }}>
                      {relativeTime(build.published_at, locale)}
                    </td>
                    <td className="mono">{build.rules_changed} {t('table.rules').toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Cold Rules (Collapsible) ──────────────────────────────── */}
      {coldRules.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div className="panel">
            <button
              className={`collapse-toggle${coldOpen ? ' open' : ''}`}
              onClick={() => setColdOpen(!coldOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)', color: 'var(--muted)', cursor: 'pointer',
                padding: 'var(--space-2) 0', border: 'none', background: 'none', width: '100%', font: 'inherit',
              }}
            >
              <svg
                style={{ width: 14, height: 14, transition: 'transform var(--motion-fast) var(--ease-standard)', transform: coldOpen ? 'rotate(90deg)' : 'none' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
              <TermTooltip term={t('term.coldRule')} explanation={t('term.coldRule.desc')} />
              <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--warn)' }}>
                {t('dashboard.coldRules.count', { count: coldRules.length })}
              </span>
            </button>
            <div className={`collapse-body${coldOpen ? ' open' : ''}`}>
              <table className="records-table" style={{ marginTop: 'var(--space-4)' }}>
                <thead>
                  <tr>
                    <th>{t('table.rule')}</th>
                    <th>{t('table.section')}</th>
                    <th>{t('table.citations')}</th>
                    <th>{t('table.lastCited')}</th>
                  </tr>
                </thead>
                <tbody>
                  {coldRules.map((rule) => (
                    <tr
                      key={rule.rule_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/rules/${rule.rule_id}`)}
                    >
                      <td>{rule.title}</td>
                      <td style={{ color: 'var(--muted)' }}>
                        <span
                          className="tag"
                          onClick={(e) => { e.stopPropagation(); router.push(`/rules?section=${rule.section_id}`); }}
                          style={{ cursor: 'pointer' }}
                        >
                          {rule.section_id}
                        </span>
                      </td>
                      <td className="mono" style={{ color: 'var(--meta)' }}>
                        {rule.match_count > 0 ? rule.match_count : '0'}
                      </td>
                      <td className="mono" style={{ color: 'var(--meta)' }}>
                        {rule.last_cited ? relativeTime(rule.last_cited, locale) : t('analytics.neverCited')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
