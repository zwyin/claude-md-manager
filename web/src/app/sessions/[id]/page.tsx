'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { useDynamicPageTitle } from '@/hooks/use-page-title';
import { PageLoader, PageError } from '@/components/page-states';
import { relativeTime } from '@/lib/relative-time';
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
  useDynamicPageTitle(undefined);

  const url = sessionId ? `/api/sessions/${encodeURIComponent(sessionId)}` : null;
  const { data: resp, loading, error } = useFetch<SessionData>(url);

  if (loading) return <PageLoader message={t('status.loading')} />;
  if (error) return <PageError message={t('status.error', { error })} />;
  if (!resp) return null;

  const session = resp.session;
  const citations = resp.citations ?? [];
  const sections = resp.sections ?? [];
  const displayId = sessionId.replace('historical_', '');

  const uniqueRules = new Set(citations.map((c) => c.rule_id)).size;
  const sectionColorMap: Record<string, string> = {};
  sections.forEach((s, i) => {
    sectionColorMap[s.section_id] = SECTION_COLORS[i % SECTION_COLORS.length];
  });

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors"><Home className="w-3.5 h-3.5" /></Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{t('session.title')}</span>
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
          {session.started_at && (
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(session.started_at).toLocaleString(locale)}
              {session.ended_at && ` → ${new Date(session.ended_at).toLocaleString(locale)}`}
            </p>
          )}
        </CardHeader>
        {sections.length > 0 && (
          <CardContent>
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">{t('session.sectionsHit')}</p>
              <div className="flex flex-wrap gap-2">
                {sections.map((s) => (
                  <Badge key={s.section_id} variant="outline" style={{ borderColor: sectionColorMap[s.section_id], color: sectionColorMap[s.section_id] }}>
                    {s.section_title}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="rounded-xl border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t('session.citations')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {citations.length > 0 ? (
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
                      <Badge
                        variant="secondary"
                        className="text-[10px] ml-2"
                        style={{ backgroundColor: sectionColorMap[c.section_id] + '20', color: sectionColorMap[c.section_id] }}
                      >
                        {c.section_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px]">{c.matched_keyword}</Badge>
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
          ) : (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">{t('ruleDetail.noCitations')}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
