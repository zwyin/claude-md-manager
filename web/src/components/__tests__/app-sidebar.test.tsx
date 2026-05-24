// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { AppSidebar } from '../app-sidebar';

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'app.title': 'CLAUDE.md Manager',
        'app.subtitle': 'Manage your rules',
        'app.version': 'v1.0',
        'nav.dashboard': 'Dashboard',
        'nav.rules': 'Rules',
        'nav.editor': 'Editor',
        'nav.history': 'History',
        'nav.sessions': 'Sessions',
        'nav.analytics': 'Analytics',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/hooks/use-fetch', () => ({
  useFetch: () => ({ data: null, loading: false }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <nav data-testid="sidebar">{children}</nav>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-header">{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-content">{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-footer">{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-menu">{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

describe('AppSidebar', () => {
  afterEach(() => {
    cleanup();
    mockPathname = '/';
  });

  it('renders app title', () => {
    render(<AppSidebar />);
    expect(screen.getByText('CLAUDE.md Manager')).toBeTruthy();
  });

  it('renders navigation items', () => {
    render(<AppSidebar />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Rules')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
  });

  it('renders version in footer', () => {
    render(<AppSidebar />);
    expect(screen.getByText('v1.0')).toBeTruthy();
  });

  it('renders GitHub link', () => {
    render(<AppSidebar />);
    const link = document.querySelector('a[href="https://github.com/zwyin/claude-md-manager"]');
    expect(link).toBeTruthy();
  });
});
