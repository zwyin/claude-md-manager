'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { usePageTitle } from '@/hooks/use-page-title';
import { SECTION_COLORS } from '@/lib/chart-colors';
import { TermTooltip } from '@/components/term-tooltip';
import { PageLoader, PageError, RulesSkeleton } from '@/components/page-states';
import { RuleRow } from '@/components/rule-row';
import type { RuleWithStats, SectionWithStats } from '@/lib/types';

interface RulesData {
  rules: RuleWithStats[]; sections: SectionWithStats[]; total_rules: number;
  total_sessions: number; total_citations: number;
}

export default function RulesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RulesContent />
    </Suspense>
  );
}

function RulesContent() {
  const { data, loading, error } = useFetch<RulesData>('/api/rules');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'match_count' | 'session_coverage' | 'avg_depth' | 'citation_share'>('default');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const { t } = useI18n();
  usePageTitle('rules.title');

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

  const sortedGrouped = useMemo(() => {
    if (sortBy === 'default') return filteredGrouped;
    const result: Record<string, RuleWithStats[]> = {};
    for (const [sectionId, rules] of Object.entries(filteredGrouped)) {
      result[sectionId] = [...rules].sort((a, b) => {
        const va = a[sortBy] ?? 0;
        const vb = b[sortBy] ?? 0;
        return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number);
      });
    }
    return result;
  }, [filteredGrouped, sortBy, sortDir]);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const sortIcon = (key: typeof sortBy) => {
    if (sortBy !== key) return ' ↕';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };

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

  if (loading && !data) return <RulesSkeleton />;
  if (error) return <PageError message={t('status.error', { error })} />;
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
          const rules = sortedGrouped[sectionId];
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
                  <div className="border-t border-border overflow-x-auto">
                    {/* Column headers */}
                    <div className="flex items-center px-5 py-2 pl-14 bg-muted/30 text-xs text-muted-foreground font-medium uppercase tracking-wider min-w-[640px]">
                      <span className="flex-1 min-w-0">{t('rules.ruleName')}</span>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '80px' }}>
                        <button onClick={() => toggleSort('match_count')} className="text-center w-full hover:text-foreground transition-colors cursor-pointer">{t('table.matches')}{sortIcon('match_count')}</button>
                      </div>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '90px' }}>
                        <button onClick={() => toggleSort('session_coverage')} className="text-center w-full hover:text-foreground transition-colors cursor-pointer"><TermTooltip term={t('metric.coverage')} explanation={t('metric.coverage.desc')} />{sortIcon('session_coverage')}</button>
                      </div>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '70px' }}>
                        <button onClick={() => toggleSort('avg_depth')} className="text-center w-full hover:text-foreground transition-colors cursor-pointer"><TermTooltip term={t('metric.depth')} explanation={t('metric.depth.desc')} />{sortIcon('avg_depth')}</button>
                      </div>
                      <div className="flex items-center shrink-0 gap-1" style={{ width: '80px' }}>
                        <button onClick={() => toggleSort('citation_share')} className="text-center w-full hover:text-foreground transition-colors cursor-pointer"><TermTooltip term={t('metric.share')} explanation={t('metric.share.desc')} />{sortIcon('citation_share')}</button>
                      </div>
                    </div>
                    {rules.map((rule) => (
                      <RuleRow
                        key={rule.rule_id}
                        rule={rule}
                        totalSessions={data?.total_sessions ?? 0}
                        maxDepth={maxDepth}
                        totalCitations={data?.total_citations ?? 0}
                      />
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
