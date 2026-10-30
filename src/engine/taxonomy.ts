import type { OccasionId, Slot } from './types';

export interface KindInfo {
  id: string;
  label: string;
  slot: Slot;
  emoji: string;
  /** Default formality range, 0 sporty … 5 formal */
  formality: [number, number];
  /** Default warmth points */
  warmth: number;
  waterproof?: boolean;
  avoidRain?: boolean;
  /** Fine for snow and slush */
  snowOk?: boolean;
  /** Mid layers that work without a top underneath */
  wornAlone?: boolean;
  /** Skip when the warmest part of the day feels colder than this (°C) */
  minFeels?: number;
  /** Skip when the coldest part of the day feels warmer than this (°C) */
  maxFeels?: number;
  /** Like maxFeels, but only on dry days (rain gear) */
  dryMaxFeels?: number;
  /** Accessories: when to bring them */
  when?: 'rain' | 'cold' | 'sun';
}

export const KINDS: KindInfo[] = [
  // Tops
  { id: 'tshirt', label: 'T-shirt', slot: 'top', emoji: '👕', formality: [0, 2], warmth: 1 },
  { id: 'tank', label: 'Tank top', slot: 'top', emoji: '🎽', formality: [0, 1], warmth: 0.5, minFeels: 22 },
  { id: 'polo', label: 'Polo shirt', slot: 'top', emoji: '👕', formality: [1, 3], warmth: 1 },
  { id: 'longsleeve', label: 'Long-sleeve top', slot: 'top', emoji: '👕', formality: [1, 2], warmth: 1.5 },
  { id: 'shirt', label: 'Button-up shirt', slot: 'top', emoji: '👔', formality: [2, 5], warmth: 1.5 },
  { id: 'blouse', label: 'Blouse', slot: 'top', emoji: '👚', formality: [2, 4], warmth: 1 },
  { id: 'sporttop', label: 'Sports top', slot: 'top', emoji: '🎽', formality: [0, 0], warmth: 0.7 },

  // Layers worn over a top
  { id: 'sweater', label: 'Sweater', slot: 'mid', emoji: '🧶', formality: [1, 4], warmth: 2.5, wornAlone: true, maxFeels: 20 },
  { id: 'cardigan', label: 'Cardigan', slot: 'mid', emoji: '🧶', formality: [1, 3], warmth: 2, maxFeels: 22 },
  { id: 'hoodie', label: 'Hoodie', slot: 'mid', emoji: '👕', formality: [0, 1], warmth: 2.5, wornAlone: true, maxFeels: 20 },
  { id: 'sweatshirt', label: 'Sweatshirt', slot: 'mid', emoji: '👕', formality: [0, 1], warmth: 2, wornAlone: true, maxFeels: 22 },
  { id: 'fleece', label: 'Fleece', slot: 'mid', emoji: '🧥', formality: [0, 1], warmth: 2.5, maxFeels: 18 },

  // Bottoms
  { id: 'jeans', label: 'Jeans', slot: 'bottom', emoji: '👖', formality: [1, 3], warmth: 1 },
  { id: 'chinos', label: 'Chinos', slot: 'bottom', emoji: '👖', formality: [2, 3], warmth: 1 },
  { id: 'trousers', label: 'Dress trousers', slot: 'bottom', emoji: '👖', formality: [3, 5], warmth: 1 },
  { id: 'shorts', label: 'Shorts', slot: 'bottom', emoji: '🩳', formality: [0, 2], warmth: 0.3, minFeels: 18 },
  { id: 'skirt', label: 'Skirt', slot: 'bottom', emoji: '👗', formality: [1, 4], warmth: 0.5 },
  { id: 'leggings', label: 'Leggings', slot: 'bottom', emoji: '👖', formality: [0, 1], warmth: 0.8 },
  { id: 'joggers', label: 'Joggers', slot: 'bottom', emoji: '👖', formality: [0, 1], warmth: 1.2 },
  { id: 'sportshorts', label: 'Sports shorts', slot: 'bottom', emoji: '🩳', formality: [0, 0], warmth: 0.3, minFeels: 12 },

  // One-piece
  { id: 'dress', label: 'Dress', slot: 'onePiece', emoji: '👗', formality: [2, 5], warmth: 1 },
  { id: 'sundress', label: 'Summer dress', slot: 'onePiece', emoji: '👗', formality: [1, 3], warmth: 0.6, minFeels: 20 },
  { id: 'jumpsuit', label: 'Jumpsuit', slot: 'onePiece', emoji: '👗', formality: [2, 4], warmth: 1.5 },

  // Outerwear
  { id: 'lightjacket', label: 'Light jacket', slot: 'outer', emoji: '🧥', formality: [0, 2], warmth: 1.5, maxFeels: 22 },
  { id: 'denimjacket', label: 'Denim jacket', slot: 'outer', emoji: '🧥', formality: [1, 2], warmth: 2, maxFeels: 22 },
  { id: 'blazer', label: 'Blazer', slot: 'outer', emoji: '🧥', formality: [3, 5], warmth: 1.5 },
  { id: 'leather', label: 'Leather jacket', slot: 'outer', emoji: '🧥', formality: [1, 3], warmth: 2, maxFeels: 20 },
  { id: 'raincoat', label: 'Rain jacket', slot: 'outer', emoji: '🧥', formality: [0, 2], warmth: 1, waterproof: true, dryMaxFeels: 12 },
  { id: 'trench', label: 'Trench coat', slot: 'outer', emoji: '🧥', formality: [2, 4], warmth: 2.5, waterproof: true, maxFeels: 18 },
  { id: 'woolcoat', label: 'Wool coat', slot: 'outer', emoji: '🧥', formality: [2, 5], warmth: 3.5, maxFeels: 14 },
  { id: 'puffer', label: 'Puffer jacket', slot: 'outer', emoji: '🧥', formality: [0, 2], warmth: 4.5, maxFeels: 10 },
  { id: 'parka', label: 'Winter parka', slot: 'outer', emoji: '🧥', formality: [0, 2], warmth: 5, waterproof: true, maxFeels: 6 },

  // Shoes
  { id: 'sneakers', label: 'Sneakers', slot: 'shoes', emoji: '👟', formality: [0, 2], warmth: 0.2 },
  { id: 'canvas', label: 'Canvas shoes', slot: 'shoes', emoji: '👟', formality: [0, 2], warmth: 0.1, avoidRain: true },
  { id: 'running', label: 'Running shoes', slot: 'shoes', emoji: '👟', formality: [0, 1], warmth: 0.2 },
  { id: 'boots', label: 'Boots', slot: 'shoes', emoji: '👢', formality: [1, 3], warmth: 0.5, snowOk: true, maxFeels: 20 },
  { id: 'loafers', label: 'Loafers', slot: 'shoes', emoji: '👞', formality: [2, 4], warmth: 0.2 },
  { id: 'dressshoes', label: 'Dress shoes', slot: 'shoes', emoji: '👞', formality: [3, 5], warmth: 0.2 },
  { id: 'heels', label: 'Heels', slot: 'shoes', emoji: '👠', formality: [3, 5], warmth: 0.1 },
  { id: 'flats', label: 'Flats', slot: 'shoes', emoji: '🥿', formality: [2, 4], warmth: 0.1 },
  { id: 'sandals', label: 'Sandals', slot: 'shoes', emoji: '🩴', formality: [0, 2], warmth: 0, avoidRain: true, minFeels: 20 },
  { id: 'rainboots', label: 'Rain boots', slot: 'shoes', emoji: '🥾', formality: [0, 1], warmth: 0.4, waterproof: true, snowOk: true, dryMaxFeels: -50 },
  { id: 'hiking', label: 'Hiking boots', slot: 'shoes', emoji: '🥾', formality: [0, 1], warmth: 0.6, waterproof: true, snowOk: true },

  // Accessories
  { id: 'umbrella', label: 'Umbrella', slot: 'accessory', emoji: '☂️', formality: [0, 5], warmth: 0, when: 'rain' },
  { id: 'scarf', label: 'Scarf', slot: 'accessory', emoji: '🧣', formality: [0, 5], warmth: 0.5, when: 'cold' },
  { id: 'beanie', label: 'Beanie', slot: 'accessory', emoji: '🧢', formality: [0, 2], warmth: 0.5, when: 'cold' },
  { id: 'gloves', label: 'Gloves', slot: 'accessory', emoji: '🧤', formality: [0, 5], warmth: 0.3, when: 'cold' },
  { id: 'sunglasses', label: 'Sunglasses', slot: 'accessory', emoji: '🕶️', formality: [0, 5], warmth: 0, when: 'sun' },
  { id: 'cap', label: 'Cap', slot: 'accessory', emoji: '🧢', formality: [0, 1], warmth: 0, when: 'sun' },
  { id: 'sunhat', label: 'Sun hat', slot: 'accessory', emoji: '👒', formality: [0, 3], warmth: 0, when: 'sun' },
];

