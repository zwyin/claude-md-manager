'use client';

import { t } from '@/i18n';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = (typeof window !== 'undefined' && localStorage.getItem('lang')) || 'zh';
  const htmlLang = lang === 'en' ? 'en-US' : 'zh-CN';

  return (
    <html lang={htmlLang}>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', backgroundColor: '#f5f4ed', color: '#141413', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('errorBoundary.title')}</h2>
          <p style={{ fontSize: '0.875rem', color: '#5e5d59', marginBottom: '1.5rem', textAlign: 'center' }}>
            {error.message || t('errorBoundary.default')}
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', backgroundColor: '#c96442', color: '#faf9f5', border: 'none', cursor: 'pointer' }}
          >
            {t('errorBoundary.retry')}
          </button>
        </div>
      </body>
    </html>
  );
}
