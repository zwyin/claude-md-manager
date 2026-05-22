'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MiniSparkline, MiniCoverageBar, MiniDepthBar, InlineMetricBar } from '@/components/metric-visualizations';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { STAT_COLORS } from '@/lib/chart-colors';
import { useI18n } from '@/i18n';
import type { RuleWithStats } from '@/lib/types';

interface RuleRowProps {
  rule: RuleWithStats;
  totalSessions: number;
  maxDepth: number;
  totalCitations: number;
}

export function RuleRow({ rule, totalSessions, maxDepth, totalCitations }: RuleRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const toggleExpand = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!expanded && body === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/rules/${encodeURIComponent(rule.rule_id)}`);
        const data = await res.json();
        setBody(data.rule?.body ?? '');
      } catch {
        setBody('');
      }
      setLoading(false);
    }
    setExpanded((v) => !v);
  }, [expanded, body, rule.rule_id]);

  return (
    <>
      <div
        className="flex items-center px-5 py-3 pl-14 border-b border-border last:border-0 hover:bg-accent/30 transition-colors group"
      >
        <button
          onClick={toggleExpand}
          className="mr-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <Link href={`/rules/${rule.rule_id}`} className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs font-mono text-muted-foreground shrink-0">{rule.rule_id}</span>
          <span className="text-sm truncate hover:text-indigo-400 transition-colors">{rule.title}</span>
        </Link>
        <div className="flex items-center justify-center shrink-0 gap-1.5 sm:w-[80px]">
          <MiniSparkline session={rule.session_count} matches={rule.match_count} />
          <Badge variant={rule.match_count === 0 ? "destructive" : "default"} className="text-xs font-mono">{rule.match_count}</Badge>
        </div>
        <div className="hidden sm:flex items-center justify-center shrink-0 gap-1" style={{ width: '90px' }}>
          <MiniCoverageBar value={rule.session_coverage} />
          <Badge variant="secondary" className="text-xs font-mono" title={`${rule.session_count}/${totalSessions} ${t('table.sessions').toLowerCase()}`}>{(rule.session_coverage * 100).toFixed(0)}%</Badge>
        </div>
        <div className="hidden sm:flex items-center justify-center shrink-0 gap-1" style={{ width: '70px' }}>
          <MiniDepthBar value={rule.avg_depth} max={maxDepth} />
          <Badge variant="outline" className="text-xs font-mono" title={`${rule.match_count}/${rule.session_count} ${t('table.matches').toLowerCase()}/${t('table.sessions').toLowerCase()}`}>{rule.avg_depth.toFixed(1)}</Badge>
        </div>
        <div className="hidden sm:flex items-center justify-center shrink-0 gap-1" style={{ width: '80px' }}>
          <InlineMetricBar value={rule.citation_share} color={STAT_COLORS.citations} />
          <Badge variant="secondary" className="text-xs font-mono">{(rule.citation_share * 100).toFixed(1)}%</Badge>
        </div>
      </div>
      {expanded && (
        <div className="px-5 py-3 pl-20 border-b border-border bg-muted/10">
          {loading ? (
            <div className="text-xs text-muted-foreground animate-pulse">{t('status.loading')}</div>
          ) : body ? (
            <div className="prose prose-sm prose-invert max-w-none max-h-[300px] overflow-y-auto
              prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground
              prose-code:text-foreground prose-a:text-indigo-400
              prose-code:before:content-[''] prose-code:after:content-['']
              prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">{t('ruleDetail.noContent')}</div>
          )}
          <div className="mt-2 flex items-center gap-3">
            <Link href={`/rules/${rule.rule_id}`} className="text-xs text-indigo-400 hover:underline">
              {t('rules.viewDetail')} →
            </Link>
            <Link href={`/editor?rule=${encodeURIComponent(rule.rule_id)}`} className="text-xs text-indigo-400 hover:underline">
              {t('ruleDetail.editInEditor')} →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
