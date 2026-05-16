'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TermTooltip } from '@/components/term-tooltip';
import { useI18n } from '@/i18n';

interface Rule {
  rule_id: string; section_id: string; title: string; keywords: string[];
  source_file: string; updated_at: string; citation_count: number; last_cited: string | null;
}
interface CitationRecord {
  id: number; rule_id: string; session_id: string; matched_keyword: string;
  timestamp: string; model: string | null; task_summary: string | null;
}
interface SiblingRule {
  rule_id: string; title: string; session_count: number; match_count: number;
}

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params?.id as string;
  const [rule, setRule] = useState<Rule | null>(null);
  const [citations, setCitations] = useState<CitationRecord[]>([]);
  const [siblings, setSiblings] = useState<SiblingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!ruleId) return;
    fetch(`/api/rules/${encodeURIComponent(ruleId)}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        setRule(json.rule);
        setCitations(json.citations || []);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [ruleId]);

  useEffect(() => {
    if (!rule?.section_id) return;
    fetch('/api/rules')
      .then((res) => res.json())
      .then((json) => {
        const allRules = json.rules || [];
        const sibs = allRules
          .filter((r: { section_id: string; rule_id: string }) => r.section_id === rule.section_id && r.rule_id !== rule.rule_id)
          .map((r: { rule_id: string; title: string; session_count: number; match_count: number }) => ({
            rule_id: r.rule_id, title: r.title,
            session_count: r.session_count || 0, match_count: r.match_count || 0,
          }));
        setSiblings(sibs);
      })
      .catch(() => {});
  }, [rule?.section_id, rule?.rule_id]);

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

      <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
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
                  {t('ruleDetail.lastCited')}: {new Date(rule.last_cited).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">{uniqueSessions} {t('table.sessions')}</Badge>
              <Badge variant={rule.citation_count === 0 ? "destructive" : "default"}>{rule.citation_count} {t('table.matches')}</Badge>
            </div>
          </div>
        </CardHeader>
        {rule.keywords && rule.keywords.length > 0 && (
          <CardContent>
            <div className="border-t border-slate-800 pt-4">
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
        <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base">{t('ruleDetail.sameSection')} ({rule.section_id})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {siblings.map((sib) => (
                <Link key={sib.rule_id} href={`/rules/${sib.rule_id}`}
                  className="shrink-0 w-48 p-3 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-indigo-500/30 transition-colors">
                  <p className="text-xs font-mono text-muted-foreground mb-1">{sib.rule_id}</p>
                  <p className="text-sm font-medium truncate">{sib.title}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px]">{sib.match_count}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50">
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
                        {new Date(c.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
                <div className="px-6 py-3 text-xs text-muted-foreground text-center border-t border-slate-800">
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
