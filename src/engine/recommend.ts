import { harmony } from './colors';
import { clamp, pairKey, signature, type Profile } from './profile';
import { kindInfo, occasionInfo } from './taxonomy';
import { PART_ORDER, type DayWeather, type Item, type OccasionId, type Outfit, type Part } from './types';
import { requiredWarmth } from './weather';

export interface Context {
  day: DayWeather;
  occasion: OccasionId;
  profile: Profile;
  /** Date the outfit is for, YYYY-MM-DD */
  date: string;
  fmtTemp: (celsius: number) => string;
}

export interface Suggestion {
  outfit: Outfit;
  signature: string;
  score: number;
  reasons: string[];
}

export interface Recommendation {
  suggestions: Suggestion[];
  /** 0 = every rule met; higher = rules were loosened because the closet had no exact match */
  level: number;
  /** What the closet needs before anything can be suggested */
  missing: string[];
}

interface Targets {
  formality: [number, number];
  /** Warmth points needed at the coldest / warmest point of the day */
  cold: number;
  warm: number;
}

interface Rules {
  warmthTol: number;
  rainShoes: boolean;
  tempRules: boolean;
  formalitySlack: number;
}

/** Strict first; each later level loosens rules for closets with no exact match. */
const LEVELS: Rules[] = [
  { warmthTol: 1, rainShoes: true, tempRules: true, formalitySlack: 0 },
  { warmthTol: 2, rainShoes: false, tempRules: true, formalitySlack: 0 },
  { warmthTol: 3, rainShoes: false, tempRules: true, formalitySlack: 1 },
  { warmthTol: Infinity, rainShoes: false, tempRules: false, formalitySlack: 5 },
];

const WEIGHTS = { weather: 0.3, occasion: 0.2, style: 0.15, cohesion: 0.1, preference: 0.15, freshness: 0.1 };
const MAX_COMBOS = 40_000;

