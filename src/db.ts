import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { AppEvent, Item, OccasionId, RunsTemp } from './engine/types';

export interface Settings {
  units: 'C' | 'F';
  runs: RunsTemp;
  /** The hours you're usually out, used to read the forecast */
  fromHour: number;
  toHour: number;
  /** Usual plans by weekday, index 0 = Sunday */
  weekday: OccasionId[];
  location?: { name: string; lat: number; lon: number };
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'C',
  runs: 'normal',
  fromHour: 8,
  toHour: 20,
  weekday: ['casual', 'work', 'work', 'work', 'work', 'work', 'casual'],
};

class OutfitDB extends Dexie {
  items!: Table<Item, string>;
  events!: Table<AppEvent, string>;
  kv!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('daily-outfit');
    this.version(1).stores({
      items: 'id, kind, status',
      events: 'id, type, at',
      kv: 'key',
    });
  }
}

export const db = new OutfitDB();

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.kv.put({ key: 'settings', value: { ...(await getSettings()), ...patch } });
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings);
}

export function useItems(): Item[] | undefined {
  return useLiveQuery(() => db.items.orderBy('kind').toArray());
}

export function useEvents(): AppEvent[] | undefined {
  return useLiveQuery(() => db.events.toArray());
}

export async function logEvent(e: Omit<AppEvent, 'id' | 'at'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.events.add({ ...e, id, at: new Date().toISOString() });
  return id;
}

export async function exportBackup(): Promise<Blob> {
  const data = {
    app: 'daily-outfit',
    version: 1,
    exportedAt: new Date().toISOString(),
    items: await db.items.toArray(),
    events: await db.events.toArray(),
    settings: await getSettings(),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function importBackup(file: File): Promise<{ items: number }> {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'daily-outfit' || !Array.isArray(data.items) || !Array.isArray(data.events)) {
    throw new Error('This file isn’t a Daily Outfit backup.');
  }
  await db.transaction('rw', db.items, db.events, db.kv, async () => {
    await db.items.clear();
    await db.events.clear();
    await db.items.bulkAdd(data.items);
    await db.events.bulkAdd(data.events);
    await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...data.settings } });
  });
  return { items: data.items.length };
}
