import { SECTION_COLORS, STAT_COLORS } from '@/lib/chart-colors';
import { PRIMARY } from '@/lib/chart-colors';

const TRACK_COLOR = '#e8e6dc'; // var(--surface-warm)
const LINE_COLOR = '#87867f'; // var(--meta)

export function MiniSparkline({ session, matches }: { session: number; matches: number }) {
  const max = Math.max(session, matches, 1);
  const h1 = 16 - (session / max) * 12;
  const h2 = 16 - (matches / max) * 12;
  return (
    <svg width="48" height="16" viewBox="0 0 48 16" className="shrink-0" role="img" aria-label={`${matches} matches in ${session} sessions`}>
      <line x1="12" y1={h1} x2="36" y2={h2} stroke={PRIMARY} strokeWidth="1.5" />
      <polygon points={`0,16 12,${h1} 36,${h2} 48,16`} fill={PRIMARY} fillOpacity="0.12" />
      <circle cx="12" cy={h1} r="2" fill={PRIMARY} />
      <circle cx="36" cy={h2} r="2" fill={PRIMARY} />
    </svg>
  );
}

export function MiniCoverageBar({ value }: { value: number }) {
  const w = Math.round(value * 28);
  return (
    <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0" role="img" aria-label={`${(value * 100).toFixed(0)}% coverage`}>
      <rect x="2" y="5" width="28" height="6" rx="3" fill={TRACK_COLOR} />
      <rect x="2" y="5" width={Math.max(w, 2)} height="6" rx="3" fill={SECTION_COLORS[4]} fillOpacity="0.8" />
    </svg>
  );
}

export function MiniDepthBar({ value, max }: { value: number; max: number }) {
  const h = Math.round((value / Math.max(max, 1)) * 10);
  return (
    <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0" role="img" aria-label={`depth ${value.toFixed(1)}`}>
      <rect x="2" y="2" width="4" height="12" rx="2" fill={TRACK_COLOR} />
      <rect x="2" y={14 - Math.max(h, 2)} width="4" height={Math.max(h, 2)} rx="2" fill={STAT_COLORS.avgDepth} fillOpacity="0.8" />
      <line x1="12" y1="8" x2="28" y2="8" stroke={LINE_COLOR} strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="20" cy={14 - h} r="2.5" fill={STAT_COLORS.avgDepth} />
    </svg>
  );
}

export function InlineMetricBar({ value, color }: { value: number; color: string }) {
  const w = Math.round(value * 28);
  return (
    <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0" role="img" aria-label={`${(value * 100).toFixed(1)}%`}>
      <rect x="2" y="5" width="28" height="6" rx="3" fill={TRACK_COLOR} />
      <rect x="2" y="5" width={Math.max(w, 2)} height="6" rx="3" fill={color} fillOpacity="0.8" />
    </svg>
  );
}

export function DetailMetricBar({ value, color, max = 1 }: { value: number; color: string; max?: number }) {
  const pct = Math.min(value / max, 1);
  const w = Math.round(pct * 80);
  return (
    <svg width="88" height="8" viewBox="0 0 88 8" className="shrink-0 mt-2" role="img" aria-label={`${(pct * 100).toFixed(0)}%`}>
      <rect x="0" y="0" width="80" height="8" rx="4" fill={TRACK_COLOR} />
      <rect x="0" y="0" width={Math.max(w, 3)} height="8" rx="4" fill={color} fillOpacity="0.85" />
      <circle cx={Math.max(w, 3)} cy="4" r="3" fill={color} />
    </svg>
  );
}

export function DepthGauge({ value, max }: { value: number; max: number }) {
  const h = Math.round((value / Math.max(max, 1)) * 28);
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" className="shrink-0 mt-2" role="img" aria-label={`depth ${value.toFixed(1)}`}>
      <rect x="10" y="2" width="8" height="28" rx="4" fill={TRACK_COLOR} />
      <rect x="10" y={30 - Math.max(h, 3)} width="8" height={Math.max(h, 3)} rx="4" fill={STAT_COLORS.avgDepth} fillOpacity="0.8" />
      <line x1="4" y1="30" x2="24" y2="30" stroke={LINE_COLOR} strokeWidth="1" />
      <circle cx="14" cy={30 - Math.max(h, 2)} r="3" fill={STAT_COLORS.avgDepth} />
    </svg>
  );
}
