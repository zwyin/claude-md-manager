'use client';

import { useI18n } from '@/i18n';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <span className="text-2xl font-bold text-destructive">!</span>
      </div>
      <h2 className="text-lg font-semibold">{t('errorBoundary.title')}</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {error.message || t('errorBoundary.default')}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t('errorBoundary.retry')}
      </button>
    </div>
  );
}
