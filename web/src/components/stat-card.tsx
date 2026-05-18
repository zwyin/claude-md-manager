'use client';

import { memo, useEffect, useRef, useState, useId, type ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { PRIMARY } from '@/lib/chart-colors';

interface StatCardProps {
  label: ReactNode;
  value: string | number;
  sublabel?: string;
  trend?: Array<{ date: string; count: number }>;
  color?: string;
  percentage?: boolean;
}

function StatCardInner({ label, value, sublabel, trend, color = PRIMARY, percentage }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = typeof value === 'string' ? parseInt(value, 10) || 0 : value;
  const rafRef = useRef<number>(0);
  const gradientId = useId();

  useEffect(() => {
    if (Number.isNaN(targetValue)) return;
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(targetValue * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetValue]);

  const formattedValue = percentage
    ? `${displayValue}%`
    : displayValue.toLocaleString();

  return (
    <Card className="rounded-xl border-border bg-card overflow-hidden">
      <CardContent className="p-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="text-3xl font-bold text-foreground" style={percentage ? { color } : undefined}>
          {formattedValue}
        </div>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
        )}
        {trend && trend.length > 1 && (
          <div className="mt-3 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={color}
                  fill={`url(#${gradientId})`}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const StatCard = memo(StatCardInner);
