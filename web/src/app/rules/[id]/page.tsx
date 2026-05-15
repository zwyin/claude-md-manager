'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Rule {
  rule_id: string;
  section_id: string;
  title: string;
  keywords: string[];
  source_file: string;
  updated_at: string;
  citation_count: number;
  last_cited: string | null;
}

interface CitationRecord {
  id: number;
  rule_id: string;
  session_id: string;
  matched_keyword: string;
  timestamp: string;
  model: string | null;
  task_summary: string | null;
}

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params?.id as string;
  const [rule, setRule] = useState<Rule | null>(null);
  const [citations, setCitations] = useState<CitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ruleId) return;
    fetch(`/api/rules/${encodeURIComponent(ruleId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setRule(json.rule);
        setCitations(json.citations || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [ruleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#718096] text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/rules" className="text-sm text-[#4299e1] hover:underline">
          &larr; Back to Rules
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          Failed to load rule: {error}
        </div>
      </div>
    );
  }

  if (!rule) return null;

  const uniqueSessions = new Set(citations.map((c) => c.session_id)).size;

  return (
    <div className="space-y-6">
      <Link
        href="/rules"
        className="text-sm text-[#4299e1] hover:underline inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Rules
      </Link>

      {/* Rule header */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-mono text-[#718096] mb-1">{rule.rule_id}</div>
            <h1 className="text-xl font-bold text-[#1a202c]">{rule.title}</h1>
            <div className="text-sm text-[#718096] mt-1">
              Section: <span className="text-[#4a5568] font-medium">{rule.section_id}</span>
              {' · '}
              Source: <span className="text-[#4a5568] font-medium">{rule.source_file}</span>
            </div>
            {rule.last_cited && (
              <div className="text-xs text-[#718096] mt-1">
                Last cited: {new Date(rule.last_cited).toLocaleString('zh-CN')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {uniqueSessions} sessions
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                rule.citation_count === 0
                  ? 'bg-red-100 text-red-800'
                  : rule.citation_count >= 10
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              {rule.citation_count} matches
            </span>
          </div>
        </div>

        {rule.keywords && rule.keywords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
            <div className="text-xs font-medium text-[#718096] uppercase tracking-wide mb-2">
              Keywords
            </div>
            <div className="flex flex-wrap gap-2">
              {rule.keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#edf2f7] text-[#4a5568]"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent citations */}
      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-base font-semibold text-[#1a202c]">
            Recent Citations ({citations.length})
          </h2>
        </div>
        {citations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#718096] uppercase tracking-wide border-b border-[#e2e8f0]">
                  <th className="text-left px-5 py-3 font-medium">Time</th>
                  <th className="text-left px-5 py-3 font-medium">Keyword</th>
                  <th className="text-left px-5 py-3 font-medium">Session</th>
                </tr>
              </thead>
              <tbody>
                {citations.slice(0, 50).map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f7fafc] transition-colors"
                  >
                    <td className="px-5 py-2.5 text-xs text-[#4a5568] font-mono whitespace-nowrap">
                      {new Date(c.timestamp).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#edf2f7] text-[#4a5568]">
                        {c.matched_keyword}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs font-mono text-[#718096] max-w-[200px] truncate">
                      {c.session_id.replace('historical_', '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {citations.length > 50 && (
              <div className="px-5 py-3 text-xs text-[#718096] text-center border-t border-[#e2e8f0]">
                Showing 50 of {citations.length} citations
              </div>
            )}
          </div>
        ) : (
          <div className="px-5 py-8 text-sm text-[#718096] text-center">
            No citation data available
          </div>
        )}
      </div>
    </div>
  );
}
