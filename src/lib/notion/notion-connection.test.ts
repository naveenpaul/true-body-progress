import { checkDatabaseLayout, parseDatabaseId } from './notion-connection';

const ID = '3b80e9869759807db23fc45d73f829c9';

describe('parseDatabaseId', () => {
  it('reads the id from a shared database link, ignoring the view', () => {
    expect(parseDatabaseId(`https://www.notion.so/myspace/Daily-Meals-${ID}?v=1f2e3d4c5b6a79881f2e3d4c5b6a7988&pvs=4`)).toBe(ID);
  });

  it('accepts a bare id with or without dashes', () => {
    expect(parseDatabaseId(` ${ID.toUpperCase()} `)).toBe(ID);
    expect(parseDatabaseId('3b80e986-9759-807d-b23f-c45d73f829c9')).toBe(ID);
  });

  it('rejects text without an id', () => {
    expect(parseDatabaseId('https://www.notion.so/myspace')).toBeNull();
    expect(parseDatabaseId('')).toBeNull();
  });
});

describe('checkDatabaseLayout', () => {
  const title = [{ plain_text: 'Daily Meals' }];

  it('accepts a table with a Date column and some meal columns', () => {
    const result = checkDatabaseLayout({
      title,
      properties: { Date: { type: 'date' }, BF: { type: 'rich_text' }, Lunch: { type: 'rich_text' }, Dinner: { type: 'rich_text' }, Calories: { type: 'number' } },
    });
    expect(result).toEqual({ ok: true, title: 'Daily Meals', mealColumns: ['BF', 'Lunch', 'Dinner'], missingColumns: ['Pre-BF', 'Pre Dinner'] });
  });

  it('needs a date column named Date', () => {
    const result = checkDatabaseLayout({ title, properties: { Date: { type: 'rich_text' }, BF: { type: 'rich_text' } } });
    expect(result.ok).toBe(false);
  });

  it('needs at least one meal text column', () => {
    const result = checkDatabaseLayout({ title, properties: { Date: { type: 'date' }, BF: { type: 'number' } } });
    expect(result).toMatchObject({ ok: false });
  });
});
