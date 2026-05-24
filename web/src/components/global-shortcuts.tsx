'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const CMD_K_PAGES = ['/rules', '/sessions'];

export function GlobalShortcuts() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (CMD_K_PAGES.some((p) => pathname.startsWith(p))) return;
        e.preventDefault();
        router.push('/rules');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pathname, router]);

  return null;
}
