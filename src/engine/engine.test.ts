import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildProfile } from './profile';
import { alternatives, partsList, recommend, type Context } from './recommend';
import { KINDS, kindInfo } from './taxonomy';
import type { AppEvent, DayWeather, Item, OccasionId } from './types';
import { requiredWarmth, summarizeDay, type HourlyForecast } from './weather';

let nextId = 0;
function item(kind: string, color = 'navy', extra: Partial<Item> = {}): Item {
  const k = kindInfo(kind);
  return {
    id: `${kind}-${color}-${nextId++}`,
    name: `${color} ${k.label}`,
    kind,
    color,
    pattern: 'plain',
    formalityMin: k.formality[0],
    formalityMax: k.formality[1],
    warmth: k.warmth,
    waterproof: !!k.waterproof,
    avoidRain: !!k.avoidRain,
    status: 'clean',
    createdAt: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

function day(feelsMin: number, feelsMax = feelsMin, extra: Partial<DayWeather> = {}): DayWeather {
  return {
    date: '2026-10-30',
    fromHour: 8,
    toHour: 20,
    feelsMin,
    feelsMax,
    rainChance: 0,
    rainMm: 0,
    snowCm: 0,
    gustMax: 10,
    uvMax: 2,
    rainy: false,
    snowy: false,
    sunny: false,
    hours: [],
    ...extra,
  };
}

const closet: Item[] = [
  item('tshirt', 'white'),
  item('tshirt', 'black'),
  item('shirt', 'lightblue'),
  item('sweater', 'grey'),
  item('hoodie', 'olive'),
  item('jeans', 'denim'),
  item('chinos', 'beige'),
  item('trousers', 'charcoal'),
  item('shorts', 'navy'),
  item('lightjacket', 'olive'),
  item('raincoat', 'navy'),
  item('woolcoat', 'navy'),
  item('puffer', 'black'),
  item('sneakers', 'white'),
  item('canvas', 'white'),
  item('boots', 'brown'),
  item('dressshoes', 'black'),
  item('umbrella', 'black'),
  item('scarf', 'grey'),
];

function ctx(d: DayWeather, occasion: OccasionId = 'casual', events: AppEvent[] = []): Context {
  return {
    day: d,
    occasion,
    profile: buildProfile(events, 'normal', new Date('2026-10-30T07:00:00Z')),
    date: d.date,
    fmtTemp: (c) => `${Math.round(c)}°`,
  };
}

const has = (items: Item[], kind: string) => items.some((i) => i.kind === kind);

describe('scenarios', () => {
  it('hot day: light, no coats or sweaters', () => {
    const r = recommend(closet, ctx(day(26, 31)));
    expect(r.suggestions).toHaveLength(3);
    for (const s of r.suggestions) {
      const kinds = partsList(s.outfit).map((i) => i.kind);
      expect(kinds).not.toContain('woolcoat');
      expect(kinds).not.toContain('puffer');
      expect(kinds).not.toContain('sweater');
    }
    expect(r.level).toBe(0);
  });

  it('freezing day: every outfit has a warm coat, no shorts, and a scarf', () => {
    const r = recommend(closet, ctx(day(-4, 1)));
    for (const s of r.suggestions) {
      const items = partsList(s.outfit);
      expect(['woolcoat', 'puffer']).toContain(s.outfit.parts.outer?.kind);
      expect(has(items, 'shorts')).toBe(false);
      expect(has(s.outfit.accessories, 'scarf')).toBe(true);
    }
  });

  it('cold morning, warm afternoon: an outer layer you can take off', () => {
    const r = recommend(closet, ctx(day(7, 19)));
    for (const s of r.suggestions) {
      expect(s.outfit.parts.outer ?? s.outfit.parts.mid).toBeDefined();
      expect(s.reasons[0]).toMatch(/Take off/);
    }
  });

  it('rainy day: no canvas shoes, and rain gear in the top pick', () => {
    const r = recommend(closet, ctx(day(12, 15, { rainy: true, rainChance: 80, rainMm: 4 })));
    for (const s of r.suggestions) expect(s.outfit.parts.shoes?.kind).not.toBe('canvas');
    const top = r.suggestions[0].outfit;
    expect(top.parts.outer?.waterproof || has(top.accessories, 'umbrella')).toBe(true);
  });

  it('big meeting: dressy pieces only', () => {
    const r = recommend(closet, ctx(day(16, 20), 'meeting'));
    for (const s of r.suggestions) {
      for (const i of partsList(s.outfit)) expect(i.formalityMax).toBeGreaterThanOrEqual(3);
    }
  });

  it('three suggestions differ from each other', () => {
    const r = recommend(closet, ctx(day(14, 18)));
    const sigs = new Set(r.suggestions.map((s) => s.signature));
    expect(sigs.size).toBe(3);
  });

  it('says what is missing for an empty-ish closet', () => {
    const r = recommend([item('tshirt')], ctx(day(20)));
    expect(r.suggestions).toHaveLength(0);
    expect(r.missing).toEqual(['a bottom', 'shoes']);
  });

  it('never suggests items in the laundry', () => {
    const dirty = closet.map((i) => (i.kind === 'jeans' ? { ...i, status: 'laundry' as const } : i));
    const r = recommend(dirty, ctx(day(14, 18)));
    for (const s of r.suggestions) expect(has(partsList(s.outfit), 'jeans')).toBe(false);
  });

  it('a thin closet still gets an answer, with rules loosened', () => {
    const r = recommend([item('tshirt'), item('shorts'), item('sandals')], ctx(day(2, 5)));
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.level).toBeGreaterThan(0);
  });
});

describe('learning', () => {
  const at = (daysAgo: number) => new Date(Date.parse('2026-10-30T07:00:00Z') - daysAgo * 86_400_000).toISOString();

  it('"too cold" check-ins make outfits warmer', () => {
    const d = day(10, 12);
    const before = recommend(closet, ctx(d)).suggestions[0];
    const events: AppEvent[] = [1, 2, 3, 4].map((n) => ({ id: `c${n}`, at: at(n), type: 'comfort', itemIds: [], comfort: 'cold' }));
    const after = recommend(closet, ctx(d, 'casual', events)).suggestions[0];
    const w = (s: typeof before) => partsList(s.outfit).reduce((a, i) => a + i.warmth, 0);
    expect(w(after)).toBeGreaterThan(w(before));
  });

  it('"too dressy" for work shifts work outfits more casual', () => {
    const events: AppEvent[] = [1, 2].map((n) => ({ id: `d${n}`, at: at(n), type: 'dislike', itemIds: [], occasion: 'work', reasons: ['tooDressy'] }));
    const p = buildProfile(events, 'normal', new Date('2026-10-30T07:00:00Z'));
    expect(p.formalityOffset.work).toBe(-1);
  });

  it('recently worn items are used less', () => {
    const d = day(15, 18);
    const top = recommend(closet, ctx(d)).suggestions[0];
    const worn: AppEvent = { id: 'w', at: at(1), type: 'wore', itemIds: partsList(top.outfit).map((i) => i.id), date: '2026-10-29' };
    const next = recommend(closet, ctx(d, 'casual', [worn])).suggestions[0];
    expect(next.signature).not.toBe(top.signature);
  });

  it('thermal bias is capped', () => {
    const events: AppEvent[] = Array.from({ length: 20 }, (_, n) => ({ id: `c${n}`, at: at(n), type: 'comfort', itemIds: [], comfort: 'warm' }));
    expect(buildProfile(events, 'normal', new Date()).thermalBias).toBe(-3);
  });
});

describe('swaps', () => {
  it('offers other jackets and "without it" for the outer layer', () => {
    const c = ctx(day(9, 16));
    const s = recommend(closet, c).suggestions.find((x) => x.outfit.parts.outer)!;
    const alts = alternatives(closet, s.outfit, 'outer', c);
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) expect(a.outfit.parts.outer?.id).not.toBe(s.outfit.parts.outer!.id);
  });
});

