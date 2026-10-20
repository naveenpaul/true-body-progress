// Read-only client for the "Daily Meals" Notion database. Each row is a day
// (Date property) with one free-text column per meal slot.

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Meal columns in eating order. Other columns (Calories, Protein, Name…) are ignored.
export const MEAL_COLUMNS = ['Pre-BF', 'BF', 'Lunch', 'Pre Dinner', 'Dinner'] as const;
export type MealColumn = (typeof MEAL_COLUMNS)[number];

export type NotionMealRow = {
  pageId: string;
  date: string; // YYYY-MM-DD
  meals: Partial<Record<MealColumn, string>>; // only non-empty cells
};

type RichText = { plain_text: string };
type NotionPage = {
  id: string;
  properties: Record<string, { type: string; date?: { start: string } | null; rich_text?: RichText[] }>;
};

const WHITESPACE_RE = /\s+/g;
const TRAILING_COMMA_RE = /,$/;

// Rows without a date are skipped: there is no day to log them against.
export function parseMealRow(page: NotionPage): NotionMealRow | null {
  const start = page.properties.Date?.date?.start;
  if (!start)
    return null;
  const meals: NotionMealRow['meals'] = {};
  for (const col of MEAL_COLUMNS) {
    const text = (page.properties[col]?.rich_text ?? [])
      .map(t => t.plain_text)
      .join('')
      .replace(WHITESPACE_RE, ' ')
      .trim()
      .replace(TRAILING_COMMA_RE, '');
    if (text.length > 0)
      meals[col] = text;
  }
  return { pageId: page.id, date: start.slice(0, 10), meals };
}

// All rows dated on or after `sinceDate`, following Notion's pagination.
export async function fetchMealRows(token: string, databaseId: string, sinceDate: string): Promise<NotionMealRow[]> {
  const rows: NotionMealRow[] = [];
  let cursor: string | undefined;
  do {
    const response = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        filter: { property: 'Date', date: { on_or_after: sinceDate } },
        sorts: [{ property: 'Date', direction: 'ascending' }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Notion ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = await response.json() as { results: NotionPage[]; has_more: boolean; next_cursor: string | null };
    for (const page of data.results) {
      const row = parseMealRow(page);
      if (row)
        rows.push(row);
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}
