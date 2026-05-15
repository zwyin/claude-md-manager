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

interface RulesData {
  rules: Rule[];
  total_rules: number;
}

export default function RulesPage() {
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/rules')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        // Expand all sections by default
        const sections = new Set<string>();
        (json.rules || []).forEach((r: Rule) => sections.add(r.section_id));
        setExpandedSections(sections);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

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
        Failed to load rules: {error}
      </div>
    );
  }

  if (!data) return null;

  // Group rules by section
  const grouped: Record<string, Rule[]> = {};
  for (const rule of data.rules || []) {
    if (!grouped[rule.section_id]) {
      grouped[rule.section_id] = [];
    }
    grouped[rule.section_id].push(rule);
  }

  const sectionOrder = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a202c]">Rules</h1>
        <p className="text-sm text-[#718096] mt-1">
          {data.total_rules} rules in total, grouped by section
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sectionOrder.map((sectionId) => {
          const rules = grouped[sectionId];
          const isExpanded = expandedSections.has(sectionId);
          const totalMatches = rules.reduce((s, r) => s + r.match_count, 0);

          return (
            <div key={sectionId} className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(sectionId)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#f7fafc] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-4 h-4 text-[#718096] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-[#1a202c]">
                    {sectionId}
                  </span>
                  <span className="text-xs text-[#718096]">
                    {rules.length} rules
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#718096]">
                    {totalMatches} total matches
                  </span>
                </div>
              </button>

              {/* Section rules */}
              {isExpanded && (
                <div className="border-t border-[#e2e8f0]">
                  {rules.map((rule) => (
                    <Link
                      key={rule.rule_id}
                      href={`/rules/${rule.rule_id}`}
                      className="flex items-center justify-between px-5 py-3 pl-12 border-b border-[#e2e8f0] last:border-0 hover:bg-[#f7fafc] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-[#4a5568] flex-shrink-0">
                          {rule.rule_id}
                        </span>
                        <span className="text-sm text-[#1a202c] truncate">
                          {rule.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {rule.session_count} sessions
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          rule.match_count === 0
                            ? 'bg-red-100 text-red-800'
                            : rule.match_count >= 10
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.match_count} matches
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
