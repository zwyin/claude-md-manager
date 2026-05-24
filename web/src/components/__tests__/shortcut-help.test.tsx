// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, act } from '@testing-library/react';
import { ShortcutHelp } from '../shortcut-help';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'shortcut.title': 'Keyboard Shortcuts',
        'shortcut.search': 'Search',
        'shortcut.save': 'Save',
        'shortcut.preview': 'Preview',
        'shortcut.navigate': 'Navigate',
        'shortcut.open': 'Open',
        'shortcut.help': 'Help',
        'shortcut.close': 'Close',
        'shortcut.dismiss': 'Press Esc to close',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('ShortcutHelp', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render overlay initially', () => {
    render(<ShortcutHelp />);
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
  });

  it('opens on ? key press', () => {
    render(<ShortcutHelp />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
  });

  it('closes on Escape key press', () => {
    render(<ShortcutHelp />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
  });

  it('closes on overlay click', () => {
    const { container } = render(<ShortcutHelp />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
    const overlay = container.querySelector('.fixed.inset-0')!;
    act(() => overlay.click());
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
  });

  it('does not open when focus is in input', () => {
    render(<ShortcutHelp />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    act(() => window.dispatchEvent(event));
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
    document.body.removeChild(input);
  });

  it('does not open on ? with modifier keys', () => {
    render(<ShortcutHelp />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', metaKey: true, bubbles: true }));
    });
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
  });

  it('renders shortcut keys', () => {
    render(<ShortcutHelp />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
    expect(screen.getByText('⌘K')).toBeTruthy();
    expect(screen.getByText('Esc')).toBeTruthy();
  });

  it('removes listener on unmount', () => {
    const { unmount } = render(<ShortcutHelp />);
    unmount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
  });
});
