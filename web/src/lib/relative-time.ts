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

export function formatDuration(sec: number): string | null {
  if (sec <= 0) return null;
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m${remSec > 0 ? `${remSec}s` : ''}`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h${remMin > 0 ? `${remMin}m` : ''}`;
}
