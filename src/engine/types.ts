export type Slot = 'top' | 'mid' | 'bottom' | 'onePiece' | 'outer' | 'shoes' | 'accessory';

/** The clothing positions of an outfit, head to toe. Accessories are kept separately. */
export type Part = 'outer' | 'mid' | 'top' | 'onePiece' | 'bottom' | 'shoes';
export const PART_ORDER: Part[] = ['outer', 'mid', 'top', 'onePiece', 'bottom', 'shoes'];

export type Pattern = 'plain' | 'striped' | 'checked' | 'floral' | 'print';
export type ItemStatus = 'clean' | 'laundry';

export type OccasionId =
  | 'casual'
  | 'work'
  | 'meeting'
  | 'date'
  | 'party'
  | 'formal'
  | 'gym'
  | 'outdoors';

export interface Item {
  id: string;
  name: string;
  kind: string;
  color: string;
  pattern: Pattern;
  /** 0 sporty … 5 formal */
  formalityMin: number;
  formalityMax: number;
  /** Warmth points; layers add up. */
  warmth: number;
  waterproof: boolean;
  avoidRain: boolean;
  status: ItemStatus;
  /** JPEG data URL */
  photo?: string;
  createdAt: string;
}

export interface Outfit {
  parts: Partial<Record<Part, Item>>;
  accessories: Item[];
}

export type Reason = 'tooWarm' | 'tooCold' | 'tooDressy' | 'tooCasual' | 'notTogether' | 'other';
export type Comfort = 'cold' | 'ok' | 'warm';
export type RunsTemp = 'cold' | 'normal' | 'warm';

export interface AppEvent {
  id: string;
  /** ISO timestamp of when it happened */
  at: string;
  type: 'wore' | 'like' | 'dislike' | 'swap' | 'comfort';
  /** Clothing items of the outfit the event is about */
  itemIds: string[];
  occasion?: OccasionId;
  /** YYYY-MM-DD the outfit was worn (wore events) */
  date?: string;
  reasons?: Reason[];
  comfort?: Comfort;
  /** comfort events: the wore event they rate */
  wearId?: string;
  /** swap events */
  from?: string;
  to?: string;
}

export interface DayWeather {
  date: string;
  fromHour: number;
  toHour: number;
  feelsMin: number;
  feelsMax: number;
  /** Highest chance of rain in the window, % */
  rainChance: number;
  rainMm: number;
  snowCm: number;
  gustMax: number;
  uvMax: number;
  rainy: boolean;
  snowy: boolean;
  sunny: boolean;
  hours: { hour: number; feels: number; rainChance: number }[];
}
