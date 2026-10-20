import { parseMealRow } from './notion-client';

function text(s: string) {
  return { type: 'rich_text', rich_text: s ? [{ plain_text: s }] : [] };
}

describe('parseMealRow', () => {
  it('reads the date and non-empty meal columns, ignoring the rest', () => {
    const row = parseMealRow({
      id: 'page-1',
      properties: {
        'Date': { type: 'date', date: { start: '2026-10-19' } },
        'Pre-BF': text('1 cup tea, '),
        'BF': text('2 chapathis,\n 100gms   dal'),
        'Lunch': text(''),
        'Calories': { type: 'number' },
      },
    });
    expect(row).toEqual({
      pageId: 'page-1',
      date: '2026-10-19',
      meals: { 'Pre-BF': '1 cup tea', 'BF': '2 chapathis, 100gms dal' },
    });
  });

  it('keeps only the day from a date-time', () => {
    const row = parseMealRow({ id: 'p', properties: { Date: { type: 'date', date: { start: '2026-10-19T08:00:00.000+05:30' } } } });
    expect(row?.date).toBe('2026-10-19');
  });

  it('skips rows without a date', () => {
    expect(parseMealRow({ id: 'p', properties: { Date: { type: 'date', date: null }, BF: text('idli') } })).toBeNull();
  });
});
