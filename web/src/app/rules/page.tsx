'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Rule {
  rule_id: string;
  section_id: string;
  title: string;
  keywords: string[];
  session_count: number;
  match_count: number;
}

interface RulesData {
  rules: Rule[];
  total_rules: number;
}

export default function RulesPage() {
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        setData(json);
        const open: Record<string, boolean> = {};
        (json.rules || []).forEach((r: Rule) => { open[r.section_id] = true; });
        setOpenSections(open);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const toggle = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (error) return <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">{error}</div>;
  if (!data) return null;

  const grouped: Record<string, Rule[]> = {};
  for (const rule of data.rules || []) {
    if (!grouped[rule.section_id]) grouped[rule.section_id] = [];
    grouped[rule.section_id].push(rule);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">{data.total_rules} rules in total, grouped by section</p>
      </div>

      <div className="space-y-3">
        {Object.keys(grouped).sort().map((sectionId) => {
          const rules = grouped[sectionId];
          const isOpen = openSections[sectionId] !== false;
          const totalMatches = rules.reduce((s, r) => s + r.match_count, 0);

          return (
            <Card key={sectionId}>
              <Collapsible open={isOpen} onOpenChange={() => toggle(sectionId)}>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-semibold">{sectionId}</span>
                    <span className="text-xs text-muted-foreground">{rules.length} rules</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{totalMatches} total matches</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {rules.map((rule) => (
                      <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                        className="flex items-center justify-between px-5 py-3 pl-12 border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{rule.rule_id}</span>
                          <span className="text-sm truncate">{rule.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <Badge variant="secondary">{rule.session_count} sessions</Badge>
                          <Badge variant={rule.match_count === 0 ? "destructive" : "default"}>
                            {rule.match_count} matches
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
