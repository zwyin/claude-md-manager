'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TopRule {
  rule_id: string;
  title: string;
  citation_count: number;
}

interface ColdRule {
  rule_id: string;
  title: string;
  days_since_last_citation: number | null;
}

interface CategoryDist {
  section_id: string;
  rule_count: number;
  citation_count: number;
}

interface AnalyticsData {
  total_rules: number;
  total_citations: number;
  total_sessions: number;
  top_rules: TopRule[];
  cold_rules: ColdRule[];
  category_distribution: CategoryDist[];
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

  if (loading) return <div className="text-[#718096] text-sm p-4">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const maxCitation = Math.max(...(data.top_rules || []).map(r => r.citation_count), 1);
  const maxCatCitation = Math.max(...(data.category_distribution || []).map(c => c.citation_count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a202c]">Analytics</h1>
        <p className="text-sm text-[#718096] mt-1">Rule usage statistics and distribution</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4">
          <div className="text-xs font-medium text-[#718096] uppercase">Total Rules</div>
          <div className="text-2xl font-bold text-[#1a202c] mt-1">{data.total_rules}</div>
        </div>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4">
          <div className="text-xs font-medium text-[#718096] uppercase">Total Citations</div>
          <div className="text-2xl font-bold text-[#48bb78] mt-1">{data.total_citations?.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4">
          <div className="text-xs font-medium text-[#718096] uppercase">Total Sessions</div>
          <div className="text-2xl font-bold text-[#4299e1] mt-1">{data.total_sessions?.toLocaleString()}</div>
        </div>
      </div>

      {/* Top 10 bar chart */}
      {data.top_rules && data.top_rules.length > 0 && (
        <div className="bg-white rounded-lg border border-[#e2e8f0]">
          <div className="px-5 py-3 border-b border-[#e2e8f0]">
            <h2 className="text-base font-semibold text-[#1a202c]">Top 10 Rules</h2>
          </div>
          <div className="p-4 space-y-2">
            {data.top_rules.map((rule, i) => {
              const pct = (rule.citation_count / maxCitation) * 100;
              const colors = ['bg-emerald-500', 'bg-emerald-400', 'bg-teal-400', 'bg-blue-400', 'bg-blue-300',
                              'bg-indigo-300', 'bg-indigo-200', 'bg-violet-300', 'bg-violet-200', 'bg-gray-300'];
              return (
                <div key={rule.rule_id} className="flex items-center gap-2">
                  <span className="text-xs text-[#718096] w-4 text-right">{i + 1}</span>
                  <Link href={`/rules/${rule.rule_id}`} className="text-xs text-[#4299e1] hover:underline w-52 truncate flex-shrink-0" title={rule.rule_id}>
                    {rule.title}
                  </Link>
                  <div className="flex-1 bg-[#edf2f7] rounded h-5 relative overflow-hidden">
                    <div className={`h-full rounded ${colors[i] || 'bg-gray-300'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[#4a5568] w-16 text-right">{rule.citation_count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category distribution */}
      {data.category_distribution && data.category_distribution.length > 0 && (
        <div className="bg-white rounded-lg border border-[#e2e8f0]">
          <div className="px-5 py-3 border-b border-[#e2e8f0]">
            <h2 className="text-base font-semibold text-[#1a202c]">Category Distribution</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#718096] uppercase border-b border-[#e2e8f0]">
                  <th className="text-left px-5 py-2 font-medium">Section</th>
                  <th className="text-right px-5 py-2 font-medium">Rules</th>
                  <th className="text-right px-5 py-2 font-medium">Citations</th>
                  <th className="px-5 py-2 font-medium w-32">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {data.category_distribution.map((cat) => {
                  const distPct = (cat.citation_count / maxCatCitation) * 100;
                  return (
                    <tr key={cat.section_id} className="border-b border-[#e2e8f0] last:border-0">
                      <td className="px-5 py-2 text-sm text-[#1a202c] font-mono">{cat.section_id}</td>
                      <td className="px-5 py-2 text-sm text-right text-[#4a5568]">{cat.rule_count}</td>
                      <td className="px-5 py-2 text-sm text-right font-medium">{cat.citation_count}</td>
                      <td className="px-5 py-2">
                        <div className="bg-[#edf2f7] rounded-full h-2 w-full">
                          <div className="bg-[#4299e1] h-2 rounded-full" style={{ width: `${distPct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