describe('weather', () => {
  it('only looks at the hours you are out', () => {
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const f: HourlyForecast = {
      time: hours.map((h) => `2026-10-30T${String(h).padStart(2, '0')}:00`),
      apparent_temperature: hours.map((h) => (h < 8 ? -10 : 10 + (h - 8))),
      precipitation_probability: hours.map((h) => (h === 22 ? 90 : 10)),
      precipitation: hours.map(() => 0),
      snowfall: hours.map(() => 0),
      wind_gusts_10m: hours.map(() => 10),
      uv_index: hours.map(() => 1),
    };
    const d = summarizeDay(f, '2026-10-30', 8, 20)!;
    expect(d.feelsMin).toBe(10);
    expect(d.feelsMax).toBe(22);
    expect(d.rainy).toBe(false);
  });

  it('needs more warmth as it gets colder', () => {
    for (let t = -20; t < 35; t++) expect(requiredWarmth(t)).toBeGreaterThanOrEqual(requiredWarmth(t + 1));
  });
});

describe('rules that always hold', () => {
  const kindIds = KINDS.map((k) => k.id);
  const arbItem = fc.record({
    kind: fc.constantFrom(...kindIds),
    color: fc.constantFrom('black', 'white', 'navy', 'red', 'green', 'pink'),
    laundry: fc.boolean(),
  });
  const arbDay = fc
    .record({
      min: fc.integer({ min: -15, max: 32 }),
      spread: fc.integer({ min: 0, max: 14 }),
      rain: fc.boolean(),
      snow: fc.boolean(),
    })
    .map(({ min, spread, rain, snow }) => day(min, min + spread, { rainy: rain, rainChance: rain ? 80 : 0, snowy: snow && min < 2 }));

  it('every suggestion is a complete, valid outfit', () => {
    fc.assert(
      fc.property(
        fc.array(arbItem, { minLength: 3, maxLength: 40 }),
        arbDay,
        fc.constantFrom<OccasionId>('casual', 'work', 'meeting', 'gym', 'formal'),
        (specs, d, occasion) => {
          const items = specs.map((s) => item(s.kind, s.color, { status: s.laundry ? 'laundry' : 'clean' }));
          const r = recommend(items, ctx(d, occasion));
          for (const s of r.suggestions) {
            const parts = partsList(s.outfit);
            const ids = parts.map((i) => i.id);
            expect(new Set(ids).size).toBe(ids.length);
            expect(s.outfit.parts.shoes).toBeDefined();
            const p = s.outfit.parts;
            expect(!!p.onePiece || (!!p.bottom && (!!p.top || !!p.mid))).toBe(true);
            for (const i of [...parts, ...s.outfit.accessories]) {
              expect(i.status).toBe('clean');
              expect(kindInfo(i.kind).slot === 'accessory').toBe(s.outfit.accessories.includes(i));
            }
            if (r.level === 0) {
              if (d.rainy) expect(p.shoes!.avoidRain).toBe(false);
              if (d.feelsMax < 18) expect(parts.some((i) => i.kind === 'shorts')).toBe(false);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
