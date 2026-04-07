import { formatDuration, formatRelativeDate, today } from './dates';

describe('dates', () => {
  // Regression: today() previously used toISOString() which is UTC. Users in
  // negative UTC offsets near midnight saw entries logged on tomorrow's date.
  describe('today()', () => {
    it('returns YYYY-MM-DD in local time, not UTC', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(today()).toBe(expected);
    });

    it('matches local date components even when UTC date differs', () => {
      // Pin to a moment where local and UTC are guaranteed to differ for at least
      // one timezone: late evening local time. We can't change the runtime TZ
      // mid-test, but we can assert today() never derives from toISOString().
      const result = today();
      const utcDate = new Date().toISOString().split('T')[0];
      const localDate = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      // Result must equal the local-derived value, never disagree with it.
      expect(result).toBe(localDate);
      // If UTC happens to differ (negative offset evenings, positive offset
      // mornings), today() must follow local, not UTC.
      if (utcDate !== localDate) {
        expect(result).not.toBe(utcDate);
      }
    });
  });

  describe('formatRelativeDate()', () => {
    it('returns "Today" for today\'s local date string', () => {
      expect(formatRelativeDate(today())).toBe('Today');
    });

    it('returns "Yesterday" for yesterday\'s local date string', () => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const ymd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      expect(formatRelativeDate(ymd)).toBe('Yesterday');
    });

    // Regression: previously parsed YYYY-MM-DD via `new Date(str)` which is UTC.
    // For users in negative UTC offsets, "today" was misclassified as "Yesterday".
    it('parses YYYY-MM-DD as local time, not UTC midnight', () => {
      const todayStr = today();
      // The string must round-trip: today() in, "Today" out. If parsed as UTC,
      // a user in (e.g.) UTC-5 would get "Yesterday" because UTC midnight of
      // today-string is still yesterday in local time.
      expect(formatRelativeDate(todayStr)).toBe('Today');
    });
  });

  describe('formatDuration()', () => {
    it('returns mm:ss for sub-hour durations', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(45)).toBe('00:45');
      expect(formatDuration(90)).toBe('01:30');
      expect(formatDuration(3599)).toBe('59:59');
    });

    it('returns h:mm:ss past one hour', () => {
      expect(formatDuration(3600)).toBe('1:00:00');
      expect(formatDuration(3661)).toBe('1:01:01');
    });

    it('clamps negative input to 0', () => {
      expect(formatDuration(-5)).toBe('00:00');
    });
  });
});
