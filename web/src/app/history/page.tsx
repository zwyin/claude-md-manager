'use client';

import { useEffect, useState } from 'react';

interface BuildSnapshot {
  timestamp: string;
  file_size: number;
  rule_count: number;
  created_at: string;
}

interface HistoryData {
  snapshots: BuildSnapshot[];
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/history')
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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (ts: string): string => {
    try {
      const date = new Date(ts);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
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

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a202c]">Version History</h1>
        <p className="text-sm text-[#718096] mt-1">
          Build snapshots and change history
        </p>
      </div>

      {/* Snapshots list */}
      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        {data.snapshots && data.snapshots.length > 0 ? (
          <div className="divide-y divide-[#e2e8f0]">
            {data.snapshots.map((snapshot, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-4 hover:bg-[#f7fafc] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-[#4299e1] border-2 border-white ring-2 ring-[#bee3f8]" />
                    {i < data.snapshots.length - 1 && (
                      <div className="w-0.5 h-8 bg-[#e2e8f0] mt-1" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#1a202c]">
                      {formatTimestamp(snapshot.timestamp || snapshot.created_at)}
                    </div>
                    <div className="text-xs text-[#718096] mt-0.5">
                      {snapshot.rule_count != null ? `${snapshot.rule_count} rules` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#edf2f7] text-[#4a5568]">
                    {formatFileSize(snapshot.file_size)}
                  </span>
                  <button className="text-xs text-[#4299e1] hover:underline">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-sm text-[#718096] text-center">
            No build snapshots available
          </div>
        )}
      </div>
    </div>
  );
}
