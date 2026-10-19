// Format a Date as YYYY-MM-DD in the user's local time zone.
function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return formatLocalYMD(new Date());
}

// Parse a YYYY-MM-DD string as a local-time Date (midnight in the local zone).
// Avoids `new Date('2026-04-07')` which is parsed as UTC.
function parseLocalYMD(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatRelativeDate(dateStr: string): string {
  const date = parseLocalYMD(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0)
    return 'Today';
  if (diffDays === 1)
    return 'Yesterday';
  if (diffDays > 0 && diffDays < 7)
    return `${diffDays}d ago`;
  if (diffDays >= 7 && diffDays < 30)
    return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export function formatDuration(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0)
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

export type DateRange = { from: string; to: string };

export type HistoryRangeKey = 'all' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months';

// Inclusive YYYY-MM-DD bounds for a history filter preset. Weeks start on Monday.
// Returns null for 'all' (no date filter).
export function getHistoryRange(key: HistoryRangeKey, now: Date = new Date()): DateRange | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const mondayOffset = (now.getDay() + 6) % 7;
  switch (key) {
    case 'all':
      return null;
    case 'this_week':
      return { from: formatLocalYMD(new Date(y, m, d - mondayOffset)), to: formatLocalYMD(now) };
    case 'last_week':
      return {
        from: formatLocalYMD(new Date(y, m, d - mondayOffset - 7)),
        to: formatLocalYMD(new Date(y, m, d - mondayOffset - 1)),
      };
    case 'this_month':
      return { from: formatLocalYMD(new Date(y, m, 1)), to: formatLocalYMD(now) };
    case 'last_month':
      return { from: formatLocalYMD(new Date(y, m - 1, 1)), to: formatLocalYMD(new Date(y, m, 0)) };
    case 'last_3_months':
      return { from: formatLocalYMD(new Date(y, m - 2, 1)), to: formatLocalYMD(now) };
  }
}

// "Mon, 6 Oct 2026" style label for history rows outside the relative window.
export function formatShortDate(dateStr: string): string {
  return parseLocalYMD(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
