'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n';

const pageLabelKeys: Record<string, string> = {
  '/': 'nav.dashboard',
  '/rules': 'nav.rules',
  '/editor': 'nav.editor',
  '/history': 'nav.history',
  '/sessions': 'nav.sessions',
  '/analytics': 'nav.analytics',
};

function getPageLabelKey(pathname: string): string {
  const match = Object.entries(pageLabelKeys).find(([path]) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  );
  return match ? match[1] : 'nav.dashboard';
}

export function TopBar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useI18n();
  const labelKey = getPageLabelKey(pathname);

  return (
    <header className="app-topbar">
      <nav className="breadcrumb">
        <Link href="/" className="hover:text-[var(--fg)] transition-colors">{t('nav.home')}</Link>
        <span className="sep">/</span>
        <span className="current">{t(labelKey as Parameters<typeof t>[0])}</span>
      </nav>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="flex items-center gap-1.5 text-xs h-7 px-2 text-[var(--meta)] hover:text-[var(--fg)] transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          {lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>
    </header>
  );
}
