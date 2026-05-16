'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface RulesData {
  rules: Rule[];
  sections: Section[];
  total_rules: number;
}

export default function RulesPage() {
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        setData(json);
        const open: Record<string, boolean> = {};
        // If ?section=xxx in URL, open only that section; otherwise open all
        const focusSection = searchParams.get('section');
        (json.rules || []).forEach((r: Rule) => {
          open[r.section_id] = focusSection ? r.section_id === focusSection : true;
        });
        setOpenSections(open);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [searchParams]);

  const toggle = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (error) return <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">{error}</div>;
  if (!data) return null;

  // Build section_id → title map
  const sectionTitleMap: Record<string, string> = {};
  for (const sec of data.sections || []) {
    sectionTitleMap[sec.section_id] = sec.title;
  }

  const grouped: Record<string, Rule[]> = {};
  for (const rule of data.rules || []) {
    if (!grouped[rule.section_id]) grouped[rule.section_id] = [];
    grouped[rule.section_id].push(rule);
  }

  // Sort sections by total citations (from sections data)
  const sectionOrder = (data.sections || [])
    .sort((a, b) => b.total_citations - a.total_citations)
    .map((s) => s.section_id);
  // Include any sections not in sections data
  for (const id of Object.keys(grouped)) {
    if (!sectionOrder.includes(id)) sectionOrder.push(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">{data.total_rules} rules in {Object.keys(grouped).length} sections</p>
      </div>

      <div className="space-y-3">
        {sectionOrder.map((sectionId) => {
          const rules = grouped[sectionId];
          if (!rules) return null;
          const isOpen = openSections[sectionId] !== false;
          const totalMatches = rules.reduce((s, r) => s + r.match_count, 0);
          const sectionTitle = sectionTitleMap[sectionId] || sectionId;

          return (
            <Card key={sectionId}>
              <Collapsible open={isOpen} onOpenChange={() => toggle(sectionId)}>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-semibold">{sectionTitle}</span>
                    <span className="text-xs text-muted-foreground font-mono">{sectionId}</span>
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
