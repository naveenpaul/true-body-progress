// The user's own Notion connection (integration token + meals database id),
// entered in Settings and kept in the device's secure store. Nothing about
// Notion ships in the app build, so each install syncs only its owner's diary.

import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { MEAL_COLUMNS, NOTION_API, NOTION_VERSION } from './notion-client';

export type NotionConnection = { token: string; databaseId: string; title?: string };

const STORE_KEY = 'notion_connection';

let current: NotionConnection | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(fn => fn());
}

// Called once at startup so getNotionConnection() can stay synchronous.
export async function loadNotionConnection(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    current = raw ? (JSON.parse(raw) as NotionConnection) : null;
  }
  catch (err) {
    console.warn('[notion] could not read saved connection', err);
    current = null;
  }
  emit();
}

export function getNotionConnection(): NotionConnection | null {
  return current;
}

export async function saveNotionConnection(connection: NotionConnection): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(connection));
  current = connection;
  emit();
}

export async function clearNotionConnection(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
  current = null;
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useNotionConnection(): NotionConnection | null {
  return useSyncExternalStore(subscribe, getNotionConnection);
}

const HEX_ID_RE = /[0-9a-f]{32}/i;
const DASHED_ID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const QUERY_RE = /[?#].*$/;

// Accepts a database link ("https://www.notion.so/ws/Daily-Meals-3b80…?v=…")
// or a bare id, with or without dashes. The ?v= view id is ignored.
export function parseDatabaseId(input: string): string | null {
  const path = input.trim().replace(QUERY_RE, '');
  const dashed = path.match(DASHED_ID_RE);
  if (dashed)
    return dashed[0].replaceAll('-', '').toLowerCase();
  const hex = path.match(HEX_ID_RE);
  return hex ? hex[0].toLowerCase() : null;
}

type DatabaseInfo = { title?: Array<{ plain_text: string }>; properties: Record<string, { type: string }> };

export type CheckResult
  = | { ok: true; title: string; mealColumns: string[]; missingColumns: string[] }
    | { ok: false; message: string };

// Whether the database layout can be synced: it needs a Date column plus
// at least one of the meal text columns.
export function checkDatabaseLayout(info: DatabaseInfo): CheckResult {
  const props = info.properties ?? {};
  const title = (info.title ?? []).map(t => t.plain_text).join('') || 'Untitled';
  if (props.Date?.type !== 'date')
    return { ok: false, message: `"${title}" needs a date column named "Date".` };
  const mealColumns = MEAL_COLUMNS.filter(c => props[c]?.type === 'rich_text');
  if (mealColumns.length === 0)
    return { ok: false, message: `"${title}" has no text columns named ${MEAL_COLUMNS.map(c => `"${c}"`).join(', ')}.` };
  return { ok: true, title, mealColumns, missingColumns: MEAL_COLUMNS.filter(c => !mealColumns.includes(c)) };
}

// Reads the database once to confirm the token works and the layout fits.
export async function verifyNotionConnection(connection: NotionConnection): Promise<CheckResult> {
  let response: Response;
  try {
    response = await fetch(`${NOTION_API}/databases/${connection.databaseId}`, {
      headers: {
        'Authorization': `Bearer ${connection.token}`,
        'Notion-Version': NOTION_VERSION,
      },
    });
  }
  catch {
    return { ok: false, message: 'Could not reach Notion. Check your internet connection.' };
  }
  if (response.status === 401)
    return { ok: false, message: 'Notion rejected the token. Copy the secret again from notion.so/my-integrations.' };
  if (response.status === 404 || response.status === 403)
    return { ok: false, message: 'Database not found. Open it in Notion, then ••• → Connections → add your integration.' };
  if (response.status === 400)
    return { ok: false, message: 'That link is not a database. Open the meals table itself and copy its link.' };
  if (!response.ok)
    return { ok: false, message: `Notion error ${response.status}. Try again in a moment.` };
  return checkDatabaseLayout(await response.json() as DatabaseInfo);
}
