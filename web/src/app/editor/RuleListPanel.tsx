"use client";

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { RuleFile } from "./types";
import { Badge } from "@/components/ui/badge";

interface RuleListPanelProps {
  rules: RuleFile[];
  selectedId: string | null;
  onSelect: (ruleId: string) => void;
  onReorder: (items: Array<{ rule_id: string; order: number }>) => void;
}

function SortableCard({ rule, isSelected, onSelect }: { rule: RuleFile; isSelected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: rule.rule_id });

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
      onClick={onSelect}
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
          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="Has draft" />
        )}
      </div>
      <div className="mt-1 pl-6">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {rule.source_file}
        </Badge>
      </div>
    </div>
  );
}

export function RuleListPanel({ rules, selectedId, onSelect, onReorder }: RuleListPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Rules ({rules.length})
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.rule_id)} strategy={verticalListSortingStrategy}>
          {rules.map((rule) => (
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
