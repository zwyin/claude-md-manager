import { useEffect } from 'react';
import { useI18n } from '@/i18n';
import type { Dict } from '@/i18n/zh';

export function usePageTitle(titleKey: keyof Dict) {
  const { t } = useI18n();
  useEffect(() => {
    document.title = `${t(titleKey)} | CLAUDE.md Manager`;
  }, [titleKey, t]);
}
