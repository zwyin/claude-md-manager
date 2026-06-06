'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area,
} from 'recharts';
import { StatCard } from '@/components/stat-card';
import { TermTooltip } from '@/components/term-tooltip';
import { CitationHeatmap } from '@/components/citation-heatmap';
import { useI18n } from '@/i18n';
import { relativeTime } from '@/lib/relative-time';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { useFetch } from '@/hooks/use-fetch';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageError, AnalyticsSkeleton } from '@/components/page-states';
import { CHART_COLORS, STAT_COLORS, PRIMARY } from '@/lib/chart-colors';
import type { AnalyticsData } from '@/lib/types';

export default function AnalyticsPage() {
  const [trendMode, setTrendMode] = useState<'day' | 'week' | 'month'>('day');
  const [timeRange, setTimeRange] = useState<number | undefined>(undefined);
  const [expandedConf, setExpandedConf] = useState<string | null>(null);
  const { t, locale } = useI18n();
  const router = useRouter();
  const chartTheme = useChartTheme();
  usePageTitle('analytics.title');
  const tooltipStyle = useTooltipStyle();

  const url = useMemo(() => {
    const params = new URLSearchParams({ trend_group: trendMode });
    if (timeRange) params.set('days', String(timeRange));
    return `/api/analytics?${params}`;
  }, [trendMode, timeRange]);

  const { data, loading, error, refresh } = useFetch<AnalyticsData>(url);

  if (loading && !data) return <AnalyticsSkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!data) return null;

  const topRulesData = (data.top_rules || []).map((r) => ({
    name: r.title.length > 18 ? r.title.slice(0, 18) + '...' : r.title,
    fullName: r.title,
    citations: r.citation_count,
    coverage: `${(r.session_coverage * 100).toFixed(0)}%`,
    depth: r.avg_depth.toFixed(1),
    rule_id: r.rule_id,
  }));

  const pieData = (data.category_distribution || []).map((c) => ({
    name: c.title || c.section_id,
    section_id: c.section_id,
    value: c.citation_count,
    ruleCount: c.rule_count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 500, lineHeight: 'var(--leading-tight)' }}>{t('analytics.title')}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>{t('analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[var(--meta)] hover:text-[var(--fg)] py-1.5 px-2.5 text-sm disabled:opacity-50"
            title={t('dashboard.refresh')}
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginRight: '4px' }}>{t('analytics.timeRange')}:</span>
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
          <button
            className="border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs py-1.5 px-3 rounded-[var(--radius-sm)] hover:border-[var(--fg)] transition-colors ml-2 flex items-center gap-1"
            onClick={() => {
              const rows = [['rule_id', 'title', 'citations', 'coverage', 'depth']];
              for (const r of (data.top_rules || [])) {
                rows.push([r.rule_id, `"${r.title}"`, String(r.citation_count), (r.session_coverage * 100).toFixed(1) + '%', r.avg_depth.toFixed(1)]);
              }
              const csv = rows.map((r) => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `analytics-rules-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label={t('dashboard.totalRules')} value={data.total_rules} color={STAT_COLORS.rules} href="/rules" />
        <StatCard label={<TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />} value={data.total_citations} color={STAT_COLORS.activeRate} />
        <StatCard label={t('dashboard.totalSessions')} value={data.total_sessions} color={STAT_COLORS.sessions} />
        <StatCard
          label={<TermTooltip term={t('metric.coverage')} explanation={t('metric.coverage.desc')} />}
          value={(data.avg_coverage ?? 0) * 100}
          percentage
          color={STAT_COLORS.avgCoverage}
        />
        <StatCard
          label={<TermTooltip term={t('metric.depth')} explanation={t('metric.depth.desc')} />}
          value={(data.avg_depth ?? 0).toFixed(1)}
          color={STAT_COLORS.avgDepth}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: 'var(--text-lg)' }}>{t('analytics.topRules')}</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRulesData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: chartTheme.mutedForeground, fontSize: 12 }} />
                <RechartsTooltip {...tooltipStyle} formatter={(value, _name, props) => {
                  const p = (props as { payload: { fullName: string; coverage: string; depth: string } }).payload;
                  return [`${value} ${t('table.matches')} · ${p.coverage} ${t('metric.coverage')} · ${p.depth} ${t('metric.depth')}`, p.fullName];
                }} />
                <Bar dataKey="citations" radius={[0, 4, 4, 0]} maxBarSize={20} style={{ cursor: 'pointer' }}>
                  {topRulesData.map((entry, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} onClick={() => router.push(`/rules/${entry.rule_id}`)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: 'var(--text-lg)' }}>{t('analytics.sectionDist')}</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  style={{ cursor: 'pointer' }}
                  label={({ name, percent }: { name?: string; percent?: number }) => <span style={{ fontSize: '10px', color: 'var(--fg)' }}>{name ?? ''} {((percent ?? 0) * 100).toFixed(0)}%</span>}
                  onClick={(_, index) => router.push(`/rules?section=${encodeURIComponent(pieData[index].section_id)}`)}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip {...tooltipStyle} formatter={(value, _name, props) => [`${value} (${(props as { payload: { ruleCount: number } }).payload.ruleCount} ${t('table.rules')})`, (props as { payload: { name: string } }).payload.name]} />
                <Legend formatter={(value: string) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title" style={{ fontSize: 'var(--text-lg)' }}>
              {t('analytics.citationTrend')}
              {data.citation_trend && data.citation_trend.length > 0 && (
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--muted)', marginLeft: '8px' }}>
                  ({t('analytics.avgPerDay')}: {Math.round(data.citation_trend.reduce((s, p) => s + p.count, 0) / (data.citation_trend.length || 1)).toLocaleString()})
                </span>
              )}
            </h3>
          </div>
          {data.citation_trend && data.citation_trend.length > 0 && (
            <div className="time-filter">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  className={trendMode === mode ? 'active' : ''}
                  onClick={() => setTrendMode(mode)}
                >
                  {t(`analytics.trend.${mode}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        {data.citation_trend && data.citation_trend.length > 0 ? (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.citation_trend} margin={{ left: 0, right: 20 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                <YAxis tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                <RechartsTooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke={PRIMARY} fill="url(#trendGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[120px] flex items-center justify-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{t('analytics.noData')}</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title" style={{ fontSize: 'var(--text-lg)' }}>{t('analytics.confidence')}</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>{t('analytics.confidence.subtitle')}</p>
          </div>
        </div>
        {data.confidence_distribution && data.confidence_distribution.length > 0 ? (() => {
          const total = data.confidence_distribution.reduce((s, c) => s + c.count, 0);
          const confMap: Record<string, { count: number; color: string; label: string; top_rules: { rule_id: string; title: string; count: number }[] }> = {};
          for (const c of data.confidence_distribution) {
            confMap[c.confidence] = { count: c.count, color: '', label: c.confidence, top_rules: c.top_rules ?? [] };
          }
          const levels = [
            { key: 'high', color: 'var(--success)', textColor: 'var(--success)', border: 'color-mix(in oklch, var(--success) 30%, transparent)', bg: 'color-mix(in oklch, var(--success) 5%, transparent)', label: t('analytics.confidence.high'), desc: t('analytics.confidence.high.desc'), source: t('analytics.confidence.source.mcp') },
            { key: 'medium', color: 'var(--warn)', textColor: 'var(--warn)', border: 'color-mix(in oklch, var(--warn) 30%, transparent)', bg: 'color-mix(in oklch, var(--warn) 5%, transparent)', label: t('analytics.confidence.medium'), desc: t('analytics.confidence.medium.desc'), source: t('analytics.confidence.source.stop') },
            { key: 'low', color: 'var(--meta)', textColor: 'var(--meta)', border: 'color-mix(in oklch, var(--meta) 30%, transparent)', bg: 'color-mix(in oklch, var(--meta) 5%, transparent)', label: t('analytics.confidence.low'), desc: t('analytics.confidence.low.desc'), source: t('analytics.confidence.source.posttool') },
          ];
          return (
            <div className="space-y-3">
              <div className="flex h-6 rounded-full overflow-hidden">
                {levels.map(({ key, color }) => {
                  const count = confMap[key]?.count ?? 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div key={key} className="flex items-center justify-center transition-all" style={{ width: `${pct}%`, background: `color-mix(in oklch, ${color} 70%, transparent)` }}>
                      {pct > 8 && <span className="text-[10px] text-white font-medium">{pct.toFixed(0)}%</span>}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                {levels.map(({ key, color, textColor, border, bg, label, desc, source }) => {
                  const count = confMap[key]?.count ?? 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  const isExpanded = expandedConf === key;
                  return (
                    <div key={key}>
                      <button
                        onClick={() => setExpandedConf(isExpanded ? null : key)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left"
                        style={{
                          borderColor: isExpanded ? border : 'transparent',
                          background: isExpanded ? bg : 'transparent',
                        }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{label}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[80px]" style={{ background: 'color-mix(in oklch, var(--muted) 15%, transparent)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="mono" style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>{count}</span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>({pct.toFixed(1)}%)</span>
                        <svg className={`w-3 h-3 ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="mt-1 ml-5 pl-3 py-2 space-y-2" style={{ borderLeft: `2px solid ${border}` }}>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{desc}</p>
                          <div className="flex items-center gap-4" style={{ fontSize: '10px', color: 'var(--muted)' }}>
                            <span>{t('analytics.confidence.source')}: <span className="mono" style={{ color: textColor }}>{source}</span></span>
                          </div>
                          {(confMap[key]?.top_rules?.length ?? 0) > 0 && (
                            <div className="space-y-1 mt-1">
                              <p style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('analytics.topRules')}</p>
                              {(confMap[key]?.top_rules ?? []).map((rule: { rule_id: string; title: string; count: number }) => (
                                <Link
                                  key={rule.rule_id}
                                  href={`/rules/${rule.rule_id}`}
                                  className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-[var(--fg-soft)] transition-colors"
                                  style={{ fontSize: 'var(--text-xs)' }}
                                >
                                  <span style={{ color: 'var(--muted)' }} className="truncate">{rule.title}</span>
                                  <span className="pill shrink-0">{rule.count}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })() : (
          <div className="h-[80px] flex items-center justify-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{t('analytics.noData')}</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title" style={{ fontSize: 'var(--text-lg)' }}>{t('analytics.heatmap')}</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>{t('analytics.heatmap.subtitle')}</p>
          </div>
        </div>
        {data.heatmap && data.heatmap.length > 0 ? (
          <CitationHeatmap data={data.heatmap} />
        ) : (
          <div className="h-[80px] flex items-center justify-center" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{t('analytics.noData')}</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: 'var(--text-lg)' }}>
            <TermTooltip term={t('term.coldRule')} explanation={t('term.coldRule.desc')} />
          </h3>
          {data.cold_rules && data.cold_rules.length > 0 && (
            <span className="tag" style={{ color: 'var(--warn)' }}>{data.cold_rules.length}</span>
          )}
        </div>
        <div className={data.cold_rules && data.cold_rules.length > 0 ? '-mt-2 -mx-6 -mb-6' : ''}>
          {data.cold_rules && data.cold_rules.length > 0 ? (
            <div>
              {data.cold_rules.map((rule) => (
                <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-[var(--fg-soft)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="shrink-0 cursor-pointer pill"
                      onClick={(e) => { e.preventDefault(); router.push(`/rules?section=${rule.section_id}`); }}
                    >{rule.section_id}</span>
                    <span className="text-sm truncate" style={{ color: 'var(--fg)' }}>{rule.title}</span>
                  </div>
                  <span className="shrink-0 mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    {rule.citation_count > 0
                      ? `${rule.citation_count} ${t('table.matches')}`
                      : t('analytics.neverCited')}
                    {rule.last_cited && (
                      <span className="ml-2" style={{ fontSize: '10px' }}>{relativeTime(rule.last_cited, locale)}</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--success) 10%, transparent)' }}>
                <svg className="w-5 h-5" style={{ color: 'var(--success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span style={{ fontSize: 'var(--text-sm)' }}>{t('analytics.allRulesActive')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
