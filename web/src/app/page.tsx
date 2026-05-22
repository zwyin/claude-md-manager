'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { StatCard } from '@/components/stat-card';
import { PageLoader, PageError } from '@/components/page-states';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { useFetch } from '@/hooks/use-fetch';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { usePageTitle } from '@/hooks/use-page-title';
import { CHART_COLORS, STAT_COLORS, PRIMARY } from '@/lib/chart-colors';
import { relativeTime } from '@/lib/relative-time';
import type { RuleWithStats, SectionWithStats, CitationTimePoint, RecentCitation } from '@/lib/types';

interface DashboardData {
  rules: RuleWithStats[]; sections: SectionWithStats[];
  total_rules: number; total_sessions: number; active_rule_pct: number;
  total_citations: number; avg_coverage: number; avg_depth: number;
  citation_trend: CitationTimePoint[];
  recent_citations: RecentCitation[];
}

export default function DashboardPage() {
  const { data, loading, error } = useFetch<DashboardData>('/api/rules');
  const [coldOpen, setColdOpen] = useState(false);
  const { t, locale } = useI18n();
  const router = useRouter();
  const chartTheme = useChartTheme();
  usePageTitle('dashboard.title');
  const tooltipStyle = useTooltipStyle();

  if (loading) return <PageLoader message={t('status.loading')} />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!data) return null;

  const topRules = [...(data.rules || [])].sort((a, b) => b.match_count - a.match_count).slice(0, 10);
  const coldRules = (data.rules || []).filter((r) => r.match_count === 0);
  const sections = data.sections || [];
  const totalCitations = data.total_citations ?? 0;
  const avgCoverage = data.avg_coverage ?? 0;
  const avgDepth = data.avg_depth ?? 0;

  const sectionChartData = sections.map((s) => ({
    name: s.title.length > 16 ? s.title.slice(0, 16) + '...' : s.title,
    fullName: s.title,
    citations: s.total_citations,
    section_id: s.section_id,
  }));

  const topRulesChartData = topRules.map((r) => ({
    name: r.title.length > 20 ? r.title.slice(0, 20) + '...' : r.title,
    fullName: r.title,
    citations: r.match_count,
    coverage: `${(r.session_coverage * 100).toFixed(0)}%`,
    depth: r.avg_depth.toFixed(1),
    rule_id: r.rule_id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>
        {data.recent_citations && data.recent_citations.length > 0 && (
          <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">
            {t('dashboard.lastActivity', { time: new Date(data.recent_citations[0].timestamp).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
          href="/analytics"
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

      {data.citation_trend && data.citation_trend.length > 1 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('analytics.citationTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.citation_trend} margin={{ left: 0, right: 20 }}>
                  <defs>
                    <linearGradient id="dashTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke={PRIMARY} fill="url(#dashTrendGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.sections')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('dashboard.sections.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: chartTheme.mutedForeground, fontSize: 12 }} />
                <RechartsTooltip
                  {...tooltipStyle}
                  formatter={(value, _name, props) => [value, (props as { payload: { fullName: string } }).payload.fullName]}
                />
                <Bar dataKey="citations" radius={[0, 4, 4, 0]} maxBarSize={24} style={{ cursor: 'pointer' }}>
                  {sectionChartData.map((entry, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} onClick={() => router.push(`/rules?section=${entry.section_id}`)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.topRules')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRulesChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={160} tick={{ fill: chartTheme.mutedForeground, fontSize: 12 }} />
                <RechartsTooltip
                  {...tooltipStyle}
                  formatter={(value, _name, props) => {
                    const p = (props as { payload: { fullName: string; coverage: string; depth: string } }).payload;
                    return [`${value} ${t('table.matches')} · ${p.coverage} ${t('metric.coverage')} · ${p.depth} ${t('metric.depth')}`, p.fullName];
                  }}
                />
                <Bar dataKey="citations" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={20} style={{ cursor: 'pointer' }}>
                  {topRulesChartData.map((entry, i) => (
                    <Cell key={i} fill={PRIMARY} onClick={() => router.push(`/rules/${entry.rule_id}`)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {data.recent_citations && data.recent_citations.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.recentCitations')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.recent_citations.slice(0, 15).map((c, i) => (
                <Link key={`${c.rule_id}-${c.timestamp}-${i}`} href={`/rules/${c.rule_id}`}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px] shrink-0">{c.matched_keyword}</Badge>
                    <span className="text-sm truncate">{c.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-3" title={new Date(c.timestamp).toLocaleString(locale)}>
                    {relativeTime(c.timestamp, locale)}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {coldRules.length > 0 && (
        <Collapsible open={coldOpen} onOpenChange={setColdOpen}>
          <Card className="rounded-xl border-border bg-card">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-6 py-4 hover:bg-accent/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <svg className={`w-4 h-4 text-muted-foreground transition-transform ${coldOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-base font-semibold">
                  <TermTooltip term={t('term.coldRule')} explanation={t('term.coldRule.desc')} />
                </span>
              </div>
              <Badge variant="outline" className="text-amber-500">{t('dashboard.coldRules.count', { count: coldRules.length })}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border divide-y divide-border">
                {coldRules.map((rule) => (
                  <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground">{rule.rule_id}</span>
                      <span className="text-sm">{rule.title}</span>
                    </div>
                    <Badge variant="destructive" className="text-xs">0 {t('table.matches')}</Badge>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
