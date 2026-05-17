'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/i18n';

interface Rule {
  rule_id: string; section_id: string; section_title: string;
  title: string; keywords: string[]; session_count: number; match_count: number;
}
interface Section {
  section_id: string; title: string; source_file: string;
  rule_count: number; total_citations: number; total_sessions: number;
}
interface RulesData {
  rules: Rule[]; sections: Section[]; total_rules: number;
}

const SECTION_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function MiniSparkline({ session, matches }: { session: number; matches: number }) {
  const max = Math.max(session, matches, 1);
  const data = [
    { v: session / max },
    { v: matches / max },
  ];
  return (
    <div className="w-12 h-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area type="monotone" dataKey="v" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={1} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-4">Loading...</div>}>
      <RulesContent />
    </Suspense>
  );
}

function RulesContent() {
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        setData(json);
        const open: Record<string, boolean> = {};
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

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
  if (!data) return null;

  const sectionTitleMap: Record<string, string> = {};
  for (const sec of data.sections || []) {
    sectionTitleMap[sec.section_id] = sec.title;
  }

  const grouped: Record<string, Rule[]> = {};
  for (const rule of data.rules || []) {
    if (!grouped[rule.section_id]) grouped[rule.section_id] = [];
    grouped[rule.section_id].push(rule);
  }

  const sectionOrder = (data.sections || [])
    .sort((a, b) => b.total_citations - a.total_citations)
    .map((s) => s.section_id);
  for (const id of Object.keys(grouped)) {
    if (!sectionOrder.includes(id)) sectionOrder.push(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('rules.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('rules.subtitle', { total: data.total_rules, sections: Object.keys(grouped).length })}
        </p>
      </div>

      <div className="space-y-3">
        {sectionOrder.map((sectionId, sIdx) => {
          const rules = grouped[sectionId];
          if (!rules) return null;
          const isOpen = openSections[sectionId] !== false;
          const totalMatches = rules.reduce((s, r) => s + r.match_count, 0);
          const sectionTitle = sectionTitleMap[sectionId] || sectionId;
          const color = SECTION_COLORS[sIdx % SECTION_COLORS.length];

          return (
            <Card key={sectionId} className="rounded-xl border-border bg-card overflow-hidden">
              <Collapsible open={isOpen} onOpenChange={() => toggle(sectionId)}>
                <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 rounded-full" style={{ backgroundColor: color }} />
                    <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-semibold">{sectionTitle}</span>
                    <span className="text-xs text-muted-foreground font-mono">{sectionId}</span>
                    <span className="text-xs text-muted-foreground">{rules.length} {t('table.rules')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{t('rules.totalMatches', { count: totalMatches })}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border">
                    {rules.map((rule) => (
                      <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                        className="flex items-center justify-between px-5 py-3 pl-14 border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{rule.rule_id}</span>
                          <span className="text-sm truncate">{rule.title}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <MiniSparkline session={rule.session_count} matches={rule.match_count} />
                          <Badge variant="secondary" className="text-xs">{rule.session_count} {t('table.sessions')}</Badge>
                          <Badge variant={rule.match_count === 0 ? "destructive" : "default"} className="text-xs">{rule.match_count}</Badge>
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
