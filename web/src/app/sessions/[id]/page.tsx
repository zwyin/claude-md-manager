'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { useDynamicPageTitle } from '@/hooks/use-page-title';
import { PageLoader, PageError, SessionDetailSkeleton } from '@/components/page-states';
import { relativeTime, formatDuration } from '@/lib/relative-time';
import { SECTION_COLORS } from '@/lib/chart-colors';

interface SessionCitation {
  rule_id: string;
  title: string;
  section_id: string;
  matched_keyword: string;
  confidence: string;
  timestamp: string;
}

interface SessionSection {
  section_id: string;
  section_title: string;
}

interface SessionData {
  session: { session_id: string; started_at?: string; ended_at?: string; model?: string; task_summary?: string };
  citations: SessionCitation[];
  sections: SessionSection[];
}

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  const { t, locale } = useI18n();
  useDynamicPageTitle(sessionId ? `Session ${sessionId.slice(0, 8)}` : undefined);

  const url = sessionId ? `/api/sessions/${encodeURIComponent(sessionId)}` : null;
  const { data: resp, loading, error } = useFetch<SessionData>(url);

  if (loading) return <SessionDetailSkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!resp) return null;

  const session = resp.session;
  const citations = resp.citations ?? [];
  const sections = resp.sections ?? [];
  const displayId = sessionId.replace('historical_', '');

  const uniqueRules = new Set(citations.map((c) => c.rule_id)).size;
  const confCounts = { high: 0, medium: 0, low: 0 };
  for (const c of citations) {
    if (c.confidence === 'high') confCounts.high++;
    else if (c.confidence === 'medium') confCounts.medium++;
    else confCounts.low++;
  }
  const sectionColorMap: Record<string, string> = {};
  sections.forEach((s, i) => {
    sectionColorMap[s.section_id] = SECTION_COLORS[i % SECTION_COLORS.length];
  });

  const timeline = useMemo(() => {
    if (!session.started_at || citations.length < 2) return null;
    const start = new Date(session.started_at).getTime();
    const end = session.ended_at ? new Date(session.ended_at).getTime() : new Date(citations[citations.length - 1].timestamp).getTime();
    const dur = end - start;
    if (dur <= 0) return null;
    return citations.map((c) => {
      const t = new Date(c.timestamp).getTime();
      const pct = Math.max(0, Math.min(1, (t - start) / dur));
      return { pct, confidence: c.confidence, rule_id: c.rule_id, title: c.title };
    });
  }, [session, citations]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors"><Home className="w-3.5 h-3.5" /></Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/sessions" className="hover:text-foreground transition-colors">{t('session.listTitle')}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{displayId.slice(0, 8)}</span>
      </nav>

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{t('session.title')}</CardTitle>
              <p className="text-xs font-mono text-muted-foreground mt-1">{displayId}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">{uniqueRules} {t('table.rules').toLowerCase()}</Badge>
              <Badge variant="default">{citations.length} {t('table.matches').toLowerCase()}</Badge>
              {session.model && <Badge variant="outline" className="text-[10px] font-mono">{session.model}</Badge>}
            </div>
          </div>
          {citations.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">{t('session.confidence')}:</span>
              {confCounts.high > 0 && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-0">{confCounts.high} {t('analytics.confidence.high')}</Badge>}
              {confCounts.medium > 0 && <Badge className="text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 border-0">{confCounts.medium} {t('analytics.confidence.medium')}</Badge>}
              {confCounts.low > 0 && <Badge className="text-[10px] bg-rose-500/20 text-rose-400 hover:bg-rose-500/20 border-0">{confCounts.low} {t('analytics.confidence.low')}</Badge>}
            </div>
          )}
          {session.task_summary && (
            <p className="text-sm text-muted-foreground mt-2">{session.task_summary}</p>
          )}
          {session.started_at && (
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(session.started_at).toLocaleString(locale)}
              {session.ended_at && (
                <>
                  {` → ${new Date(session.ended_at).toLocaleString(locale)}`}
                  {(() => {
                    const sec = Math.floor((new Date(session.ended_at!).getTime() - new Date(session.started_at!).getTime()) / 1000);
                    const dur = formatDuration(sec);
                    return dur ? <span className="ml-2 font-mono">({dur})</span> : null;
                  })()}
                </>
              )}
            </p>
          )}
        </CardHeader>
        {sections.length > 0 && (
          <CardContent>
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">{t('session.sectionsHit')}</p>
              <div className="flex flex-wrap gap-2">
                {sections.map((s) => (
                  <Link key={s.section_id} href={`/rules?section=${s.section_id}`}>
                  <Badge variant="outline" className="hover:bg-accent/50 cursor-pointer transition-colors" style={{ borderColor: sectionColorMap[s.section_id], color: sectionColorMap[s.section_id] }}>
                    {s.section_title}
                  </Badge>
                </Link>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {timeline && (
        <Card className="rounded-xl border-border bg-card">
          <CardContent className="pt-4">
            <div className="relative h-6">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              {timeline.map((pt, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-transform hover:scale-150"
                    style={{
                      left: `${pt.pct * 100}%`,
                      backgroundColor: pt.confidence === 'high' ? '#34d399' : pt.confidence === 'medium' ? '#fbbf24' : '#fb7185',
                    }}
                  >
                    <Link href={`/rules/${pt.rule_id}`} className="block w-full h-full" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                    <span className="font-medium">{pt.title}</span>
                    <br />
                    <span className="text-muted-foreground">{pt.confidence}</span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t('session.citations')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {citations.length > 0 ? (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden divide-y divide-border">
                {citations.map((c, i) => (
                  <div key={`${c.rule_id}-${i}`} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/rules/${c.rule_id}`} className="text-sm hover:text-indigo-400 transition-colors truncate">
                        {c.title}
                      </Link>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">{relativeTime(c.timestamp, locale)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/rules?section=${c.section_id}`}>
                      <Badge variant="secondary" className="text-[10px] hover:opacity-80 cursor-pointer transition-opacity" style={{ backgroundColor: sectionColorMap[c.section_id] + '20', color: sectionColorMap[c.section_id] }}>
                        {c.section_id}
                      </Badge>
                      </Link>
                      <Link href={`/rules?search=${encodeURIComponent(c.matched_keyword)}`}>
                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px] hover:bg-indigo-500/10 cursor-pointer transition-colors">{c.matched_keyword}</Badge>
                      </Link>
                      <Badge variant={c.confidence === 'high' ? 'default' : c.confidence === 'medium' ? 'secondary' : 'outline'} className="text-[10px]">
                        {c.confidence === 'high' ? t('analytics.confidence.high') : c.confidence === 'medium' ? t('analytics.confidence.medium') : t('analytics.confidence.low')}
                      </Badge>
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
                      <TableHead>{t('rules.ruleName')}</TableHead>
                      <TableHead>{t('table.keyword')}</TableHead>
                      <TableHead>{t('session.confidence')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {citations.map((c, i) => (
                      <TableRow key={`${c.rule_id}-${i}`}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {relativeTime(c.timestamp, locale)}
                        </TableCell>
                        <TableCell>
                          <Link href={`/rules/${c.rule_id}`} className="text-sm hover:text-indigo-400 transition-colors">
                            {c.title}
                          </Link>
                          <Link href={`/rules?section=${c.section_id}`}>
                          <Badge
                            variant="secondary"
                            className="text-[10px] ml-2 hover:opacity-80 cursor-pointer transition-opacity"
                            style={{ backgroundColor: sectionColorMap[c.section_id] + '20', color: sectionColorMap[c.section_id] }}
                          >
                            {c.section_id}
                          </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/rules?search=${encodeURIComponent(c.matched_keyword)}`}>
                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px] hover:bg-indigo-500/10 cursor-pointer transition-colors">{c.matched_keyword}</Badge>
                      </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.confidence === 'high' ? 'default' : c.confidence === 'medium' ? 'secondary' : 'outline'} className="text-[10px]">
                            {c.confidence === 'high' ? t('analytics.confidence.high') : c.confidence === 'medium' ? t('analytics.confidence.medium') : t('analytics.confidence.low')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">{t('ruleDetail.noCitations')}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
