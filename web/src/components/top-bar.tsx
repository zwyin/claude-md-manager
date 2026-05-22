'use client';

import { Globe, Minus, Plus } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useFontScale } from '@/components/font-scale-provider';

export function TopBar() {
  const { lang, setLang, t } = useI18n();
  const { increase, decrease, canIncrease, canDecrease, label } = useFontScale();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
      <SidebarTrigger />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={decrease}
          disabled={!canDecrease}
          className="h-6 w-6"
          aria-label="Zoom out"
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="text-[11px] font-mono text-muted-foreground w-8 text-center select-none">{label}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={increase}
          disabled={!canIncrease}
          className="h-6 w-6"
          aria-label="Zoom in"
        >
          <Plus className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="flex items-center gap-1.5 text-xs ml-2"
        >
          <Globe className="w-3.5 h-3.5" />
          {lang === 'zh' ? t('lang.en') : t('lang.zh')}
        </Button>
      </div>
    </div>
  );
}
