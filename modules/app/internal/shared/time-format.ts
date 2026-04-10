/** Contract: contracts/app/rules.md */

/**
 * Format a date (ISO string or Date) as a human-readable relative/absolute string.
 * - Within 1 minute: "just now" / "N seconds ago"
 * - Same calendar day: "Today at 3:42 PM"
 * - Previous calendar day: "Yesterday at 11:20 AM"
 * - Within 7 days: "Monday at 9:15 AM"
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

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  if (d >= todayStart) return `Today at ${timeStr}`;
  if (d >= yesterdayStart) return `Yesterday at ${timeStr}`;
  if (d >= weekStart) {
    const dayName = d.toLocaleDateString([], { weekday: 'long' });
    return `${dayName} at ${timeStr}`;
  }

  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
