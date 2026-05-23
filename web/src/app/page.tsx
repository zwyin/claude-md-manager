'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { StatCard } from '@/components/stat-card';
import { PageLoader, PageError, DashboardSkeleton } from '@/components/page-states';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { useFetch } from '@/hooks/use-fetch';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { usePageTitle } from '@/hooks/use-page-title';
import { CHART_COLORS, STAT_COLORS, PRIMARY } from '@/lib/chart-colors';
import { relativeTime, formatDuration } from '@/lib/relative-time';
import type { RuleWithStats, SectionWithStats, CitationTimePoint, RecentCitation } from '@/lib/types';

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

  const { data, loading, error } = useFetch<DashboardData>(url);
  const { data: sessionsData } = useFetch<{ sessions: SessionEntry[] }>('/api/sessions?limit=8');
  const recentSessions = sessionsData?.sessions ?? [];

  if (loading && !data) return <DashboardSkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!data) return null;

  const topRules = [...(data.rules || [])].sort((a, b) => b.match_count - a.match_count).slice(0, 10);
  const coldRules = [...(data.rules || [])].sort((a, b) => a.match_count - b.match_count).slice(0, 10);
  const sections = data.sections || [];
  const totalCitations = data.total_citations ?? 0;
  const avgCoverage = data.avg_coverage ?? 0;
  const avgDepth = data.avg_depth ?? 0;

  const sectionChartData = sections.map((s) => ({
    name: s.title.length > 12 ? s.title.slice(0, 12) + '…' : s.title,
    fullName: s.title,
    citations: s.total_citations,
    section_id: s.section_id,
  }));

  const topRulesChartData = topRules.map((r) => ({
    name: r.title.length > 20 ? r.title.slice(0, 20) + '…' : r.title,
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
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
          {data.recent_citations && data.recent_citations.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {t('dashboard.lastActivity', { time: new Date(data.recent_citations[0].timestamp).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) })}
            </span>
          )}
        </div>
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

      {data.session_trend && data.session_trend.length > 1 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.sessionTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.session_trend} margin={{ left: 0, right: 20 }}>
                  <defs>
                    <linearGradient id="sessionTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartTheme.mutedForeground, fontSize: 11 }} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#sessionTrendGrad)" strokeWidth={2} />
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
          <div style={{ height: `${Math.max(300, sections.length * 32)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={160} tick={{ fill: chartTheme.mutedForeground, fontSize: 12 }} />
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
              <BarChart data={topRulesChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={180} tick={{ fill: chartTheme.mutedForeground, fontSize: 12 }} />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.recent_citations && data.recent_citations.length > 0 && (
          <Card className="rounded-xl border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.recentCitations')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {data.recent_citations.slice(0, 8).map((c, i) => (
                  <div key={`${c.rule_id}-${c.timestamp}-${i}`}
                    className="flex items-center justify-between px-6 py-2.5 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Link href={`/rules?search=${encodeURIComponent(c.matched_keyword)}`}>
                      <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px] shrink-0 hover:bg-indigo-500/10 cursor-pointer transition-colors">{c.matched_keyword}</Badge>
                    </Link>
                      <Link href={`/rules/${c.rule_id}`} className="text-sm truncate hover:text-indigo-400 transition-colors">{c.title}</Link>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Link href={`/sessions/${encodeURIComponent(c.session_id)}`} className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors" title={c.session_id}>
                        {c.session_id.slice(0, 6)}
                      </Link>
                      {c.model && <Badge variant="secondary" className="text-[10px] font-mono px-1 py-0">{c.model}</Badge>}
                      <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(c.timestamp).toLocaleString(locale)}>
                        {relativeTime(c.timestamp, locale)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-6 py-2 text-center">
                <Link href="/analytics" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t('dashboard.viewAll')} →</Link>
              </div>
            </CardContent>
          </Card>
        )}

        {recentSessions.length > 0 && (
          <Card className="rounded-xl border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.recentSessions')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentSessions.map((s) => (
                  <Link
                    key={s.session_id}
                    href={`/sessions/${encodeURIComponent(s.session_id)}`}
                    className="flex items-center justify-between px-6 py-2.5 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {s.session_id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.started_at
                            ? new Date(s.started_at).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                        {formatDuration(s.duration_sec) && (
                          <span className="text-[10px] text-muted-foreground font-mono">{formatDuration(s.duration_sec)}</span>
                        )}
                        {s.model && (
                          <Badge variant="secondary" className="text-[10px] font-mono px-1 py-0">{s.model}</Badge>
                        )}
                      </div>
                      {s.task_summary && (
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{s.task_summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {s.citation_count > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{s.citation_count}</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <div className="border-t border-border px-6 py-2 text-center">
                <Link href="/sessions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t('dashboard.viewAll')} →</Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {data.recent_builds && data.recent_builds.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.recentBuilds')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.recent_builds.map((build) => (
                <Link key={build.id} href="/history"
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant={build.status === 'success' ? 'default' : 'destructive'} className="text-[10px]">
                      {build.status === 'success' ? t('dashboard.buildStatus.success') : t('dashboard.buildStatus.failed')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {build.rules_changed} {t('table.rules').toLowerCase()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground" title={new Date(build.published_at).toLocaleString(locale)}>
                    {relativeTime(build.published_at, locale)}
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
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="text-[10px] shrink-0 hover:bg-primary/20 cursor-pointer"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/rules?section=${rule.section_id}`); }}
                      >{rule.section_id}</Badge>
                      <span className="text-sm truncate">{rule.title}</span>
                    </div>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{rule.match_count} {t('table.matches')}</Badge>
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
