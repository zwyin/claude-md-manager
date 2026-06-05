'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, PenLine, Clock, BarChart3, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useFetch } from '@/hooks/use-fetch';

interface EditorRulesData {
  rules: { rule_id: string; has_draft?: boolean }[];
}

interface SessionsSummaryData {
  total: number;
}

interface BuildStatusData {
  history: { status: string }[];
}

const navItems = [
  { href: '/', labelKey: 'nav.dashboard' as const, Icon: Home },
  { href: '/rules', labelKey: 'nav.rules' as const, Icon: ListChecks },
  { href: '/editor', labelKey: 'nav.editor' as const, Icon: PenLine },
  { href: '/history', labelKey: 'nav.history' as const, Icon: Clock },
  { href: '/sessions', labelKey: 'nav.sessions' as const, Icon: Users },
  { href: '/analytics', labelKey: 'nav.analytics' as const, Icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: editorData } = useFetch<EditorRulesData>('/api/editor/rules');
  const { data: sessionsData } = useFetch<SessionsSummaryData>('/api/sessions?days=1&limit=1');
  const { data: buildData } = useFetch<BuildStatusData>('/api/editor/publish-history');
  const draftCount = (editorData?.rules ?? []).filter((r) => r.has_draft).length;
  const todaySessions = sessionsData?.total ?? 0;
  const lastBuildOk = buildData?.history?.[0]?.status === 'success';

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-header">
        <h1 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{t('app.title')}</h1>
        <p className="text-[11px]" style={{ color: 'var(--border)' }}>{t('sidebar.subtitle')}</p>
      </div>

      <nav className="app-sidebar-nav">
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-sidebar-item ${active ? 'active' : ''}`}
            >
              <item.Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{t(item.labelKey)}</span>
              {item.href === '/editor' && draftCount > 0 && (
                <span className="pill" style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>{draftCount}</span>
              )}
              {item.href === '/sessions' && todaySessions > 0 && (
                <span className="pill" style={{ background: 'var(--surface-warm)', color: 'var(--meta)' }}>{todaySessions}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <div className="build-status">
          {buildData?.history?.length ? (
            <span className={`inline-block w-[6px] h-[6px] rounded-full ${lastBuildOk ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
          ) : null}
          <span>{t('sidebar.buildStatus')}: {lastBuildOk ? t('sidebar.ok') : t('sidebar.error')}</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://github.com/zwyin/claude-md-manager" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--border)' }} className="hover:opacity-80 transition-opacity">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
          </a>
          <span style={{ color: 'var(--border)' }}>{t('app.version')}</span>
        </div>
      </div>
    </aside>
  );
}