const KIND_BY_ID = new Map(KINDS.map((k) => [k.id, k]));

export function kindInfo(id: string): KindInfo {
  return KIND_BY_ID.get(id) ?? KINDS[0];
}

export const SLOT_LABELS: Record<Slot, string> = {
  top: 'Tops',
  mid: 'Sweaters & layers',
  bottom: 'Bottoms',
  onePiece: 'Dresses & jumpsuits',
  outer: 'Jackets & coats',
  shoes: 'Shoes',
  accessory: 'Accessories',
};

export const SLOT_ORDER: Slot[] = ['top', 'mid', 'bottom', 'onePiece', 'outer', 'shoes', 'accessory'];

export const FORMALITY_LABELS = ['Sporty', 'Casual', 'Smart casual', 'Business casual', 'Business', 'Formal'];

export interface OccasionInfo {
  id: OccasionId;
  label: string;
  formality: [number, number];
  /** Moving around a lot: needs less warmth */
  active?: boolean;
}

export const OCCASIONS: OccasionInfo[] = [
  { id: 'casual', label: 'Casual', formality: [1, 2] },
  { id: 'work', label: 'Work', formality: [2, 3] },
  { id: 'meeting', label: 'Big meeting', formality: [3, 4] },
  { id: 'date', label: 'Date night', formality: [2, 4] },
  { id: 'party', label: 'Party', formality: [2, 4] },
  { id: 'formal', label: 'Wedding / formal', formality: [4, 5] },
  { id: 'gym', label: 'Gym', formality: [0, 0], active: true },
  { id: 'outdoors', label: 'Outdoors', formality: [0, 1], active: true },
];

export function occasionInfo(id: OccasionId): OccasionInfo {
  return OCCASIONS.find((o) => o.id === id) ?? OCCASIONS[0];
}
