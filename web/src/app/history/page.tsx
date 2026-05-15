'use client';

import { useEffect, useState } from 'react';

interface SnapshotEntry {
  snapshot_ts: string;
  rule_count: number;
  source_file: string;
}

export default function HistoryPage() {
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/history')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setSnapshots(json.snapshots || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const formatDate = (ts: string): string => {
    try {
      const date = new Date(ts + 'T00:00:00');
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return ts;
    }
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
        Failed to load history: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a202c]">Version History</h1>
        <p className="text-sm text-[#718096] mt-1">
          Rule metadata snapshots grouped by update date and source file
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        {snapshots.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[#718096] uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-5 py-3 font-medium">Source File</th>
                <th className="text-right px-5 py-3 font-medium">Rules</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s, i) => (
                <tr
                  key={i}
                  className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f7fafc] transition-colors"
                >
                  <td className="px-5 py-3 text-sm text-[#1a202c]">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#4299e1]" />
                      {formatDate(s.snapshot_ts)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-[#4a5568]">
                    {s.source_file}
                  </td>
                  <td className="px-5 py-3 text-sm text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#edf2f7] text-[#4a5568]">
                      {s.rule_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-8 text-sm text-[#718096] text-center">
            No history snapshots available
          </div>
        )}
      </div>
    </div>
  );
}
