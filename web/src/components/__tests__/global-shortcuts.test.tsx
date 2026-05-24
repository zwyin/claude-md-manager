// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { GlobalShortcuts } from '../global-shortcuts';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

let mockPathname = '/';

describe('GlobalShortcuts', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/';
  });

  afterEach(() => {
    cleanup();
  });

  it('navigates to /rules on Cmd+K from dashboard', () => {
    render(React.createElement(GlobalShortcuts));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(mockPush).toHaveBeenCalledWith('/rules');
  });

  it('navigates to /rules on Ctrl+K', () => {
    render(React.createElement(GlobalShortcuts));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    expect(mockPush).toHaveBeenCalledWith('/rules');
  });

  it('skips Cmd+K on /rules page', () => {
    mockPathname = '/rules';
    render(React.createElement(GlobalShortcuts));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('skips Cmd+K on /sessions page', () => {
    mockPathname = '/sessions';
    render(React.createElement(GlobalShortcuts));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('skips when focus is in input element', () => {
    render(React.createElement(GlobalShortcuts));
    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    window.dispatchEvent(event);
    expect(mockPush).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('skips when focus is in textarea element', () => {
    render(React.createElement(GlobalShortcuts));
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea, writable: false });
    window.dispatchEvent(event);
    expect(mockPush).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('removes listener on unmount', () => {
    const { unmount } = render(React.createElement(GlobalShortcuts));
    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
