'use client';

import { t } from '@/i18n';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('errorBoundary.title')}</h2>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem', textAlign: 'center' }}>
            {error.message || t('errorBoundary.default')}
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '0.5rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            {t('errorBoundary.retry')}
          </button>
        </div>
      </body>
    </html>
  );
}
