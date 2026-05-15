'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Rule {
  rule_id: string;
  section_id: string;
  title: string;
  keywords: string[];
  session_count: number;
  match_count: number;
}

interface DashboardData {
  rules: Rule[];
  total_rules: number;
  total_sessions: number;
  active_rule_pct: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/rules')
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
        Failed to load data: {error}
      </div>
    );
  }

  if (!data) return null;

  const topRules = [...(data.rules || [])]
    .sort((a, b) => b.match_count - a.match_count)
    .slice(0, 10);

  const coldRules = (data.rules || []).filter((r) => r.match_count === 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a202c]">Dashboard</h1>
        <p className="text-sm text-[#718096] mt-1">CLAUDE.md rule overview and statistics</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-5">
          <div className="text-xs font-medium text-[#718096] uppercase tracking-wide">
            Total Rules
          </div>
          <div className="text-3xl font-bold text-[#1a202c] mt-2">
            {data.total_rules}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-5">
          <div className="text-xs font-medium text-[#718096] uppercase tracking-wide">
            Total Sessions
          </div>
          <div className="text-3xl font-bold text-[#1a202c] mt-2">
            {data.total_sessions}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-5">
          <div className="text-xs font-medium text-[#718096] uppercase tracking-wide">
            Active Rule %
          </div>
          <div className="text-3xl font-bold text-[#48bb78] mt-2">
            {data.active_rule_pct}%
          </div>
        </div>
      </div>

      {/* Top 10 rules table */}
      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-base font-semibold text-[#1a202c]">Top 10 Rules</h2>
        </div>
        {topRules.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[#718096] uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="text-left px-5 py-3 font-medium">Rule ID</th>
                <th className="text-left px-5 py-3 font-medium">Title</th>
                <th className="text-right px-5 py-3 font-medium">Sessions</th>
                <th className="text-right px-5 py-3 font-medium">Matches</th>
              </tr>
            </thead>
            <tbody>
              {topRules.map((rule) => (
                <tr
                  key={rule.rule_id}
                  className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f7fafc] transition-colors"
                >
                  <td className="px-5 py-3 text-sm font-mono text-[#4299e1]">
                    <Link href={`/rules/${rule.rule_id}`} className="hover:underline">
                      {rule.rule_id}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-[#1a202c]">
                    <Link href={`/rules/${rule.rule_id}`} className="hover:underline">
                      {rule.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-right text-[#4a5568]">
                    {rule.session_count}
                  </td>
                  <td className="px-5 py-3 text-sm text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {rule.match_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-8 text-sm text-[#718096] text-center">
            No rules data available
          </div>
        )}
      </div>

      {/* Cold rules */}
      {coldRules.length > 0 && (
        <div className="bg-white rounded-lg border border-[#e2e8f0]">
          <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center gap-2">
            <svg className="w-4 h-4 text-[#f6ad55]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-base font-semibold text-[#1a202c]">Cold Rules (0 Matches)</h2>
            <span className="ml-auto text-xs text-[#f6ad55] font-medium">
              {coldRules.length} rules
            </span>
          </div>
          <div className="divide-y divide-[#e2e8f0]">
            {coldRules.map((rule) => (
              <Link
                key={rule.rule_id}
                href={`/rules/${rule.rule_id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-[#f7fafc] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-[#4a5568]">{rule.rule_id}</span>
                  <span className="text-sm text-[#1a202c]">{rule.title}</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  0 matches
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
