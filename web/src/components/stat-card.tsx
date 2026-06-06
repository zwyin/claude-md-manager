'use client';

import { memo, useEffect, useRef, useState, useId, type ReactNode } from 'react';
import Link from 'next/link';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { PRIMARY } from '@/lib/chart-colors';

interface StatCardProps {
  label: ReactNode;
  value: string | number;
  sublabel?: string;
  trend?: Array<{ date: string; count: number }>;
  color?: string;
  percentage?: boolean;
  href?: string;
}

function StatCardInner({ label, value, sublabel, trend, color = PRIMARY, percentage, href }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
  const rafRef = useRef<number>(0);
  const gradientId = useId();
  const decimals = typeof value === 'string' && value.includes('.')
    ? Math.min(value.split('.')[1].length, 2)
    : 0;

  useEffect(() => {
    if (Number.isNaN(targetValue)) return;
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(+(targetValue * eased).toFixed(decimals));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetValue, decimals]);

  const formattedValue = percentage
    ? `${Math.round(displayValue)}%`
    : decimals > 0
      ? displayValue.toFixed(decimals)
      : displayValue.toLocaleString();

  const trendDirection = trend && trend.length >= 2
    ? trend[trend.length - 1].count - trend[trend.length - 2].count
    : 0;
  const trendColor = trendDirection > 0 ? 'var(--success)' : trendDirection < 0 ? 'var(--danger)' : 'var(--meta)';

  const inner = (
    <div
      className="p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        transition: href ? 'box-shadow var(--motion-base) var(--ease-standard)' : undefined,
      }}
    >
      <p
        className="mb-1"
        style={{
          color: 'var(--meta)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1,
        }}
      >
        {label}
      </p>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: 500,
          color: percentage ? color : 'var(--fg)',
          lineHeight: 'var(--leading-tight)',
        }}
      >
        {formattedValue}
      </div>
      {sublabel && (
        <p
          className="mt-1"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: trendDirection !== 0 ? trendColor : 'var(--meta)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {trendDirection > 0 && '↑ '}
          {trendDirection < 0 && '↓ '}
          {sublabel}
        </p>
      )}
      {trend && trend.length > 1 && (
        <div className="mt-3 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--accent)"
                fill={`url(#${gradientId})`}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block"
        style={{ cursor: 'pointer' }}
        onMouseEnter={(e) => {
          (e.currentTarget.firstElementChild as HTMLElement).style.boxShadow = 'var(--elev-raised)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.firstElementChild as HTMLElement).style.boxShadow = 'none';
        }}
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

export const StatCard = memo(StatCardInner);
