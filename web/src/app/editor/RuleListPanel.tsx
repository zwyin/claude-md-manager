"use client";

import { memo, useMemo, useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { RuleFile } from "./types";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

interface RuleListPanelProps {
  rules: RuleFile[];
  selectedId: string | null;
  onSelect: (ruleId: string) => void;
  onReorder: (items: Array<{ rule_id: string; order: number }>) => void;
}

const SortableCard = memo(function SortableCard({ rule, isSelected, onSelect }: { rule: RuleFile; isSelected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: rule.rule_id });
  const { t } = useI18n();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-pressed={isSelected}
      aria-label={rule.title}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={`px-3 py-2 cursor-pointer border-b border-border last:border-b-0 transition-colors border-l-2 ${
        isSelected
          ? "bg-primary/10 border-l-primary"
          : "border-l-transparent hover:bg-accent/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-6">{rule.order}</span>
        <span className="text-sm font-medium truncate flex-1">{rule.title}</span>
        {rule.has_draft && (
          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title={t('editor.draft')} />
        )}
      </div>
      <div className="mt-1 pl-6">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {rule.source_file}
        </Badge>
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
    const seen = new Map<string, string>();
    for (const r of rules) {
      if (!seen.has(r.source_file)) seen.set(r.source_file, r.section_id);
    }
    return Array.from(seen.entries());
  }, [rules]);

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

  return (
    <div className="p-2">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t('editor.rules')} ({filteredRules.length})
        </span>
        {sections.length > 1 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="text-[10px] rounded border border-border bg-card text-foreground px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">{t('rules.allSections')}</option>
            {sections.map(([file]) => (
              <option key={file} value={file}>{file}</option>
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
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