export function recommend(
  items: Item[],
  ctx: Context,
  opts: { count?: number; exclude?: Set<string>; seed?: number } = {},
): Recommendation {
  const count = opts.count ?? 3;
  const clean = items.filter((i) => i.status === 'clean');
  const missing = missingBasics(clean);
  if (missing.length) return { suggestions: [], level: 0, missing };

  const t = targets(ctx);
  const rand = mulberry32(opts.seed ?? hash(ctx.date + ctx.occasion));

  let combos: Outfit[] = [];
  let level = 0;
  for (; level < LEVELS.length; level++) {
    combos = generate(clean, ctx, t, LEVELS[level], rand);
    if (combos.length >= count) break;
    if (level === LEVELS.length - 1) break;
  }
  level = Math.min(level, LEVELS.length - 1);

  const scored = combos
    .map((o) => ({ outfit: o, signature: sig(o), score: score(o, ctx, t) + rand() * 0.04 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 400);

  const exclude = opts.exclude ?? new Set<string>();
  const fresh = scored.filter((s) => !exclude.has(s.signature));
  const picked = pickDiverse(fresh, count);
  if (picked.length < count) {
    picked.push(...pickDiverse(scored.filter((s) => !picked.includes(s)), count - picked.length));
  }

  return {
    level,
    missing: [],
    suggestions: picked.map((s) => finish(s.outfit, s.score, clean, ctx, t)),
  };
}

/** Other items that could take this part's place, best first. "Without it" is offered for layers. */
export function alternatives(items: Item[], current: Outfit, part: Part, ctx: Context): Suggestion[] {
  const t = targets(ctx);
  const rules = LEVELS[1];
  const clean = items.filter((i) => i.status === 'clean');
  const currentId = current.parts[part]?.id;
  const options: (Item | undefined)[] = clean.filter((i) => kindInfo(i.kind).slot === part && i.id !== currentId);
  if (part === 'outer' || (part === 'mid' && (current.parts.top || current.parts.onePiece))) options.push(undefined);

  const results: Suggestion[] = [];
  for (const item of options) {
    if (item && !itemOk(item, ctx, t, rules)) continue;
    const parts = { ...current.parts };
    if (item) parts[part] = item;
    else delete parts[part];
    const outfit: Outfit = { parts, accessories: [] };
    if (!validShape(outfit) || !warmthOk(outfit, t, rules)) continue;
    results.push(finish(outfit, score(outfit, ctx, t), clean, ctx, t));
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 12);
}

export function partsList(o: Outfit): Item[] {
  return PART_ORDER.map((p) => o.parts[p]).filter((i): i is Item => !!i);
}

export function sig(o: Outfit): string {
  return signature(partsList(o).map((i) => i.id));
}

function missingBasics(clean: Item[]): string[] {
  const slots = new Set(clean.map((i) => kindInfo(i.kind).slot));
  const torso = slots.has('top') || clean.some((i) => kindInfo(i.kind).wornAlone);
  const missing: string[] = [];
  if (!slots.has('onePiece')) {
    if (!torso) missing.push('a top');
    if (!slots.has('bottom')) missing.push('a bottom');
  }
  if (!slots.has('shoes')) missing.push('shoes');
  return missing;
}

function targets(ctx: Context): Targets {
  const occ = occasionInfo(ctx.occasion);
  const off = ctx.profile.formalityOffset[ctx.occasion] ?? 0;
  const adj = ctx.profile.thermalBias - (occ.active ? 1.5 : 0);
  return {
    formality: [occ.formality[0] + off, occ.formality[1] + off],
    cold: requiredWarmth(ctx.day.feelsMin) + adj,
    warm: requiredWarmth(ctx.day.feelsMax) + adj,
  };
}

function itemOk(item: Item, ctx: Context, t: Targets, r: Rules): boolean {
  if (item.status !== 'clean') return false;
  const [lo, hi] = t.formality;
  if (item.formalityMax < lo - r.formalitySlack - 1e-9 || item.formalityMin > hi + r.formalitySlack + 1e-9) return false;

  const k = kindInfo(item.kind);
  const { day, profile } = ctx;
  if (r.tempRules) {
    // Someone who runs cold treats the day as a few degrees colder.
    const shift = profile.thermalBias * 3;
    if (k.minFeels !== undefined && day.feelsMax - shift < k.minFeels) return false;
    if (k.maxFeels !== undefined && day.feelsMin - shift > k.maxFeels) return false;
    const dry = !day.rainy && !day.snowy;
    if (dry && k.dryMaxFeels !== undefined && day.feelsMin - shift > k.dryMaxFeels) return false;
  }
  if (r.rainShoes && k.slot === 'shoes') {
    if ((day.rainy || day.snowy) && item.avoidRain) return false;
    if (day.snowy && !k.snowOk && !item.waterproof) return false;
  }
  return true;
}

function validShape(o: Outfit): boolean {
  const p = o.parts;
  if (!p.shoes) return false;
  if (p.onePiece) return !p.top && !p.bottom;
  if (!p.bottom) return false;
  if (p.top) return true;
  return !!p.mid && !!kindInfo(p.mid.kind).wornAlone;
}

function warmth(o: Outfit): { full: number; layersOff: number } {
  const p = o.parts;
  const full = partsList(o).reduce((s, i) => s + i.warmth, 0);
  const removable = (p.outer?.warmth ?? 0) + (p.mid && (p.top || p.onePiece) ? p.mid.warmth : 0);
  return { full, layersOff: full - removable };
}

/** Warm enough for the coldest hour, not too much for it, and cool enough once layers come off. */
function warmthOk(o: Outfit, t: Targets, r: Rules): boolean {
  const w = warmth(o);
  return w.full >= t.cold - r.warmthTol && w.full <= t.cold + 2 * r.warmthTol && w.layersOff <= t.warm + 1.5 * r.warmthTol;
}

function generate(clean: Item[], ctx: Context, t: Targets, r: Rules, rand: () => number): Outfit[] {
  const pool = (slot: string) => clean.filter((i) => kindInfo(i.kind).slot === slot && itemOk(i, ctx, t, r));
  let tops = pool('top');
  let mids = pool('mid');
  let bottoms = pool('bottom');
  let onePieces = pool('onePiece');
  let outers = pool('outer');
  let shoes = pool('shoes');

  const estimate = () =>
    ((tops.length * (mids.length + 1) + mids.length) * bottoms.length + onePieces.length * (mids.length + 1)) *
    (outers.length + 1) *
    shoes.length;

  // Big closets: keep the most promising items per slot so the search stays fast on a phone.
  for (let n = 14; estimate() > MAX_COMBOS && n >= 3; n--) {
    const top = (xs: Item[]) =>
      xs
        .map((i) => ({ i, s: itemPrior(i, ctx, t) + rand() * 0.05 }))
        .sort((a, b) => b.s - a.s)
        .slice(0, n)
        .map((x) => x.i);
    [tops, mids, bottoms, onePieces, outers, shoes] = [tops, mids, bottoms, onePieces, outers, shoes].map(top);
  }

  const bodies: Outfit['parts'][] = [];
  for (const b of bottoms) {
    for (const tp of tops) {
      bodies.push({ top: tp, bottom: b });
      for (const m of mids) bodies.push({ top: tp, mid: m, bottom: b });
    }
    for (const m of mids) if (kindInfo(m.kind).wornAlone) bodies.push({ mid: m, bottom: b });
  }
  for (const op of onePieces) {
    bodies.push({ onePiece: op });
    for (const m of mids) bodies.push({ onePiece: op, mid: m });
  }

  const out: Outfit[] = [];
  for (const body of bodies) {
    for (const outer of [undefined, ...outers]) {
      for (const s of shoes) {
        const o: Outfit = { parts: { ...body, shoes: s }, accessories: [] };
        if (outer) o.parts.outer = outer;
        if (warmthOk(o, t, r)) out.push(o);
      }
    }
  }
  return out;
}

function affinityScore(a: number): number {
  return 0.5 + 0.5 * Math.tanh(a / 3);
}

function freshness(item: Item, ctx: Context): number {
  const last = ctx.profile.lastWorn.get(item.id);
  if (!last) return 1;
  return clamp(daysBetween(last, ctx.date) / 7, 0, 1);
}

function itemPrior(i: Item, ctx: Context, t: Targets): number {
  const mid = (i.formalityMin + i.formalityMax) / 2;
  const occMid = (t.formality[0] + t.formality[1]) / 2;
  return (
    0.5 * affinityScore(ctx.profile.itemAffinity.get(i.id) ?? 0) +
    0.3 * freshness(i, ctx) +
    0.2 * clamp(1 - Math.abs(mid - occMid) / 2.5, 0, 1)
  );
}

function score(o: Outfit, ctx: Context, t: Targets): number {
  const items = partsList(o);
  const { day, profile } = ctx;

  // Small misses inside the dead zones don't count, so extra layers aren't added for a rounding error.
  const w = warmth(o);
  const under = Math.max(0, t.cold - w.full - 0.3);
  const over = Math.max(0, w.full - t.cold - 0.7);
  const hotLater = Math.max(0, w.layersOff - t.warm - 0.3);
  let weather = 1 - under * 0.3 - over * 0.25 - hotLater * 0.3;
  const rain = day.rainy || day.snowy;
  if (rain) {
    if (!o.parts.outer?.waterproof) weather -= 0.15;
    if (o.parts.shoes?.avoidRain) weather -= 0.3;
  }
  const outer = o.parts.outer;
  if (outer && !(rain && outer.waterproof) && w.full - outer.warmth >= t.cold - 0.3) {
    // Warm enough without it; a blazer at a dressy occasion is there for looks, not warmth.
    const styleLayer = outer.formalityMin >= 3 && t.formality[1] >= 3;
    if (!styleLayer) weather -= 0.1;
  }
  weather = clamp(weather, 0, 1);

  const center = items.reduce((s, i) => s + (i.formalityMin + i.formalityMax) / 2, 0) / items.length;
  const occMid = (t.formality[0] + t.formality[1]) / 2;
  const occasion = clamp(1 - Math.abs(center - occMid) / 2.5, 0, 1);

  const style = harmony(items.filter((i) => kindInfo(i.kind).slot !== 'shoes')) * 0.8 + harmony(items) * 0.2;

  // Pieces should share at least one dress level: sneakers with dress trousers don't.
  const gap = Math.max(0, Math.max(...items.map((i) => i.formalityMin)) - Math.min(...items.map((i) => i.formalityMax)));
  const cohesion = clamp(1 - gap * 0.4, 0, 1);

  const itemPref = items.reduce((s, i) => s + affinityScore(profile.itemAffinity.get(i.id) ?? 0), 0) / items.length;
  let pairSum = 0;
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++) pairSum += profile.pairAffinity.get(pairKey(items[a].id, items[b].id)) ?? 0;
  const preference = 0.7 * itemPref + 0.3 * affinityScore(pairSum);

  let fresh = items.reduce((s, i) => s + freshness(i, ctx), 0) / items.length;
  const lastOutfit = profile.outfitLastWorn.get(sig(o));
  if (lastOutfit && daysBetween(lastOutfit, ctx.date) < 14) fresh *= 0.6;

  return (
    WEIGHTS.weather * weather +
    WEIGHTS.occasion * occasion +
    WEIGHTS.style * style +
    WEIGHTS.cohesion * cohesion +
    WEIGHTS.preference * preference +
    WEIGHTS.freshness * fresh
  );
}

/** Max-marginal-relevance pick: good outfits that don't repeat each other. */
function pickDiverse<T extends { outfit: Outfit; score: number }>(scored: T[], count: number): T[] {
  const picked: T[] = [];
  const ids = new Map(scored.map((s) => [s, new Set(partsList(s.outfit).map((i) => i.id))]));
  while (picked.length < count && picked.length < scored.length) {
    let best: T | undefined;
    let bestVal = -Infinity;
    for (const s of scored) {
      if (picked.includes(s)) continue;
      const a = ids.get(s)!;
      let maxSim = 0;
      for (const p of picked) {
        const b = ids.get(p)!;
        const inter = [...a].filter((x) => b.has(x)).length;
        maxSim = Math.max(maxSim, inter / (a.size + b.size - inter));
      }
      const val = 0.7 * s.score - 0.3 * maxSim;
      if (val > bestVal) {
        bestVal = val;
        best = s;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  return picked;
}

function finish(outfit: Outfit, sc: number, clean: Item[], ctx: Context, t: Targets): Suggestion {
  const withAcc: Outfit = { parts: outfit.parts, accessories: accessoriesFor(outfit, clean, ctx, t) };
  return { outfit: withAcc, signature: sig(outfit), score: sc, reasons: explain(withAcc, ctx) };
}

function accessoriesFor(o: Outfit, clean: Item[], ctx: Context, t: Targets): Item[] {
  const { day, profile } = ctx;
  const pool = clean.filter((i) => {
    if (kindInfo(i.kind).slot !== 'accessory') return false;
    return i.formalityMax >= t.formality[0] - 1 && i.formalityMin <= t.formality[1] + 1;
  });
  const best = (kind: string) =>
    pool
      .filter((i) => i.kind === kind)
      .sort((a, b) => (profile.itemAffinity.get(b.id) ?? 0) - (profile.itemAffinity.get(a.id) ?? 0))[0];

  const kinds: string[] = [];
  if ((day.rainy || day.snowy) && !o.parts.outer?.waterproof) kinds.push('umbrella');
  if (t.cold >= requiredWarmth(5)) kinds.push('scarf', 'beanie', 'gloves');
  if (day.sunny && day.feelsMax >= 16) kinds.push('sunglasses');
  if (day.sunny && day.feelsMax >= 20) kinds.push(best('cap') ? 'cap' : 'sunhat');

  return kinds.map(best).filter((i): i is Item => !!i);
}

function explain(o: Outfit, ctx: Context): string[] {
  const { day, fmtTemp } = ctx;
  const p = o.parts;
  const lower = (i: Item) => i.name.toLowerCase();
  const lines: string[] = [];

  const removable = p.outer ?? (p.top || p.onePiece ? p.mid : undefined);
  const lo = fmtTemp(day.feelsMin);
  const hi = fmtTemp(day.feelsMax);
  if (day.feelsMax - day.feelsMin >= 6 && removable) {
    lines.push(`Feels like ${lo} at first and ${hi} later. Take off the ${lower(removable)} when it warms up.`);
  } else if (day.feelsMin < 8 && p.outer) {
    lines.push(`Feels like ${lo}. The ${lower(p.outer)} keeps you warm.`);
  } else if (day.feelsMax >= 25) {
    lines.push(`Feels like up to ${hi}, so this stays light.`);
  } else {
    lines.push(lo === hi ? `Feels like ${lo}.` : `Feels like ${lo} to ${hi}.`);
  }

  const umbrella = o.accessories.find((i) => i.kind === 'umbrella');
  const shoes = p.shoes;
  if (day.snowy) {
    const ready = shoes && (kindInfo(shoes.kind).snowOk || shoes.waterproof);
    lines.push(ready ? `Snow on the way. The ${lower(shoes)} can handle it.` : 'Snow on the way, and these shoes aren’t made for it.');
  } else if (day.rainy) {
    if (p.outer?.waterproof) lines.push(`${day.rainChance}% chance of rain. The ${lower(p.outer)} is waterproof.`);
    else if (umbrella) lines.push(`${day.rainChance}% chance of rain. Take the umbrella.`);
    else lines.push(`${day.rainChance}% chance of rain, and nothing here is waterproof.`);
  } else if (day.rainChance >= 30) {
    lines.push(`Might rain (${day.rainChance}%).`);
  }
  return lines;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
