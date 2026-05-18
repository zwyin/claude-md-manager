'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { StatCard } from '@/components/stat-card';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { useFetch } from '@/hooks/use-fetch';
import { CHART_COLORS, STAT_COLORS, PRIMARY } from '@/lib/chart-colors';

interface Rule {
  rule_id: string; section_id: string; section_title: string;
  title: string; keywords: string[]; session_count: number; match_count: number;
}
interface Section {
  section_id: string; title: string; source_file: string;
  rule_count: number; total_citations: number; total_sessions: number;
}
interface DashboardData {
  rules: Rule[]; sections: Section[];
  total_rules: number; total_sessions: number; active_rule_pct: number;
}

export default function DashboardPage() {
  const { data, loading, error } = useFetch<DashboardData>('/api/rules');
  const [coldOpen, setColdOpen] = useState(false);
  const { t } = useI18n();
  const chartTheme = useChartTheme();

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
  if (!data) return null;

  const topRules = [...(data.rules || [])].sort((a, b) => b.match_count - a.match_count).slice(0, 10);
  const coldRules = (data.rules || []).filter((r) => r.match_count === 0);
  const sections = data.sections || [];
  const totalCitations = (data.rules || []).reduce((s, r) => s + r.match_count, 0);

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
    rule_id: r.rule_id,
  }));

  const tooltipStyle = {
    contentStyle: { backgroundColor: chartTheme.card, border: `1px solid ${chartTheme.border}`, borderRadius: '8px', color: chartTheme.foreground },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.totalRules')}
          value={data.total_rules}
          sublabel={t('dashboard.inSections', { count: sections.length })}
          color={STAT_COLORS.rules}
        />
        <StatCard
          label={t('dashboard.totalSessions')}
          value={data.total_sessions}
          color={STAT_COLORS.sessions}
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
        />
      </div>

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
                <Bar dataKey="citations" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {sectionChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
                  formatter={(value, _name, props) => [value, (props as { payload: { fullName: string } }).payload.fullName]}
                />
                <Bar dataKey="citations" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
