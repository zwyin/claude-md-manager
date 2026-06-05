"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { RuleFile } from "./types";
import { useI18n } from "@/i18n";
import { SECTION_COLORS } from "@/lib/chart-colors";

interface RuleListPanelProps {
  rules: RuleFile[];
  selectedId: string | null;
  onSelect: (ruleId: string) => void;
  onReorder: (items: Array<{ rule_id: string; order: number }>) => void;
}

const SortableCard = memo(function SortableCard({ rule, isSelected, onSelect, color }: { rule: RuleFile; isSelected: boolean; onSelect: () => void; color: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: rule.rule_id });
  const { t } = useI18n();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeft: `3px solid ${color}` }}
      {...attributes}
      {...listeners}
      aria-pressed={isSelected}
      aria-label={rule.title}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={`px-3 py-2 cursor-pointer border-b border-[var(--border)] last:border-b-0 transition-colors ${
        isSelected
          ? "bg-[var(--accent-soft)]"
          : rule.has_draft
          ? "bg-[var(--accent-soft)] hover:bg-[color-mix(in_oklch,var(--accent)_20%,transparent)]"
          : "hover:bg-[var(--fg-soft)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--meta)] w-6">{rule.order}</span>
        <span className="text-sm font-medium truncate flex-1 text-[var(--fg)]">{rule.title}</span>
        {rule.has_draft && (
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" title={t('editor.draft')} />
        )}
      </div>
      <div className="mt-1 pl-6 flex items-center gap-1.5">
        <span className="tag text-[10px]">{rule.section_id}</span>
        <span className="text-[10px] text-[var(--meta)] truncate">{rule.source_file}</span>
      </div>
    </div>
  );
});

export function RuleListPanel({ rules, selectedId, onSelect, onReorder }: RuleListPanelProps) {
  const { t } = useI18n();
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const sections = useMemo(() => {
    const seen = new Map<string, { sectionId: string; count: number }>();
    for (const r of rules) {
      if (!seen.has(r.source_file)) seen.set(r.source_file, { sectionId: r.section_id, count: 0 });
      seen.get(r.source_file)!.count++;
    }
    return Array.from(seen.entries());
  }, [rules]);

  const sectionColorIdx = useMemo(() => {
    const map = new Map<string, number>();
    sections.forEach(([file], i) => map.set(file, i));
    return map;
  }, [sections]);

  const filteredRules = sectionFilter === 'all'
    ? rules
    : rules.filter((r) => r.source_file === sectionFilter);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rules.findIndex((r) => r.rule_id === active.id);
    const newIndex = rules.findIndex((r) => r.rule_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...rules];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((r, i) => ({
      rule_id: r.rule_id,
      order: i * 10,
    }));
    onReorder(updates);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const idx = filteredRules.findIndex((r) => r.rule_id === selectedId);
      if (e.key === 'ArrowDown' || (e.key === 'j' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const next = idx < filteredRules.length - 1 ? idx + 1 : 0;
        onSelect(filteredRules[next].rule_id);
      } else if (e.key === 'ArrowUp' || (e.key === 'k' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const prev = idx > 0 ? idx - 1 : filteredRules.length - 1;
        onSelect(filteredRules[prev].rule_id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredRules, selectedId, onSelect]);

  return (
    <div className="p-2">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[var(--meta)] font-mono text-xs uppercase tracking-wider">
          {t('editor.rules')} ({filteredRules.length})
        </span>
        {sections.length > 1 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="text-[10px] rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="all">{t('rules.allSections')}</option>
            {sections.map(([file, { count }]) => (
              <option key={file} value={file}>{file} ({count})</option>
            ))}
          </select>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredRules.map((r) => r.rule_id)} strategy={verticalListSortingStrategy}>
          {filteredRules.map((rule) => (
            <SortableCard
              key={rule.rule_id}
              rule={rule}
              isSelected={selectedId === rule.rule_id}
              onSelect={() => onSelect(rule.rule_id)}
              color={SECTION_COLORS[(sectionColorIdx.get(rule.source_file) ?? 0) % SECTION_COLORS.length]}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
