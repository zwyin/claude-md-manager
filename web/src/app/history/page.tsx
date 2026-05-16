'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => { setSnapshots(json.snapshots || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (error) return <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Version History</h1>
        <p className="text-sm text-muted-foreground mt-1">Rule metadata grouped by update date and source file</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {snapshots.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source File</TableHead>
                  <TableHead className="text-right">Rules</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        {s.snapshot_ts}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{s.source_file}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{s.rule_count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">No history snapshots available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
