import type { DayWeather } from './types';

/** Hourly forecast in the shape Open-Meteo returns it (timezone=auto, metric units). */
export interface HourlyForecast {
  time: string[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  precipitation: number[];
  snowfall: number[];
  wind_gusts_10m: number[];
  uv_index: number[];
}

/**
 * Sums up the weather for the hours you'll be out in the outfit,
 * not the whole day: a cold morning matters even if the afternoon is warm.
 */
export function summarizeDay(
  f: HourlyForecast,
  date: string,
  fromHour: number,
  toHour: number,
): DayWeather | null {
  const idx: number[] = [];
  f.time.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const hour = Number(t.slice(11, 13));
    if (hour >= fromHour && hour <= toHour) idx.push(i);
  });
  if (idx.length === 0) return null;

  const pick = (arr: number[]) => idx.map((i) => arr[i] ?? 0);
  const feels = pick(f.apparent_temperature);
  const rainChances = pick(f.precipitation_probability);
  const rainMm = sum(pick(f.precipitation));
  const snowCm = sum(pick(f.snowfall));
  const gustMax = Math.max(...pick(f.wind_gusts_10m));
  const uvMax = Math.max(...pick(f.uv_index));
  const rainChance = Math.max(...rainChances);
  const rainy = rainChance >= 50 || rainMm >= 1;

  return {
    date,
    fromHour,
    toHour,
    feelsMin: Math.min(...feels),
    feelsMax: Math.max(...feels),
    rainChance,
    rainMm,
    snowCm,
    gustMax,
    uvMax,
    rainy,
    snowy: snowCm >= 0.5,
    sunny: uvMax >= 5 && !rainy,
    hours: idx.map((i, n) => ({
      hour: Number(f.time[i].slice(11, 13)),
      feels: feels[n],
      rainChance: rainChances[n],
    })),
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/**
 * Warmth points an outfit needs at a given feels-like temperature (°C).
 * Starting values; your "too cold / too warm" feedback shifts them.
 * Rough guide: T-shirt + jeans + sneakers ≈ 2.2, add a sweater +2.5,
 * a wool coat +3.5.
 */
const CURVE: [number, number][] = [
  [30, 1.3],
  [25, 1.8],
  [20, 2.6],
  [15, 4.0],
  [10, 5.8],
  [5, 7.6],
  [0, 9.0],
  [-5, 10.3],
  [-15, 12],
];

export function requiredWarmth(feels: number): number {
  if (feels >= CURVE[0][0]) return CURVE[0][1];
  for (let i = 1; i < CURVE.length; i++) {
    const [t1, w1] = CURVE[i - 1];
    const [t2, w2] = CURVE[i];
    if (feels >= t2) return w2 + ((feels - t2) / (t1 - t2)) * (w1 - w2);
  }
  return CURVE[CURVE.length - 1][1];
}
