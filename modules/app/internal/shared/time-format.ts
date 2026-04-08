/** Contract: contracts/app/rules.md */
import { t } from '../i18n/index.ts';

/**
 * Format a date (ISO string or Date) as a localized relative time string.
 * Uses the shared `time.*` i18n keys.
 */
export function formatRelativeTime(date: string | Date): string {
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const diff = Date.now() - then;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 5) return t('time.justNow');
  if (seconds < 60) return t('time.secondsAgo', { n: seconds });

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1
      ? t('time.minuteAgo')
      : t('time.minutesAgo', { n: minutes });
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1
      ? t('time.hourAgo')
      : t('time.hoursAgo', { n: hours });
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1
      ? t('time.dayAgo')
      : t('time.daysAgo', { n: days });
  }

  const months = Math.floor(days / 30);
  return months === 1
    ? t('time.monthAgo')
    : t('time.monthsAgo', { n: months });
}
