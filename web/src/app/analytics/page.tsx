'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area,
} from 'recharts';
import { StatCard } from '@/components/stat-card';
import { TermTooltip } from '@/components/term-tooltip';
import { CitationHeatmap } from '@/components/citation-heatmap';
import { useI18n } from '@/i18n';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { useFetch } from '@/hooks/use-fetch';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageLoader, PageError, Skeleton } from '@/components/page-states';
import { CHART_COLORS, STAT_COLORS, PRIMARY } from '@/lib/chart-colors';
import type { AnalyticsData } from '@/lib/types';

export default function AnalyticsPage() {
  const [trendMode, setTrendMode] = useState<'day' | 'week' | 'month'>('day');
  const [timeRange, setTimeRange] = useState<number | undefined>(undefined);
  const [expandedConf, setExpandedConf] = useState<string | null>(null);
  const { t } = useI18n();
  const router = useRouter();
  const chartTheme = useChartTheme();
  usePageTitle('analytics.title');
  const tooltipStyle = useTooltipStyle();

  const url = useMemo(() => {
    const params = new URLSearchParams({ trend_group: trendMode });
    if (timeRange) params.set('days', String(timeRange));
    return `/api/analytics?${params}`;
  }, [trendMode, timeRange]);

  const { data, loading, error } = useFetch<AnalyticsData>(url);

  if (loading && !data) return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex"><Skeleton className="w-1 h-16 rounded-l-xl" /><div className="p-5 pl-4 flex-1"><Skeleton className="h-3 w-14 mb-2" /><Skeleton className="h-6 w-10" /></div></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </div>
  );
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
    value: c.citation_count,
    ruleCount: c.rule_count,
  }));

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors"><Home className="w-3.5 h-3.5" /></Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{t('analytics.title')}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">{t('analytics.timeRange')}:</span>
          {([
            { value: undefined, key: 'all' },
            { value: 7, key: '7d' },
            { value: 30, key: '30d' },
            { value: 90, key: '90d' },
          ] as const).map(({ value, key }) => (
            <Button
              key={key}
              size="sm"
              variant={timeRange === value ? 'default' : 'ghost'}
              onClick={() => setTimeRange(value)}
              className="text-xs h-7 px-2"
            >
              {t(`analytics.time.${key}`)}
            </Button>
          ))}
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
        <Card className="rounded-xl border-border bg-card">
          <CardHeader><CardTitle className="text-base">{t('analytics.topRules')}</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border bg-card">
          <CardHeader><CardTitle className="text-base">{t('analytics.sectionDist')}</CardTitle></CardHeader>
          <CardContent>
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
                    label={({ name, percent }: { name?: string; percent?: number }) => <span className="text-xs text-foreground">{name ?? ''} {((percent ?? 0) * 100).toFixed(0)}%</span>}
                    onClick={(_, index) => router.push(`/rules?section=${pieData[index].name}`)}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip {...tooltipStyle} formatter={(value, _name, props) => [`${value} (${(props as { payload: { ruleCount: number } }).payload.ruleCount} rules)`, (props as { payload: { name: string } }).payload.name]} />
                  <Legend formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.citation_trend && data.citation_trend.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('analytics.citationTrend')}</CardTitle>
              <div className="flex gap-1">
                {(['day', 'week', 'month'] as const).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={trendMode === mode ? 'default' : 'ghost'}
                    onClick={() => setTrendMode(mode)}
                    className="text-xs h-7 px-2"
                  >
                    {t(`analytics.trend.${mode}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {data.confidence_distribution && data.confidence_distribution.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('analytics.confidence')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('analytics.confidence.subtitle')}</p>
          </CardHeader>
          <CardContent>
            {(() => {
              const total = data.confidence_distribution.reduce((s, c) => s + c.count, 0);
              const confMap: Record<string, { count: number; color: string; label: string; top_rules: { rule_id: string; title: string; count: number }[] }> = {};
              for (const c of data.confidence_distribution) {
                confMap[c.confidence] = { count: c.count, color: '', label: c.confidence, top_rules: c.top_rules ?? [] };
              }
              const levels = [
                { key: 'high', color: 'bg-emerald-500', textColor: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', label: t('analytics.confidence.high'), desc: t('analytics.confidence.high.desc'), source: 'MCP Tool' },
                { key: 'medium', color: 'bg-amber-500', textColor: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5', label: t('analytics.confidence.medium'), desc: t('analytics.confidence.medium.desc'), source: 'Hook (Stop)' },
                { key: 'low', color: 'bg-rose-500', textColor: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/5', label: t('analytics.confidence.low'), desc: t('analytics.confidence.low.desc'), source: 'Hook (PostToolUse)' },
              ];
              return (
                <div className="space-y-3">
                  <div className="flex h-6 rounded-full overflow-hidden">
                    {levels.map(({ key, color }) => {
                      const count = confMap[key]?.count ?? 0;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      if (pct === 0) return null;
                      return (
                        <div key={key} className={`${color} flex items-center justify-center transition-all`} style={{ width: `${pct}%` }}>
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
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${isExpanded ? `${border} ${bg}` : 'border-transparent hover:bg-accent/30'}`}
                          >
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className="text-xs font-mono font-medium">{count}</span>
                            <span className="text-[10px] text-muted-foreground">({pct.toFixed(1)}%)</span>
                            <svg className={`w-3 h-3 ml-auto text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          {isExpanded && (
                            <div className={`mt-1 ml-5 pl-3 border-l-2 ${border} py-2 space-y-2`}>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                <span>{t('analytics.confidence.source')}: <span className={`font-mono ${textColor}`}>{source}</span></span>
                              </div>
                              {(confMap[key]?.top_rules?.length ?? 0) > 0 && (
                                <div className="space-y-1 mt-1">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('analytics.topRules')}</p>
                                  {(confMap[key]?.top_rules ?? []).map((rule: { rule_id: string; title: string; count: number }) => (
                                    <Link
                                      key={rule.rule_id}
                                      href={`/rules/${rule.rule_id}`}
                                      className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded hover:bg-accent/30 transition-colors"
                                    >
                                      <span className="text-muted-foreground truncate">{rule.title}</span>
                                      <Badge variant="secondary" className="text-[10px] font-mono shrink-0">{rule.count}</Badge>
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
            })()}
          </CardContent>
        </Card>
      )}

      {data.heatmap && data.heatmap.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('analytics.heatmap')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('analytics.heatmap.subtitle')}</p>
          </CardHeader>
          <CardContent>
            <CitationHeatmap data={data.heatmap} />
          </CardContent>
        </Card>
      )}

      {data.cold_rules && data.cold_rules.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                <TermTooltip term={t('term.coldRule')} explanation={t('term.coldRule.desc')} />
              </CardTitle>
              <Badge variant="outline" className="text-amber-500">{data.cold_rules.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.cold_rules.map((rule) => (
                <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant="secondary"
                      className="text-[10px] shrink-0 hover:bg-primary/20 cursor-pointer"
                      onClick={(e) => { e.preventDefault(); router.push(`/rules?section=${rule.section_id}`); }}
                    >{rule.section_id}</Badge>
                    <span className="text-sm truncate">{rule.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 font-mono">
                    {rule.citation_count > 0
                      ? `${rule.citation_count} ${t('table.matches')}`
                      : t('analytics.neverCited')}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
