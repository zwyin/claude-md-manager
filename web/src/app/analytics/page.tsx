'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TopRule { rule_id: string; title: string; citation_count: number; }
interface ColdRule { rule_id: string; title: string; days_since_last_citation: number | null; }
interface CategoryDist { section_id: string; rule_count: number; citation_count: number; }

interface AnalyticsData {
  total_rules: number;
  total_citations: number;
  total_sessions: number;
  top_rules: TopRule[];
  cold_rules: ColdRule[];
  category_distribution: CategoryDist[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (error) return <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">{error}</div>;
  if (!data) return null;

  const maxCitation = Math.max(...(data.top_rules || []).map(r => r.citation_count), 1);
  const maxCatCitation = Math.max(...(data.category_distribution || []).map(c => c.citation_count), 1);
  const barColors = ['bg-emerald-500', 'bg-emerald-400', 'bg-teal-400', 'bg-blue-400', 'bg-blue-300',
                      'bg-indigo-300', 'bg-indigo-200', 'bg-violet-300', 'bg-violet-200', 'bg-gray-300'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Rule usage statistics and distribution</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Rules</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{data.total_rules}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Citations</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{data.total_citations?.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Sessions</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600">{data.total_sessions?.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {data.top_rules && data.top_rules.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 Rules</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.top_rules.map((rule, i) => {
              const pct = (rule.citation_count / maxCitation) * 100;
              return (
                <div key={rule.rule_id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                  <Link href={`/rules/${rule.rule_id}`} className="text-xs text-blue-600 hover:underline w-52 truncate shrink-0" title={rule.rule_id}>
                    {rule.title}
                  </Link>
                  <div className="flex-1 bg-muted rounded h-5 relative overflow-hidden">
                    <div className={`h-full rounded ${barColors[i] || 'bg-gray-300'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="text-xs font-medium w-16 text-right">{rule.citation_count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {data.category_distribution && data.category_distribution.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Category Distribution</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Rules</TableHead>
                  <TableHead className="text-right">Citations</TableHead>
                  <TableHead className="w-32">Distribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.category_distribution.map((cat) => {
                  const distPct = (cat.citation_count / maxCatCitation) * 100;
                  return (
                    <TableRow key={cat.section_id}>
                      <TableCell className="font-mono">{cat.section_id}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{cat.rule_count}</TableCell>
                      <TableCell className="text-right font-medium">{cat.citation_count}</TableCell>
                      <TableCell>
                        <div className="bg-muted rounded-full h-2 w-full">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${distPct}%` }} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
