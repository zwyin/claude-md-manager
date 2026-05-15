'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RuleStat {
  rule_id: string;
  title: string;
  section_id: string;
  match_count: number;
  session_count: number;
}

interface AnalyticsData {
  top_rules: RuleStat[];
  category_distribution: Record<string, { count: number; total_matches: number }>;
  cold_rules: RuleStat[];
  total_rules: number;
  total_matches: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#718096] text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        Failed to load analytics: {error}
      </div>
    );
  }

  if (!data) return null;

  const maxMatchCount = Math.max(
    ...(data.top_rules || []).map((r) => r.match_count),
    1
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a202c]">Analytics</h1>
        <p className="text-sm text-[#718096] mt-1">
          Rule usage statistics and distribution
        </p>
      </div>

      {/* Top 10 bar chart */}
      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-base font-semibold text-[#1a202c]">Top 10 Rules</h2>
          <p className="text-xs text-[#718096] mt-0.5">By match count</p>
        </div>
        {data.top_rules && data.top_rules.length > 0 ? (
          <div className="p-5 space-y-3">
            {data.top_rules.map((rule, i) => {
              const widthPct = (rule.match_count / maxMatchCount) * 100;
              const barColor =
                i < 3
                  ? 'bg-green-500'
                  : i < 6
                    ? 'bg-blue-500'
                    : 'bg-[#a0aec0]';

              return (
                <div key={rule.rule_id} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#718096] w-6 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <Link
                    href={`/rules/${rule.rule_id}`}
                    className="text-xs text-[#4299e1] hover:underline w-28 truncate flex-shrink-0"
                  >
                    {rule.rule_id}
                  </Link>
                  <div className="flex-1 bg-[#edf2f7] rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all flex items-center ${barColor}`}
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                    >
                      {widthPct > 15 && (
                        <span className="text-xs text-white font-medium px-2">
                          {rule.match_count}
                        </span>
                      )}
                    </div>
                    {widthPct <= 15 && (
                      <span className="absolute left-2 top-0.5 text-xs text-[#4a5568] font-medium">
                        {rule.match_count}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-8 text-sm text-[#718096] text-center">
            No top rules data available
          </div>
        )}
      </div>

      {/* Category distribution */}
      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-base font-semibold text-[#1a202c]">Category Distribution</h2>
          <p className="text-xs text-[#718096] mt-0.5">Rules grouped by section</p>
        </div>
        {data.category_distribution &&
        Object.keys(data.category_distribution).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#718096] uppercase tracking-wide border-b border-[#e2e8f0]">
                  <th className="text-left px-5 py-3 font-medium">Section</th>
                  <th className="text-right px-5 py-3 font-medium">Rule Count</th>
                  <th className="text-right px-5 py-3 font-medium">Total Matches</th>
                  <th className="text-left px-5 py-3 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.category_distribution)
                  .sort(([, a], [, b]) => b.total_matches - a.total_matches)
                  .map(([section, info]) => {
                    const maxDist = Math.max(
                      ...Object.values(data.category_distribution).map((v) => v.total_matches),
                      1
                    );
                    const distPct = (info.total_matches / maxDist) * 100;
                    return (
                      <tr key={section} className="border-b border-[#e2e8f0] last:border-0">
                        <td className="px-5 py-3 text-sm text-[#1a202c] font-medium">
                          {section}
                        </td>
                        <td className="px-5 py-3 text-sm text-right text-[#4a5568]">
                          {info.count}
                        </td>
                        <td className="px-5 py-3 text-sm text-right text-[#1a202c] font-medium">
                          {info.total_matches}
                        </td>
                        <td className="px-5 py-3">
                          <div className="w-24 bg-[#edf2f7] rounded-full h-2">
                            <div
                              className="bg-[#4299e1] h-2 rounded-full"
                              style={{ width: `${distPct}%` }}
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
            No category distribution data available
          </div>
        )}
      </div>

      {/* Cold rules warning */}
      {data.cold_rules && data.cold_rules.length > 0 && (
        <div className="bg-white rounded-lg border border-[#fed7d7] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#fed7d7] bg-red-50 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#e53e3e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-base font-semibold text-[#e53e3e]">
              Cold Rules ({data.cold_rules.length})
            </h2>
            <span className="ml-auto text-xs text-[#e53e3e]">
              These rules have 0 matches and may need review
            </span>
          </div>
          <div className="divide-y divide-[#fed7d7]">
            {data.cold_rules.map((rule) => (
              <Link
                key={rule.rule_id}
                href={`/rules/${rule.rule_id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-red-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[#fc8181]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-mono text-[#718096]">{rule.rule_id}</span>
                  <span className="text-sm text-[#1a202c]">{rule.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#718096]">{rule.section_id}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    0 matches
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-5">
          <div className="text-xs font-medium text-[#718096] uppercase tracking-wide">
            Total Rules
          </div>
          <div className="text-2xl font-bold text-[#1a202c] mt-1">
            {data.total_rules}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-5">
          <div className="text-xs font-medium text-[#718096] uppercase tracking-wide">
            Total Matches
          </div>
          <div className="text-2xl font-bold text-[#48bb78] mt-1">
            {data.total_matches}
          </div>
        </div>
      </div>
    </div>
  );
}
