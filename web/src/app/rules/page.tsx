'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { SECTION_COLORS, PRIMARY, STAT_COLORS } from '@/lib/chart-colors';
import { TermTooltip } from '@/components/term-tooltip';
import type { RuleWithStats, SectionWithStats } from '@/lib/types';

interface RulesData {
  rules: RuleWithStats[]; sections: SectionWithStats[]; total_rules: number;
  total_sessions: number; total_citations: number;
}

function MiniSparkline({ session, matches }: { session: number; matches: number }) {
  const max = Math.max(session, matches, 1);
  const h1 = 16 - (session / max) * 12;
  const h2 = 16 - (matches / max) * 12;
  return (
    <svg width="48" height="16" viewBox="0 0 48 16" className="shrink-0" role="img" aria-label={`${matches} matches in ${session} sessions`}>
      <line x1="12" y1={h1} x2="36" y2={h2} stroke={PRIMARY} strokeWidth="1.5" />
      <line x1="0" y1="16" x2="48" y2="16" stroke={PRIMARY} strokeWidth="0" />
      <polygon points={`0,16 12,${h1} 36,${h2} 48,16`} fill={PRIMARY} fillOpacity="0.15" />
      <circle cx="12" cy={h1} r="2" fill={PRIMARY} />
      <circle cx="36" cy={h2} r="2" fill={PRIMARY} />
    </svg>
  );
}

function MiniCoverageBar({ value }: { value: number }) {
  const w = Math.round(value * 28);
  return (
    <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0" role="img" aria-label={`${(value * 100).toFixed(0)}% coverage`}>
      <rect x="2" y="5" width="28" height="6" rx="3" fill={SECTION_COLORS[4]} fillOpacity="0.2" />
      <rect x="2" y="5" width={Math.max(w, 2)} height="6" rx="3" fill={SECTION_COLORS[4]} fillOpacity="0.8" />
    </svg>
  );
}

function MiniDepthBar({ value, max }: { value: number; max: number }) {
  const h = Math.round((value / Math.max(max, 1)) * 10);
  return (
    <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0" role="img" aria-label={`depth ${value.toFixed(1)}`}>
      <rect x="2" y="2" width="4" height="12" rx="2" fill="#27272a" />
      <rect x="2" y={14 - Math.max(h, 2)} width="4" height={Math.max(h, 2)} rx="2" fill={STAT_COLORS.avgDepth} fillOpacity="0.8" />
      <line x1="12" y1="8" x2="28" y2="8" stroke="#27272a" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="20" cy={14 - h} r="2.5" fill={STAT_COLORS.avgDepth} />
    </svg>
  );
}

function MetricBar({ value, color }: { value: number; color: string }) {
  const w = Math.round(value * 28);
  return (
    <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0" role="img" aria-label={`${(value * 100).toFixed(1)}%`}>
      <rect x="2" y="5" width="28" height="6" rx="3" fill="#27272a" />
      <rect x="2" y="5" width={Math.max(w, 2)} height="6" rx="3" fill={color} fillOpacity="0.8" />
    </svg>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <RulesContent />
    </Suspense>
  );
}

