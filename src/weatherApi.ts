import { db } from './db';
import type { HourlyForecast } from './engine/weather';

const FIELDS = [
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'snowfall',
  'wind_gusts_10m',
  'uv_index',
].join(',');

const FRESH_FOR_MS = 60 * 60 * 1000;

export interface Forecast {
  hourly: HourlyForecast;
  fetchedAt: number;
  /** True when the network failed and this is the last saved forecast */
  stale?: boolean;
}

/** Open-Meteo forecast, saved on the phone for an hour and reused when offline. */
export async function getForecast(lat: number, lon: number, force = false): Promise<Forecast | null> {
  const key = `forecast:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = (await db.kv.get(key))?.value as Forecast | undefined;
  if (cached && !force && Date.now() - cached.fetchedAt < FRESH_FOR_MS) return cached;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=${FIELDS}&timezone=auto&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
    const json = await res.json();
    const forecast: Forecast = { hourly: json.hourly, fetchedAt: Date.now() };
    await db.kv.put({ key, value: forecast });
    return forecast;
  } catch {
    return cached ? { ...cached, stale: true } : null;
  }
}

export interface Place {
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed');
  const json = await res.json();
  return (json.results ?? []).map(
    (r: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
      name: r.name,
      detail: [r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude,
    }),
  );
}
