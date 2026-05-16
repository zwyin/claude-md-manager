'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { useI18n } from '@/i18n';

interface SnapshotEntry {
  snapshot_ts: string;
  rule_count: number;
  source_file: string;
}

export default function HistoryPage() {
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/history')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setSnapshots(json.snapshots || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">{t('status.loading')}</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">{t('status.error', { error })}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('history.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('history.subtitle')}</p>
      </div>

      {snapshots.length > 0 ? (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-800" />
          <div className="space-y-4">
            {snapshots.map((s, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-5 top-4 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-950" />
                <Card className="rounded-xl border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 ml-4">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{s.snapshot_ts}</span>
                      <Badge variant="outline" className="text-xs font-mono text-muted-foreground">{s.source_file}</Badge>
                    </div>
                    <Badge variant="secondary">{s.rule_count} {t('table.rules')}</Badge>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('history.noSnapshots')}</p>
        </div>
      )}
    </div>
  );
}
