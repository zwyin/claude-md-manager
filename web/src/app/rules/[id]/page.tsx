'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { STAT_COLORS } from '@/lib/chart-colors';
import type { RuleDetail, CitationRecord, SiblingRule } from '@/lib/types';

function MetricBar({ value, color, max = 1 }: { value: number; color: string; max?: number }) {
  const pct = Math.min(value / max, 1);
  const w = Math.round(pct * 80);
  return (
    <svg width="88" height="8" viewBox="0 0 88 8" className="shrink-0 mt-2" role="img" aria-label={`${(pct * 100).toFixed(0)}%`}>
      <rect x="0" y="0" width="80" height="8" rx="4" fill="#27272a" />
      <rect x="0" y="0" width={Math.max(w, 3)} height="8" rx="4" fill={color} fillOpacity="0.85" />
      <circle cx={Math.max(w, 3)} cy="4" r="3" fill={color} />
    </svg>
  );
}

function DepthGauge({ value, max }: { value: number; max: number }) {
  const h = Math.round((value / Math.max(max, 1)) * 28);
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" className="shrink-0 mt-2" role="img" aria-label={`depth ${value.toFixed(1)}`}>
      <rect x="10" y="2" width="8" height="28" rx="4" fill="#27272a" />
      <rect x="10" y={30 - Math.max(h, 3)} width="8" height={Math.max(h, 3)} rx="4" fill={STAT_COLORS.avgDepth} fillOpacity="0.8" />
      <line x1="4" y1="30" x2="24" y2="30" stroke="#3f3f46" strokeWidth="1" />
      <circle cx="14" cy={30 - Math.max(h, 2)} r="3" fill={STAT_COLORS.avgDepth} />
    </svg>
  );
}

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params?.id as string;
  const { t, locale } = useI18n();

  const url = ruleId ? `/api/rules/${encodeURIComponent(ruleId)}` : null;
  const { data: resp, loading, error } = useFetch<{ rule: RuleDetail; citations: CitationRecord[]; siblings: SiblingRule[]; total_sessions: number; total_citations: number }>(url);
  const rule = resp?.rule ?? null;
  const citations = resp?.citations ?? [];
  const siblings = resp?.siblings ?? [];
  const totalSessions = resp?.total_sessions ?? 0;
  const totalCitations = resp?.total_citations ?? 0;

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return (
    <div className="space-y-4">
      <Link href="/rules" className="text-sm text-indigo-400 hover:underline">&larr; {t('ruleDetail.backTo', { section: 'Rules' })}</Link>
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>
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
        <Link href={`/rules?section=${rule.section_id}`} className="hover:text-foreground transition-colors">{rule.section_id}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{rule.title}</span>
      </nav>

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-1">{rule.rule_id}</p>
              <CardTitle className="text-xl">{rule.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-2 space-x-2">
                <span>{t('ruleDetail.section')}:
                  <Link href={`/rules?section=${rule.section_id}`} className="font-medium text-indigo-400 hover:underline ml-1">{rule.section_id}</Link>
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
              <Badge variant="secondary">{uniqueSessions} {t('table.sessions')}</Badge>
              <Badge variant={rule.citation_count === 0 ? "destructive" : "default"}>{rule.citation_count} {t('table.matches')}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-1">
                  <TermTooltip term={t('metric.coverage.full')} explanation={t('metric.coverage.desc')} />
                </p>
                <p className="text-lg font-bold">{totalSessions > 0 ? ((uniqueSessions / totalSessions) * 100).toFixed(1) : '0'}%</p>
                <p className="text-[10px] font-mono text-muted-foreground">{uniqueSessions}/{totalSessions} {t('table.sessions').toLowerCase()}</p>
                <MetricBar value={totalSessions > 0 ? uniqueSessions / totalSessions : 0} color={STAT_COLORS.avgCoverage} />
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
                <MetricBar value={totalCitations > 0 ? rule.citation_count / totalCitations : 0} color={STAT_COLORS.citations} />
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
                  <Badge key={kw} variant="outline" className="border-indigo-500/30 text-indigo-300">{kw}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {siblings.length > 0 && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t('ruleDetail.sameSection')} ({rule.section_id})</CardTitle>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.time')}</TableHead>
                    <TableHead>{t('table.keyword')}</TableHead>
                    <TableHead>{t('table.sessionId')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citations.slice(0, 50).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        {new Date(c.timestamp).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="border-indigo-500/30 text-indigo-300">{c.matched_keyword}</Badge></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                        {c.session_id.replace('historical_', '')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {citations.length > 50 && (
                <div className="px-6 py-3 text-xs text-muted-foreground text-center border-t border-border">
                  {t('ruleDetail.showing', { shown: 50, total: citations.length })}
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
