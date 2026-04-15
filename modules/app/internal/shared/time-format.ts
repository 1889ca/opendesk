/** Contract: contracts/app/rules.md */

/**
 * Format a date (ISO string or Date) as a human-readable relative string.
 * - Within 1 minute: "just now" / "N seconds ago"
 * - Within 1 hour: "N minutes ago"
 * - Within 24 hours: "N hours ago"
 * - Same calendar day: "Today at 3:42 PM"
 * - Yesterday: "Yesterday"
 * - Within 7 days: "2 days ago", "3 days ago", etc.
 * - Older: "Apr 7" (current year) or "Apr 7, 2024"
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 2) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 2) return '1 hour ago';

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  if (d >= todayStart) return hours < 12 ? `${hours} hours ago` : `Today at ${timeStr}`;
  if (d >= yesterdayStart) return 'Yesterday';

  const days = Math.floor(diff / 86400000);
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';

  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
