'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight, Home, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TermTooltip } from '@/components/term-tooltip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { STAT_COLORS, PRIMARY } from '@/lib/chart-colors';
import { relativeTime } from '@/lib/relative-time';
import { DetailMetricBar, DepthGauge } from '@/components/metric-visualizations';
import { PageLoader, PageError } from '@/components/page-states';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useTooltipStyle } from '@/hooks/use-chart-tooltip';
import { useDynamicPageTitle } from '@/hooks/use-page-title';
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
    const cutoff = trendRange ? new Date(Date.now() - trendRange * 86400000) : null;
    const counts: Record<string, number> = {};
    for (const c of src) {
      if (cutoff && new Date(c.timestamp) < cutoff) continue;
      const day = c.timestamp.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }));
  }, [resp?.citations, trendRange]);

  if (loading && !resp) return <PageLoader message={t('status.loading')} />;
  if (error) return (
    <div className="space-y-4">
      <Link href="/rules" className="text-sm text-indigo-400 hover:underline">&larr; {t('ruleDetail.backTo', { section: t('rules.title') })}</Link>
      <PageError message={t('status.error', { error })} />
    </div>
  );
  if (!rule) return null;

  const uniqueSessions = new Set(citations.map((c) => c.session_id)).size;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors"><Home className="w-3.5 h-3.5" /></Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/rules" className="hover:text-foreground transition-colors">{t('rules.title')}</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/rules?section=${rule.section_id}`} className="hover:text-foreground transition-colors">{rule.section_title}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{rule.title}</span>
      </nav>

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-mono text-muted-foreground">{rule.rule_id}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(rule.rule_id); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('ruleDetail.copyId')}
                  title={t('ruleDetail.copyId')}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <CardTitle className="text-xl">{rule.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-2 space-x-2">
                <span>{t('ruleDetail.section')}:
                  <Link href={`/rules?section=${rule.section_id}`} className="font-medium text-indigo-400 hover:underline ml-1">{rule.section_title}</Link>
                </span>
                <span>·</span>
                <span>{t('ruleDetail.source')}:
                  <span className="font-medium text-foreground ml-1">{rule.source_file}</span>
                </span>
              </p>
              {rule.last_cited && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('ruleDetail.lastCited')}: {new Date(rule.last_cited).toLocaleString(locale)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/editor?rule=${encodeURIComponent(rule.rule_id)}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-indigo-500/30 transition-colors">
                <Pencil className="w-3 h-3" />
                {t('ruleDetail.editInEditor')}
              </Link>
              <Badge variant="secondary">{uniqueSessions} {t('table.sessions')}</Badge>
              <Badge variant={rule.citation_count === 0 ? "destructive" : "default"}>{rule.citation_count} {t('table.matches')}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-1">
                  <TermTooltip term={t('metric.coverage.full')} explanation={t('metric.coverage.desc')} />
                </p>
                <p className="text-lg font-bold">{totalSessions > 0 ? ((uniqueSessions / totalSessions) * 100).toFixed(1) : '0'}%</p>
                <p className="text-[10px] font-mono text-muted-foreground">{uniqueSessions}/{totalSessions} {t('table.sessions').toLowerCase()}</p>
                <DetailMetricBar value={totalSessions > 0 ? uniqueSessions / totalSessions : 0} color={STAT_COLORS.avgCoverage} />
              </div>
              <div className="flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-1">
                  <TermTooltip term={t('metric.depth.full')} explanation={t('metric.depth.desc')} />
                </p>
                <p className="text-lg font-bold">{uniqueSessions > 0 ? (rule.citation_count / uniqueSessions).toFixed(1) : '0'}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{rule.citation_count}/{uniqueSessions} {t('table.matches').toLowerCase()}/{t('table.sessions').toLowerCase()}</p>
                <DepthGauge value={uniqueSessions > 0 ? rule.citation_count / uniqueSessions : 0} max={5} />
              </div>
              <div className="flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-1">
                  <TermTooltip term={t('metric.share.full')} explanation={t('metric.share.desc')} />
                </p>
                <p className="text-lg font-bold">{totalCitations > 0 ? ((rule.citation_count / totalCitations) * 100).toFixed(1) : '0'}%</p>
                <p className="text-[10px] font-mono text-muted-foreground">{rule.citation_count}/{totalCitations} {t('table.matches').toLowerCase()}</p>
                <DetailMetricBar value={totalCitations > 0 ? rule.citation_count / totalCitations : 0} color={STAT_COLORS.citations} />
              </div>
            </div>
          </div>
        </CardContent>
        {rule.keywords && rule.keywords.length > 0 && (
          <CardContent>
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                <TermTooltip term={t('term.keywords')} explanation={t('term.keywords.desc')} />
              </p>
              <div className="flex flex-wrap gap-2">
                {rule.keywords.map((kw) => (
                  <Link key={kw} href={`/rules?search=${encodeURIComponent(kw)}`}>
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 cursor-pointer transition-colors">{kw}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {rule.body && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('ruleDetail.content')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm prose-invert max-w-none
              prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground
              prose-code:text-foreground prose-a:text-indigo-400
              prose-code:before:content-[''] prose-code:after:content-['']">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {rule.body}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {siblings.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('ruleDetail.sameSection')} ({rule.section_title})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {siblings.map((sib) => (
                <Link key={sib.rule_id} href={`/rules/${sib.rule_id}`}
                  className="shrink-0 w-48 p-3 rounded-lg border border-border bg-accent/50 hover:border-indigo-500/30 transition-colors">
                  <p className="text-xs font-mono text-muted-foreground mb-1">{sib.rule_id}</p>
                  <p className="text-sm font-medium truncate">{sib.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">{sib.match_count} {t('table.matches').toLowerCase()}</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: STAT_COLORS.avgCoverage, color: STAT_COLORS.avgCoverage }}>{(sib.session_coverage * 100).toFixed(0)}%</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono" style={{ borderColor: STAT_COLORS.avgDepth, color: STAT_COLORS.avgDepth }}>{sib.avg_depth.toFixed(1)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {coOccurring.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('ruleDetail.coOccurring')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('ruleDetail.coOccurring.desc')}</p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {coOccurring.map((co) => (
                <Link key={co.rule_id} href={`/rules/${co.rule_id}`}
                  className="shrink-0 w-48 p-3 rounded-lg border border-border bg-accent/50 hover:border-indigo-500/30 transition-colors">
                  <p className="text-xs font-mono text-muted-foreground mb-1">{co.section_id}</p>
                  <p className="text-sm font-medium truncate">{co.title}</p>
                  <Badge variant="secondary" className="text-[10px] font-mono mt-2">{co.co_sessions} {t('table.sessions').toLowerCase()}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {trendData.length > 1 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('ruleDetail.citationTrend')}</CardTitle>
              <div className="flex gap-1">
                {([
                  { value: undefined, key: 'all' },
                  { value: 7, key: '7d' },
                  { value: 30, key: '30d' },
                  { value: 90, key: '90d' },
                ] as const).map(({ value, key }) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={trendRange === value ? 'default' : 'ghost'}
                    onClick={() => setTrendRange(value)}
                    className="text-xs h-7 px-2"
                  >
                    {t(`analytics.time.${key}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TermTooltip term={t('term.citation')} explanation={t('term.citation.desc')} />
            <span className="text-muted-foreground font-normal">({citations.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {citations.length > 0 ? (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden divide-y divide-border">
                {citations.slice(0, citeLimit).map((c) => (
                  <div key={c.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px]">{c.matched_keyword}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">{relativeTime(c.timestamp, locale)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/sessions/${encodeURIComponent(c.session_id)}`} className="text-[10px] font-mono text-muted-foreground hover:text-indigo-400 transition-colors truncate">
                        {c.session_id.replace('historical_', '').slice(0, 12)}
                      </Link>
                      {c.model && <Badge variant="secondary" className="text-[10px] font-mono">{c.model}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.time')}</TableHead>
                      <TableHead>{t('table.keyword')}</TableHead>
                      <TableHead>{t('ruleDetail.model')}</TableHead>
                      <TableHead>{t('table.sessionId')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {citations.slice(0, citeLimit).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap" title={new Date(c.timestamp).toLocaleString(locale)}>
                          {relativeTime(c.timestamp, locale)}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="border-indigo-500/30 text-indigo-300">{c.matched_keyword}</Badge></TableCell>
                        <TableCell className="text-xs">
                          {c.model ? <Badge variant="secondary" className="text-[10px] font-mono">{c.model}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={c.task_summary || undefined}>
                          <Link href={`/sessions/${encodeURIComponent(c.session_id)}`} className="hover:text-indigo-400 transition-colors">
                            {c.session_id.replace('historical_', '')}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {citations.length > citeLimit && (
                <div className="px-6 py-3 text-center border-t border-border">
                  <span className="text-xs text-muted-foreground mr-3">
                    {t('ruleDetail.showing', { shown: citeLimit, total: citations.length })}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setCiteLimit((l) => l + 50)}>
                    {t('ruleDetail.loadMore')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">{t('ruleDetail.noCitations')}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
