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
