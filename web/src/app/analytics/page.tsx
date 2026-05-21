'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { useI18n } from '@/i18n';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { useFetch } from '@/hooks/use-fetch';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { CHART_COLORS, STAT_COLORS, PRIMARY } from '@/lib/chart-colors';
import type { AnalyticsData } from '@/lib/types';

export default function AnalyticsPage() {
  const [trendMode, setTrendMode] = useState<'day' | 'week' | 'month'>('day');
  const [timeRange, setTimeRange] = useState<number | undefined>(undefined);
  const { t } = useI18n();
  const chartTheme = useChartTheme();
  const tooltipStyle = useTooltipStyle();

  const url = useMemo(() => {
    const params = new URLSearchParams({ trend_group: trendMode });
    if (timeRange) params.set('days', String(timeRange));
    return `/api/analytics?${params}`;
  }, [trendMode, timeRange]);

  const { data, loading, error } = useFetch<AnalyticsData>(url);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
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
    name: c.section_id,
    value: c.citation_count,
    ruleCount: c.rule_count,
  }));

  return (
    <div className="space-y-6">
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
        <StatCard label={t('dashboard.totalRules')} value={data.total_rules} color={STAT_COLORS.rules} />
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

      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-xl border-border bg-card">
          <CardHeader><CardTitle className="text-base">{t('analytics.topRules')}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRulesData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: chartTheme.mutedForeground, fontSize: 12 }} />
                  <RechartsTooltip {...tooltipStyle} formatter={(value, _name, props) => {
                    const p = (props as { payload: { fullName: string; coverage: string; depth: string } }).payload;
                    return [`${value} ${t('table.matches')} · ${p.coverage} ${t('metric.coverage')} · ${p.depth} ${t('metric.depth')}`, p.fullName];
                  }} />
                  <Bar dataKey="citations" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {topRulesData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
                    label={({ name, percent }: { name?: string; percent?: number }) => <span className="text-xs text-foreground">{name ?? ''} {((percent ?? 0) * 100).toFixed(0)}%</span>}
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
                    <span className="text-sm font-mono text-muted-foreground shrink-0">{rule.rule_id}</span>
                    <span className="text-sm truncate">{rule.title}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs shrink-0">
                    {rule.days_since_last_citation !== null
                      ? t('analytics.coldRules.days', { days: rule.days_since_last_citation })
                      : t('analytics.neverCited')}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
