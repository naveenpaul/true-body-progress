import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// In-memory cache for synchronous access (mirrors what MMKV provided)
const cache = new Map<string, string>();
let hydrated = false;

export async function hydrateStorage() {
  if (hydrated) return;
  const keys = await AsyncStorage.getAllKeys();
  const entries = await AsyncStorage.multiGet(keys);
  for (const [key, value] of entries) {
    if (key && value !== null) {
      cache.set(key, value);
    }
  }
  hydrated = true;
}

// Synchronous storage API (reads from cache, writes to both cache + AsyncStorage)
export const storage = {
  getString(key: string): string | undefined {
    return cache.get(key) ?? undefined;
  },
  set(key: string, value: string) {
    cache.set(key, value);
    AsyncStorage.setItem(key, value);
  },
  getBoolean(key: string): boolean | undefined {
    const v = cache.get(key);
    if (v === undefined) return undefined;
    return v === 'true';
  },
  setBoolean(key: string, value: boolean) {
    cache.set(key, value ? 'true' : 'false');
    AsyncStorage.setItem(key, value ? 'true' : 'false');
  },
  remove(key: string) {
    cache.delete(key);
    AsyncStorage.removeItem(key);
  },
};

export function getItem<T>(key: string): T | null {
  const value = storage.getString(key);
  return value ? JSON.parse(value) || null : null;
}

export async function setItem<T>(key: string, value: T) {
  storage.set(key, JSON.stringify(value));
}

export async function removeItem(key: string) {
  storage.remove(key);
}

// Reactive hooks (replacements for useMMKVString / useMMKVBoolean)
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}

export function useStorageString(
  key: string,
): [string | undefined, (val: string) => void] {
  const [value, setValue] = useState(() => storage.getString(key));

  useEffect(() => {
    return subscribe(key, () => setValue(storage.getString(key)));
  }, [key]);

  const set = useCallback(
    (val: string) => {
      storage.set(key, val);
      notify(key);
    },
    [key],
  );

  return [value, set];
}

export function useStorageBoolean(
  key: string,
): [boolean | undefined, (val: boolean) => void] {
  const [value, setValue] = useState(() => storage.getBoolean(key));

  useEffect(() => {
    return subscribe(key, () => setValue(storage.getBoolean(key)));
  }, [key]);

  const set = useCallback(
    (val: boolean) => {
      storage.setBoolean(key, val);
      notify(key);
    },
    [key],
  );

  return [value, set];
}
