'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Rule {
  rule_id: string;
  section_id: string;
  section_title: string;
  title: string;
  keywords: string[];
  session_count: number;
  match_count: number;
}

interface Section {
  section_id: string;
  title: string;
  source_file: string;
  rule_count: number;
  total_citations: number;
  total_sessions: number;
}

interface DashboardData {
  rules: Rule[];
  sections: Section[];
  total_rules: number;
  total_sessions: number;
  active_rule_pct: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (error) return <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">{error}</div>;
  if (!data) return null;

  const topRules = [...(data.rules || [])].sort((a, b) => b.match_count - a.match_count).slice(0, 10);
  const coldRules = (data.rules || []).filter((r) => r.match_count === 0);
  const sections = data.sections || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">CLAUDE.md rule overview and statistics</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Rules</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{data.total_rules}</div><div className="text-xs text-muted-foreground mt-1">in {sections.length} sections</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Sessions</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{data.total_sessions}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Active Rule %</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{data.active_rule_pct}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sections</CardTitle>
          <p className="text-xs text-muted-foreground">CLAUDE.md 中的章节，按引用次数排序</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>章节</TableHead>
                <TableHead className="text-center">子规则</TableHead>
                <TableHead className="text-right">引用次数</TableHead>
                <TableHead className="text-right">会话数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((sec) => (
                <TableRow key={sec.section_id}>
                  <TableCell>
                    <Link href={`/rules?section=${sec.section_id}`} className="hover:underline">
                      <span className="font-medium">{sec.title}</span>
                    </Link>
                    <span className="text-xs text-muted-foreground ml-2 font-mono">{sec.section_id}</span>
                  </TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{sec.rule_count}</Badge></TableCell>
                  <TableCell className="text-right">{sec.total_citations}</TableCell>
                  <TableCell className="text-right">{sec.total_sessions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Sub-rules</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Matches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topRules.map((rule) => (
                <TableRow key={rule.rule_id}>
                  <TableCell className="font-mono text-xs text-blue-600">
                    <Link href={`/rules/${rule.rule_id}`} className="hover:underline">{rule.rule_id}</Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/rules/${rule.rule_id}`} className="hover:underline">{rule.title}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{rule.section_title || rule.section_id}</TableCell>
                  <TableCell className="text-right">{rule.session_count}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{rule.match_count}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {coldRules.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle className="text-base">Cold Rules (0 Matches)</CardTitle>
            <Badge variant="outline" className="ml-auto text-amber-600">{coldRules.length} rules</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {coldRules.map((rule) => (
                <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">{rule.rule_id}</span>
                    <span className="text-sm">{rule.title}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">0 matches</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
