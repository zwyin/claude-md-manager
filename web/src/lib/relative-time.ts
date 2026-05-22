const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

export function relativeTime(dateStr: string, locale: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  const rtf = new Intl.RelativeTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', { numeric: 'auto' });

  if (diffSec < MINUTE) return rtf.format(-diffSec, 'second');
  if (diffSec < HOUR) return rtf.format(-Math.floor(diffSec / MINUTE), 'minute');
  if (diffSec < DAY) return rtf.format(-Math.floor(diffSec / HOUR), 'hour');
  return rtf.format(-Math.floor(diffSec / DAY), 'day');
}
