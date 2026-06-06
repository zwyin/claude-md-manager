'use client';

import { useState, useCallback, memo } from 'react';
import Link from 'next/link';
import { MiniSparkline } from '@/components/metric-visualizations';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n';
import type { RuleWithStats } from '@/lib/types';

interface RuleRowProps {
  rule: RuleWithStats;
  maxDepth: number;
}

export const RuleRow = memo(function RuleRow({ rule, maxDepth }: RuleRowProps) {
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setBody(data.rule?.body ?? '');
      } catch {
        setBody('');
      }
      setLoading(false);
    }
    setExpanded((v) => !v);
  }, [expanded, body, rule.rule_id]);

  const coveragePct = (rule.session_coverage * 100).toFixed(0);
  const sharePct = (rule.citation_share * 100).toFixed(1);

  return (
    <>
      <div
        className="flex items-center px-5 py-3 pl-14 border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent-soft)] transition-colors group"
      >
        <button
          onClick={toggleExpand}
          className="mr-2 text-[var(--meta)] hover:text-[var(--fg)] transition-colors shrink-0"
          aria-label={expanded ? t('accessibility.collapse') : t('accessibility.expand')}
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <Link href={`/rules/${rule.rule_id}`} className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs font-mono text-[var(--meta)] shrink-0">{rule.rule_id}</span>
          <span className="truncate hover:text-[var(--accent)] transition-colors" style={{ fontSize: 14, fontWeight: 500 }}>{rule.title}</span>
        </Link>
        <div className="flex items-center justify-center shrink-0 gap-1.5 sm:w-[80px]">
          <MiniSparkline session={rule.session_count} matches={rule.match_count} />
          <span className={`tabular-nums text-sm font-mono text-center ${rule.match_count === 0 ? 'text-[var(--danger)]' : ''}`}>
            {rule.match_count}
          </span>
        </div>
        <div className="hidden sm:flex items-center justify-center shrink-0 gap-1" style={{ width: '90px' }}>
          <div className="w-full h-1.5 bg-[var(--surface-warm)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${coveragePct}%` }} />
          </div>
          <span className="tabular-nums text-xs font-mono text-[var(--meta)] w-8 text-right">{coveragePct}%</span>
        </div>
        <div className="hidden sm:flex items-center justify-center shrink-0" style={{ width: '70px' }}>
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(Math.round(rule.avg_depth), maxDepth) }, (_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            ))}
            {Array.from({ length: Math.max(0, maxDepth - Math.round(rule.avg_depth)) }, (_, i) => (
              <span key={`e-${i}`} className="w-1.5 h-1.5 rounded-full bg-[var(--border)]" />
            ))}
          </div>
        </div>
        <div className="hidden sm:flex items-center justify-center shrink-0" style={{ width: '80px' }}>
          <span className="tabular-nums text-xs font-mono text-[var(--meta)]">{sharePct}%</span>
        </div>
      </div>
      {expanded && (
        <div className="px-5 py-3 pl-20 border-b border-[var(--border)] bg-[var(--surface)]">
          {loading ? (
            <div className="text-xs text-[var(--meta)] animate-pulse">{t('status.loading')}</div>
          ) : body ? (
            <div className="prose prose-sm max-w-none max-h-[300px] overflow-y-auto
              prose-headings:text-[var(--fg)] prose-p:text-[var(--fg-2)] prose-strong:text-[var(--fg)]
              prose-code:text-[var(--fg)] prose-a:text-[var(--accent)]
              prose-code:before:content-[''] prose-code:after:content-['']
              prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-xs text-[var(--meta)] italic">{t('ruleDetail.noContent')}</div>
          )}
          <div className="mt-2 flex items-center gap-3">
            <Link href={`/rules/${rule.rule_id}`} className="text-xs text-[var(--accent)] hover:underline">
              {t('rules.viewDetail')} →
            </Link>
            <Link href={`/editor?rule=${encodeURIComponent(rule.rule_id)}`} className="text-xs text-[var(--accent)] hover:underline">
              {t('ruleDetail.editInEditor')} →
            </Link>
          </div>
        </div>
      )}
    </>
  );
});
