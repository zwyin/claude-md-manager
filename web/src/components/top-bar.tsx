'use client';

import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function TopBar() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
      <SidebarTrigger />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        className="flex items-center gap-1.5 text-xs"
      >
        <Globe className="w-3.5 h-3.5" />
        {lang === 'zh' ? t('lang.en') : t('lang.zh')}
      </Button>
    </div>
  );
}
