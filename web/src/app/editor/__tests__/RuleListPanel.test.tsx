// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react';
import { RuleListPanel } from '../RuleListPanel';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'editor.rules': 'Rules',
        'editor.draft': 'Draft',
        'rules.allSections': 'All sections',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: {},
  PointerSensor: {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}));

const mockRules = [
  { rule_id: 'rule-a', title: 'Rule A', source_file: 'core.md', section_id: 'core', order: 0, has_draft: true },
  { rule_id: 'rule-b', title: 'Rule B', source_file: 'core.md', section_id: 'core', order: 10, has_draft: false },
  { rule_id: 'rule-c', title: 'Rule C', source_file: 'project.md', section_id: 'project', order: 20, has_draft: false },
];

describe('RuleListPanel', () => {
  afterEach(cleanup);

  it('renders rule count', () => {
    render(<RuleListPanel rules={mockRules} selectedId={null} onSelect={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByText(/Rules \(3\)/)).toBeTruthy();
  });

  it('renders rule titles', () => {
    render(<RuleListPanel rules={mockRules} selectedId={null} onSelect={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByText('Rule A')).toBeTruthy();
    expect(screen.getByText('Rule B')).toBeTruthy();
    expect(screen.getByText('Rule C')).toBeTruthy();
  });

  it('calls onSelect when rule clicked', () => {
    const onSelect = vi.fn();
    render(<RuleListPanel rules={mockRules} selectedId={null} onSelect={onSelect} onReorder={vi.fn()} />);
    screen.getByText('Rule A').click();
    expect(onSelect).toHaveBeenCalledWith('rule-a');
  });

  it('shows section filter when multiple sections exist', () => {
    render(<RuleListPanel rules={mockRules} selectedId={null} onSelect={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByDisplayValue('All sections')).toBeTruthy();
  });

  it('hides section filter for single section', () => {
    const singleSection = [mockRules[0]];
    render(<RuleListPanel rules={singleSection} selectedId={null} onSelect={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.queryByDisplayValue('All sections')).toBeNull();
  });

  it('filters rules by section', () => {
    render(<RuleListPanel rules={mockRules} selectedId={null} onSelect={vi.fn()} onReorder={vi.fn()} />);
    const select = screen.getByDisplayValue('All sections') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'project.md' } });
    expect(screen.getByText(/Rules \(1\)/)).toBeTruthy();
    expect(screen.queryByText('Rule A')).toBeNull();
  });

  it('navigates down on ArrowDown key', () => {
    const onSelect = vi.fn();
    render(<RuleListPanel rules={mockRules} selectedId="rule-a" onSelect={onSelect} onReorder={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith('rule-b');
  });

  it('navigates up on ArrowUp key', () => {
    const onSelect = vi.fn();
    render(<RuleListPanel rules={mockRules} selectedId="rule-b" onSelect={onSelect} onReorder={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith('rule-a');
  });

  it('wraps around on ArrowDown at end', () => {
    const onSelect = vi.fn();
    render(<RuleListPanel rules={mockRules} selectedId="rule-c" onSelect={onSelect} onReorder={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith('rule-a');
  });

  it('navigates with j/k vim keys', () => {
    const onSelect = vi.fn();
    render(<RuleListPanel rules={mockRules} selectedId="rule-a" onSelect={onSelect} onReorder={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith('rule-b');
  });

  it('removes listener on unmount', () => {
    const { unmount } = render(<RuleListPanel rules={mockRules} selectedId="rule-a" onSelect={vi.fn()} onReorder={vi.fn()} />);
    unmount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
  });
});
