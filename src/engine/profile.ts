import type { AppEvent, OccasionId, RunsTemp } from './types';

/**
 * Everything the app has learned about you. It is never stored: it is
 * rebuilt from the event history each time, so undoing an action (deleting
 * its event) undoes what was learned from it.
 */
export interface Profile {
  /** Extra warmth points you like, from "too cold / too warm" feedback */
  thermalBias: number;
  /** Per occasion: how much dressier (+) or more casual (−) you dress than the default */
  formalityOffset: Partial<Record<OccasionId, number>>;
  itemAffinity: Map<string, number>;
  pairAffinity: Map<string, number>;
  /** item id → last date worn (YYYY-MM-DD) */
  lastWorn: Map<string, string>;
  /** outfit signature → last date worn */
  outfitLastWorn: Map<string, string>;
}

const HALF_LIFE_DAYS = 60;

export function signature(itemIds: string[]): string {
  return [...itemIds].sort().join('+');
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildProfile(events: AppEvent[], runs: RunsTemp, now: Date): Profile {
  const p: Profile = {
    thermalBias: runs === 'cold' ? 1 : runs === 'warm' ? -1 : 0,
    formalityOffset: {},
    itemAffinity: new Map(),
    pairAffinity: new Map(),
    lastWorn: new Map(),
    outfitLastWorn: new Map(),
  };

  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of sorted) {
    const ageDays = (now.getTime() - new Date(e.at).getTime()) / 86_400_000;
    const w = 0.5 ** (Math.max(0, ageDays) / HALF_LIFE_DAYS);
    const items = (d: number) => e.itemIds.forEach((id) => add(p.itemAffinity, id, d * w));
    const pairs = (d: number) => {
      for (let i = 0; i < e.itemIds.length; i++)
        for (let j = i + 1; j < e.itemIds.length; j++)
          add(p.pairAffinity, pairKey(e.itemIds[i], e.itemIds[j]), d * w);
    };

    switch (e.type) {
      case 'wore': {
        items(1);
        pairs(1);
        const date = e.date ?? e.at.slice(0, 10);
        for (const id of e.itemIds) if ((p.lastWorn.get(id) ?? '') < date) p.lastWorn.set(id, date);
        const sig = signature(e.itemIds);
        if ((p.outfitLastWorn.get(sig) ?? '') < date) p.outfitLastWorn.set(sig, date);
        break;
      }
      case 'like':
        items(0.5);
        pairs(0.5);
        break;
      case 'dislike': {
        const reasons = e.reasons ?? [];
        if (reasons.includes('tooCold')) p.thermalBias += 0.25;
        if (reasons.includes('tooWarm')) p.thermalBias -= 0.25;
        if (e.occasion && reasons.includes('tooDressy')) shiftFormality(p, e.occasion, -0.5);
        if (e.occasion && reasons.includes('tooCasual')) shiftFormality(p, e.occasion, 0.5);
        if (reasons.includes('notTogether')) pairs(-1);
        if (reasons.includes('other')) items(-0.5);
        if (reasons.length === 0) {
          items(-0.3);
          pairs(-0.3);
        }
        break;
      }
      case 'swap':
        if (e.from) add(p.itemAffinity, e.from, -0.5 * w);
        if (e.to) add(p.itemAffinity, e.to, 0.3 * w);
        break;
      case 'comfort':
        if (e.comfort === 'cold') p.thermalBias += 0.5;
        if (e.comfort === 'warm') p.thermalBias -= 0.5;
        break;
    }
    p.thermalBias = clamp(p.thermalBias, -3, 3);
  }
  return p;
}

function shiftFormality(p: Profile, occasion: OccasionId, d: number) {
  p.formalityOffset[occasion] = clamp((p.formalityOffset[occasion] ?? 0) + d, -1.5, 1.5);
}

function add(m: Map<string, number>, k: string, d: number) {
  m.set(k, (m.get(k) ?? 0) + d);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
