'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TermTooltipProps {
  term: string;
  explanation: string;
}

export function TermTooltip({ term, explanation }: TermTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center gap-0.5 cursor-help border-b border-dashed border-[var(--meta)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm">
        {term}
        <HelpCircle className="w-3 h-3 text-[var(--meta)]" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-sm">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}
