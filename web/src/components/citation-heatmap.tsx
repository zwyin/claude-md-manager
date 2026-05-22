'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SECTION_COLORS } from '@/lib/chart-colors';
import type { HeatmapCell } from '@/lib/types';

// base-ui TooltipTrigger renders a <button>, so the Link inside it handles navigation

interface CitationHeatmapProps {
  data: HeatmapCell[];
  maxRules?: number;
}

export function CitationHeatmap({ data, maxRules = 30 }: CitationHeatmapProps) {
  const { rules, days, matrix, maxValue, sectionMap } = useMemo(() => {
    const ruleCounts: Record<string, number> = {};
    for (const c of data) {
      ruleCounts[c.rule_id] = (ruleCounts[c.rule_id] || 0) + c.count;
    }
    const topRules = Object.entries(ruleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxRules)
      .map(([id]) => id);

    const ruleMeta: Record<string, { title: string; section_id: string }> = {};
    const sectionMap: Record<string, number> = {};
    let sIdx = 0;
    for (const c of data) {
      if (!ruleMeta[c.rule_id]) {
        ruleMeta[c.rule_id] = { title: c.title, section_id: c.section_id };
      }
      if (!(c.section_id in sectionMap)) {
        sectionMap[c.section_id] = sIdx++;
      }
    }

    const daySet = new Set(data.map((c) => c.day));
    const days = [...daySet].sort();

    const lookup: Record<string, number> = {};
    for (const c of data) {
      if (topRules.includes(c.rule_id)) {
        lookup[`${c.rule_id}::${c.day}`] = c.count;
      }
    }
    const maxValue = Math.max(...Object.values(lookup), 1);

    return { rules: topRules, days, matrix: lookup, maxValue, sectionMap, ruleMeta };
  }, [data, maxRules]);

  if (data.length === 0 || days.length === 0) return null;

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted/30';
    const intensity = count / maxValue;
    if (intensity > 0.75) return 'bg-indigo-500';
    if (intensity > 0.5) return 'bg-indigo-500/70';
    if (intensity > 0.25) return 'bg-indigo-500/45';
    return 'bg-indigo-500/25';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-fit">
        {/* Header: day labels */}
        <div className="flex items-end gap-[2px] mb-1 pl-[180px]">
          {days.map((day) => (
            <div key={day} className="w-[28px] text-center">
              <span className="text-[9px] text-muted-foreground font-mono">{day.slice(5)}</span>
            </div>
          ))}
        </div>
        {/* Rows: one per rule */}
        {rules.map((ruleId, rIdx) => {
          const meta = { title: ruleId, section_id: '' };
          const rule = data.find((c) => c.rule_id === ruleId);
          const title = rule?.title ?? ruleId;
          const sectionId = rule?.section_id ?? '';
          const colorIdx = sectionMap[sectionId] ?? 0;
          const sectionColor = SECTION_COLORS[colorIdx % SECTION_COLORS.length];

          return (
            <div key={ruleId} className="flex items-center gap-[2px] mb-[2px] group">
              <div className="w-[180px] shrink-0 flex items-center gap-1.5 pr-2 truncate">
                <div className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: sectionColor }} />
                <Link href={`/rules/${ruleId}`} className="text-[11px] text-muted-foreground hover:text-foreground truncate transition-colors">
                  {title}
                </Link>
              </div>
              {days.map((day) => {
                const count = matrix[`${ruleId}::${day}`] ?? 0;
                return (
                  <Tooltip key={day}>
                    <TooltipTrigger className={`w-[28px] h-[20px] rounded-sm ${getColor(count)} transition-colors hover:ring-1 hover:ring-indigo-400/50`}>
                      <Link href={`/rules/${ruleId}`} className="block w-full h-full" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <span className="font-medium">{title}</span>
                      <br />
                      {day}: {count} citations
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
