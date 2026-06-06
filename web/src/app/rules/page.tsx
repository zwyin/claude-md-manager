'use client';

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageLoader, PageError, RulesSkeleton } from '@/components/page-states';
import { RuleRow } from '@/components/rule-row';
import type { RuleWithStats, SectionWithStats } from '@/lib/types';

interface RulesData {
  rules: RuleWithStats[]; sections: SectionWithStats[]; total_rules: number;
  total_sessions: number; total_citations: number;
  avg_coverage: number; avg_depth: number;
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
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') ?? '');
  const { t } = useI18n();
  usePageTitle('rules.title');

  const validSortKeys = ['default', 'match_count', 'session_coverage', 'avg_depth', 'citation_share'] as const;
  type SortKey = typeof validSortKeys[number];

  const [sectionFilter, setSectionFilter] = useState<string>(() => searchParams.get('section') ?? 'all');
  const [sortBy, setSortBy] = useState<SortKey>(() => {
    const s = searchParams.get('sort');
    return validSortKeys.includes(s as SortKey) ? (s as SortKey) : 'default';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => searchParams.get('dir') === 'asc' ? 'asc' : 'desc');

  useEffect(() => {
    if (!data) return;
    const open: Record<string, boolean> = {};
    const focusSection = searchParams.get('section');
    (data.rules || []).forEach((r) => {
      open[r.section_id] = focusSection ? r.section_id === focusSection : true;
    });
    queueMicrotask(() => {
      setOpenSections(open);
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

  const allOpen = sectionOrder.length > 0 && sectionOrder.every((id) => openSections[id] !== false);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    sectionOrder.forEach((id) => { next[id] = !allOpen; });
    setOpenSections(next);
  };
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

  const syncUrl = useCallback((section: string, sort: string, dir: string, search: string) => {
    const params = new URLSearchParams();
    if (section !== 'all') params.set('section', section);
    if (sort !== 'default') params.set('sort', sort);
    if (dir !== 'desc') params.set('dir', dir);
    if (search) params.set('search', search);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '/rules', { scroll: false });
  }, [router]);

  const toggleSort = useCallback((key: SortKey) => {
    let newSort = key;
    let newDir: 'asc' | 'desc';
    if (sortBy === key) {
      newDir = sortDir === 'desc' ? 'asc' : 'desc';
      newSort = sortBy;
      setSortDir(newDir);
    } else {
      newDir = 'desc';
      setSortBy(key);
      setSortDir('desc');
    }
    syncUrl(sectionFilter, newSort, newDir, searchQuery);
  }, [sortBy, sortDir, sectionFilter, searchQuery, syncUrl]);

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
    <div style={{ padding: 'var(--space-8)', flex: 1, maxWidth: 1400 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 500, lineHeight: 'var(--leading-tight)' }}>
          {t('rules.title')}
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 'var(--space-2)' }}>
          {t('rules.subtitle', { total: data.total_rules, sections: Object.keys(grouped).length })}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Search box */}
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--meta)]" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); syncUrl(sectionFilter, sortBy, sortDir, e.target.value); }}
            placeholder={`${t('rules.searchPlaceholder')}…`}
            className="w-full py-2.5 pl-10 pr-14 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface)] text-[var(--fg)] placeholder:text-[var(--meta)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            style={{ fontSize: 14 }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[var(--meta)] bg-[var(--bg)] px-1.5 py-0.5 border border-[var(--border)] rounded">⌘K</span>
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); syncUrl(sectionFilter, sortBy, sortDir, ''); }} aria-label={t('rules.clearSearch')} className="absolute right-14 top-1/2 -translate-y-1/2 text-[var(--meta)] hover:text-[var(--fg)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Section filter pills */}
        <div className="inline-flex bg-[var(--surface)] border border-[var(--border)] rounded-lg p-[3px]">
          <button
            onClick={() => { setSectionFilter('all'); syncUrl('all', sortBy, sortDir, searchQuery); }}
            className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${sectionFilter === 'all' ? 'bg-[var(--fg)] text-[var(--surface)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
          >
            {t('rules.allSections')}
          </button>
          {sectionOrder.map((id) => (
            <button
              key={id}
              onClick={() => { setSectionFilter(id); syncUrl(id, sortBy, sortDir, searchQuery); }}
              className={`px-3.5 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${sectionFilter === id ? 'bg-[var(--fg)] text-[var(--surface)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
            >
              {sectionTitleMap[id] || id}
            </button>
          ))}
        </div>

        {/* Sort select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="py-2 px-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-sm text-[var(--fg)] cursor-pointer"
        >
          <option value="default">{t('rules.sort.default')}</option>
          <option value="match_count">{t('rules.sort.matchCount')}</option>
          <option value="session_coverage">{t('rules.sort.coverage')}</option>
          <option value="avg_depth">{t('rules.sort.depth')}</option>
          <option value="citation_share">{t('rules.sort.share')}</option>
        </select>

        {/* Toggle all */}
        <button
          onClick={toggleAll}
          className="py-2 px-3.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:border-[var(--fg)] transition-colors whitespace-nowrap"
        >
          {allOpen ? t('editor.hideRules') : t('editor.showRules')}
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {sectionOrder.map((sectionId) => {
          const rules = sortedGrouped[sectionId];
          if (!rules) return null;
          const isOpen = openSections[sectionId] !== false;
          const sectionTitle = sectionTitleMap[sectionId] || sectionId;

          return (
            <div key={sectionId}>
              <Collapsible open={isOpen} onOpenChange={() => toggle(sectionId)}>
                <CollapsibleTrigger className="w-full flex items-center gap-3 px-5 py-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl cursor-pointer hover:bg-[color-mix(in_oklch,var(--surface)_80%,var(--bg))] transition-colors select-none">
                  <svg className={`w-[18px] h-[18px] text-[var(--meta)] transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500 }}>{sectionTitle}</span>
                  <span className="font-mono text-xs text-[var(--meta)] bg-[var(--bg)] px-2 py-0.5 rounded-full">
                    {t("session.ruleCount", { count: rules.length })}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 border-[var(--border)] rounded-b-xl overflow-hidden">
                    {rules.map((rule) => (
                      <RuleRow
                        key={rule.rule_id}
                        rule={rule}
                        maxDepth={maxDepth}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
}
