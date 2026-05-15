'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Citation {
  date: string;
  count: number;
}

interface RelatedRule {
  rule_id: string;
  title: string;
  match_count: number;
}

interface RuleDetail {
  rule_id: string;
  section_id: string;
  title: string;
  keywords: string[];
  session_count: number;
  match_count: number;
  citations: Citation[];
  related_rules: RelatedRule[];
}

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params?.id as string;
  const [data, setData] = useState<RuleDetail | null>(null);
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
        setData(json);
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

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/rules" className="text-sm text-[#4299e1] hover:underline inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Rules
      </Link>

      {/* Rule header */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-mono text-[#718096] mb-1">{data.rule_id}</div>
            <h1 className="text-xl font-bold text-[#1a202c]">{data.title}</h1>
            <div className="text-sm text-[#718096] mt-1">
              Section: <span className="text-[#4a5568] font-medium">{data.section_id}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {data.session_count} sessions
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              data.match_count === 0
                ? 'bg-red-100 text-red-800'
                : data.match_count >= 10
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
            }`}>
              {data.match_count} matches
            </span>
          </div>
        </div>

        {/* Keywords */}
        {data.keywords && data.keywords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
            <div className="text-xs font-medium text-[#718096] uppercase tracking-wide mb-2">
              Keywords
            </div>
            <div className="flex flex-wrap gap-2">
              {data.keywords.map((kw) => (
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

      {/* Citation trend */}
      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-base font-semibold text-[#1a202c]">Citation Trend</h2>
        </div>
        {data.citations && data.citations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#718096] uppercase tracking-wide border-b border-[#e2e8f0]">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Count</th>
                  <th className="text-left px-5 py-3 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.citations.map((c, i) => {
                  const maxCount = Math.max(...data.citations.map((x) => x.count), 1);
                  const widthPct = (c.count / maxCount) * 100;
                  return (
                    <tr key={i} className="border-b border-[#e2e8f0] last:border-0">
                      <td className="px-5 py-2.5 text-sm text-[#4a5568] font-mono">
                        {c.date}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-[#1a202c] font-medium">
                        {c.count}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="w-32 bg-[#edf2f7] rounded-full h-2">
                          <div
                            className="bg-[#4299e1] h-2 rounded-full transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-sm text-[#718096] text-center">
            No citation data available
          </div>
        )}
      </div>

      {/* Related rules */}
      {data.related_rules && data.related_rules.length > 0 && (
        <div className="bg-white rounded-lg border border-[#e2e8f0]">
          <div className="px-5 py-4 border-b border-[#e2e8f0]">
            <h2 className="text-base font-semibold text-[#1a202c]">Related Rules (Same Section)</h2>
          </div>
          <div className="divide-y divide-[#e2e8f0]">
            {data.related_rules.map((related) => (
              <Link
                key={related.rule_id}
                href={`/rules/${related.rule_id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-[#f7fafc] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#4a5568]">
                    {related.rule_id}
                  </span>
                  <span className="text-sm text-[#1a202c]">
                    {related.title}
                  </span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  related.match_count === 0
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {related.match_count} matches
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
