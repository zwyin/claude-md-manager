'use client';

import { useEffect, useState } from 'react';
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

interface TopRule { rule_id: string; title: string; citation_count: number; }
interface ColdRule { rule_id: string; title: string; days_since_last_citation: number | null; }
interface CategoryDist { section_id: string; rule_count: number; citation_count: number; }
interface TrendPoint { period: string; count: number; }

interface AnalyticsData {
  total_rules: number; total_citations: number; total_sessions: number;
  top_rules: TopRule[]; cold_rules: ColdRule[];
  category_distribution: CategoryDist[];
  citation_trend: TrendPoint[];
}

const CHART_COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#8b5cf6', '#7c3aed', '#4f46e5'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<'day' | 'week' | 'month'>('day');
  const { t } = useI18n();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?trend_group=${trendMode}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [trendMode]);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
  if (!data) return null;

  const topRulesData = (data.top_rules || []).map((r) => ({
    name: r.title.length > 18 ? r.title.slice(0, 18) + '...' : r.title,
    fullName: r.title,
    citations: r.citation_count,
    rule_id: r.rule_id,
  }));

  const pieData = (data.category_distribution || []).map((c) => ({
    name: c.section_id,
    value: c.citation_count,
    ruleCount: c.rule_count,
  }));

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('analytics.subtitle')}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('dashboard.totalRules')} value={data.total_rules} color="#6366f1" />
        <StatCard label={<TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />} value={data.total_citations} color="#10b981" />
        <StatCard label={t('dashboard.totalSessions')} value={data.total_sessions} color="#3b82f6" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-xl border-border bg-card">
          <CardHeader><CardTitle className="text-base">{t('analytics.topRules')}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRulesData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <RechartsTooltip {...tooltipStyle} formatter={(value, _name, props) => [value, (props as { payload: { fullName: string } }).payload.fullName]} />
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
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip {...tooltipStyle} formatter={(value, _name, props) => [`${value} (${(props as { payload: { ruleCount: number } }).payload.ruleCount} rules)`, (props as { payload: { name: string } }).payload.name]} />
                  <Legend formatter={(value: string) => <span className="text-xs text-slate-400">{value}</span>} />
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
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#trendGradient)" strokeWidth={2} />
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