function RulesContent() {
  const { data, loading, error } = useFetch<RulesData>('/api/rules');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    if (!data) return;
    const open: Record<string, boolean> = {};
    const focusSection = searchParams.get('section');
    (data.rules || []).forEach((r) => {
      open[r.section_id] = focusSection ? r.section_id === focusSection : true;
    });
    queueMicrotask(() => {
      setOpenSections(open);
      if (focusSection) setSectionFilter(focusSection);
    });
  }, [data, searchParams]);

  const toggle = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const sectionTitleMap: Record<string, string> = {};
  for (const sec of data?.sections || []) {
    sectionTitleMap[sec.section_id] = sec.title;
  }

  const grouped = useMemo(() => {
    const result: Record<string, RuleWithStats[]> = {};
    for (const rule of data?.rules || []) {
      if (!result[rule.section_id]) result[rule.section_id] = [];
      result[rule.section_id].push(rule);
    }
    return result;
  }, [data]);

  const sectionOrder = useMemo(() => {
    const order = [...(data?.sections || [])]
      .sort((a, b) => b.total_citations - a.total_citations)
      .map((s) => s.section_id);
    for (const id of Object.keys(grouped)) {
      if (!order.includes(id)) order.push(id);
    }
    return order;
  }, [data, grouped]);

  const filteredGrouped = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result: Record<string, RuleWithStats[]> = {};
    for (const sectionId of sectionOrder) {
      if (sectionFilter !== 'all' && sectionId !== sectionFilter) continue;
      const rules = (grouped[sectionId] || []).filter((rule) => {
        if (!q) return true;
        return (
          rule.title.toLowerCase().includes(q) ||
          rule.rule_id.toLowerCase().includes(q) ||
          rule.keywords.some((k) => k.toLowerCase().includes(q)) ||
          rule.source_file?.toLowerCase().includes(q)
        );
      });
      if (rules.length > 0) result[sectionId] = rules;
    }
    return result;
  }, [searchQuery, sectionFilter, grouped, sectionOrder]);

  const filteredCount = Object.values(filteredGrouped).flat().length;
  const maxDepth = Math.max(...(data?.rules || []).map((r) => r.avg_depth), 1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('rules.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('rules.subtitle', { total: data.total_rules, sections: Object.keys(grouped).length })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t('rules.searchPlaceholder')} (⌘K)`}
            className="pl-9 h-9 text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} aria-label={t('rules.clearSearch')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          aria-label={t('rules.allSections')}
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="h-9 text-sm rounded-md border border-border bg-card text-foreground px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">{t('rules.allSections')}</option>
          {sectionOrder.map((id) => (
            <option key={id} value={id}>{sectionTitleMap[id] || id}</option>
          ))}
        </select>
      </div>

      {filteredCount === 0 && searchQuery && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {t('rules.noResults')}
        </div>
      )}

      <div className="space-y-3">
        {sectionOrder.map((sectionId, sIdx) => {
          const rules = filteredGrouped[sectionId];
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
                    {/* Column headers */}
                    <div className="flex items-center px-5 py-2 pl-14 bg-muted/30 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                      <span className="flex-1 min-w-0">{t('rules.ruleName')}</span>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '80px' }}>
                        <span className="text-center w-full">{t('table.matches')}</span>
                      </div>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '90px' }}>
                        <span className="text-center w-full"><TermTooltip term={t('metric.coverage')} explanation={t('metric.coverage.desc')} /></span>
                      </div>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '70px' }}>
                        <span className="text-center w-full"><TermTooltip term={t('metric.depth')} explanation={t('metric.depth.desc')} /></span>
                      </div>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '80px' }}>
                        <span className="text-center w-full"><TermTooltip term={t('metric.share')} explanation={t('metric.share.desc')} /></span>
                      </div>
                    </div>
                    {rules.map((rule) => (
                      <Link key={rule.rule_id} href={`/rules/${rule.rule_id}`}
                        className="flex items-center px-5 py-3 pl-14 border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{rule.rule_id}</span>
                          <span className="text-sm truncate">{rule.title}</span>
                        </div>
                        <div className="flex items-center justify-center shrink-0 gap-1.5" style={{ width: '80px' }}>
                          <MiniSparkline session={rule.session_count} matches={rule.match_count} />
                          <Badge variant={rule.match_count === 0 ? "destructive" : "default"} className="text-xs font-mono">{rule.match_count}</Badge>
                        </div>
                        <div className="flex items-center justify-center shrink-0 gap-1" style={{ width: '90px' }}>
                          <MiniCoverageBar value={rule.session_coverage} />
                          <Badge variant="secondary" className="text-xs font-mono" title={`${rule.session_count}/${data?.total_sessions ?? 0} ${t('table.sessions').toLowerCase()}`}>{(rule.session_coverage * 100).toFixed(0)}%</Badge>
                        </div>
                        <div className="flex items-center justify-center shrink-0 gap-1" style={{ width: '70px' }}>
                          <MiniDepthBar value={rule.avg_depth} max={maxDepth} />
                          <Badge variant="outline" className="text-xs font-mono" title={`${rule.match_count}/${rule.session_count} ${t('table.matches').toLowerCase()}/${t('table.sessions').toLowerCase()}`}>{rule.avg_depth.toFixed(1)}</Badge>
                        </div>
                        <div className="flex items-center justify-center shrink-0 gap-1" style={{ width: '80px' }}>
                          <MetricBar value={rule.citation_share} color={STAT_COLORS.citations} />
                          <Badge variant="secondary" className="text-xs font-mono">{(rule.citation_share * 100).toFixed(1)}%</Badge>
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
