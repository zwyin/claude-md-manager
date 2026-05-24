// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { TopBar } from '../top-bar';

const mockSetLang = vi.fn();
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    lang: mockLang,
    setLang: mockSetLang,
    t: (key: string) => {
      const map: Record<string, string> = {
        'accessibility.zoomOut': 'Zoom out',
        'accessibility.zoomIn': 'Zoom in',
        'lang.en': 'EN',
        'lang.zh': '中文',
      };
      return map[key] ?? key;
    },
  }),
}));

let mockLang = 'zh';

const mockIncrease = vi.fn();
const mockDecrease = vi.fn();
vi.mock('@/components/font-scale-provider', () => ({
  useFontScale: () => ({
    increase: mockIncrease,
    decrease: mockDecrease,
    canIncrease: true,
    canDecrease: true,
    label: '100%',
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button disabled={disabled} onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <div data-testid="sidebar-trigger" />,
}));

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
    mockSetLang.mockClear();
    mockIncrease.mockClear();
    mockDecrease.mockClear();
    mockLang = 'zh';
  });

  it('renders font scale label', () => {
    render(<TopBar />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('calls decrease on zoom out button', () => {
    render(<TopBar />);
    screen.getByLabelText('Zoom out').click();
    expect(mockDecrease).toHaveBeenCalled();
  });

  it('calls increase on zoom in button', () => {
    render(<TopBar />);
    screen.getByLabelText('Zoom in').click();
    expect(mockIncrease).toHaveBeenCalled();
  });

  it('toggles language on button click', () => {
    mockLang = 'zh';
    render(<TopBar />);
    screen.getByText('EN').click();
    expect(mockSetLang).toHaveBeenCalledWith('en');
  });

  it('renders sidebar trigger', () => {
    render(<TopBar />);
    expect(screen.getByTestId('sidebar-trigger')).toBeTruthy();
  });
});
