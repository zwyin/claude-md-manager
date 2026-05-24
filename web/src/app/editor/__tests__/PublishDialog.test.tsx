// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, act } from '@testing-library/react';
import { PublishDialog } from '../PublishDialog';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'editor.publishTitle': 'Publish Changes',
        'editor.publishDesc': 'The following rules will be published',
        'editor.cancel': 'Cancel',
        'editor.publish': 'Publish',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

const rules = [
  { rule_id: 'rule-1', title: 'Rule One', source_file: 'rule-1.md', has_draft: true },
  { rule_id: 'rule-2', title: 'Rule Two', source_file: 'rule-2.md', has_draft: false },
];

describe('PublishDialog', () => {
  afterEach(cleanup);

  it('renders dialog title', () => {
    render(<PublishDialog rules={rules} onPublish={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Publish Changes')).toBeTruthy();
  });

  it('lists only rules with drafts', () => {
    render(<PublishDialog rules={rules} onPublish={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Rule One')).toBeTruthy();
    expect(screen.queryByText('Rule Two')).toBeNull();
  });

  it('shows draft count in publish button', () => {
    render(<PublishDialog rules={rules} onPublish={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/Publish \(1\)/)).toBeTruthy();
  });

  it('calls onPublish when publish clicked', () => {
    const onPublish = vi.fn();
    render(<PublishDialog rules={rules} onPublish={onPublish} onCancel={vi.fn()} />);
    screen.getByText(/Publish \(1\)/).click();
    expect(onPublish).toHaveBeenCalled();
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    render(<PublishDialog rules={rules} onPublish={vi.fn()} onCancel={onCancel} />);
    screen.getByText('Cancel').click();
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(<PublishDialog rules={rules} onPublish={vi.fn()} onCancel={onCancel} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel on overlay click', () => {
    const onCancel = vi.fn();
    render(<PublishDialog rules={rules} onPublish={vi.fn()} onCancel={onCancel} />);
    const overlay = screen.getByRole('dialog');
    overlay.click();
    expect(onCancel).toHaveBeenCalled();
  });

  it('has aria-modal attribute', () => {
    render(<PublishDialog rules={rules} onPublish={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
  });
});
