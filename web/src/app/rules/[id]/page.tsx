'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Rule {
  rule_id: string; section_id: string; title: string; keywords: string[];
  source_file: string; updated_at: string; citation_count: number; last_cited: string | null;
}

interface CitationRecord {
  id: number; rule_id: string; session_id: string; matched_keyword: string;
  timestamp: string; model: string | null; task_summary: string | null;
}

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params?.id as string;
  const [rule, setRule] = useState<Rule | null>(null);
  const [citations, setCitations] = useState<CitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ruleId) return;
    fetch(`/api/rules/${encodeURIComponent(ruleId)}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setRule(json.rule); setCitations(json.citations || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [ruleId]);

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (error) return (
    <div className="space-y-4">
      <Link href="/rules" className="text-sm text-blue-600 hover:underline">&larr; Back to Rules</Link>
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">Failed to load rule: {error}</div>
    </div>
  );
  if (!rule) return null;

  const uniqueSessions = new Set(citations.map((c) => c.session_id)).size;

  return (
    <div className="space-y-6">
      <Link href="/rules" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Rules
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-1">{rule.rule_id}</p>
              <CardTitle className="text-xl">{rule.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Section: <span className="font-medium text-foreground">{rule.section_id}</span>
                {' · '}Source: <span className="font-medium text-foreground">{rule.source_file}</span>
              </p>
              {rule.last_cited && <p className="text-xs text-muted-foreground mt-1">Last cited: {new Date(rule.last_cited).toLocaleString('zh-CN')}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">{uniqueSessions} sessions</Badge>
              <Badge variant={rule.citation_count === 0 ? "destructive" : "default"}>{rule.citation_count} matches</Badge>
            </div>
          </div>
        </CardHeader>
        {rule.keywords && rule.keywords.length > 0 && (
          <CardContent>
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Keywords</p>
              <div className="flex flex-wrap gap-2">
                {rule.keywords.map((kw) => (
                  <Badge key={kw} variant="outline">{kw}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Citations ({citations.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {citations.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citations.slice(0, 50).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        {new Date(c.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell><Badge variant="outline">{c.matched_keyword}</Badge></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                        {c.session_id.replace('historical_', '')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {citations.length > 50 && (
                <div className="px-6 py-3 text-xs text-muted-foreground text-center border-t">
                  Showing 50 of {citations.length} citations
                </div>
              )}
            </>
          ) : (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">No citation data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
