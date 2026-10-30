import type { Item } from './types';

export interface ColorInfo {
  id: string;
  label: string;
  hex: string;
  /** Goes with almost anything */
  neutral?: boolean;
}

export const COLORS: ColorInfo[] = [
  { id: 'black', label: 'Black', hex: '#232323', neutral: true },
  { id: 'charcoal', label: 'Charcoal', hex: '#4a4c50', neutral: true },
  { id: 'grey', label: 'Grey', hex: '#9b9c9e', neutral: true },
  { id: 'white', label: 'White', hex: '#f7f7f4', neutral: true },
  { id: 'cream', label: 'Cream', hex: '#efe5cd', neutral: true },
  { id: 'beige', label: 'Beige', hex: '#d6c09c', neutral: true },
  { id: 'brown', label: 'Brown', hex: '#7a5434', neutral: true },
  { id: 'navy', label: 'Navy', hex: '#23314d', neutral: true },
  { id: 'denim', label: 'Denim blue', hex: '#56789b', neutral: true },
  { id: 'lightblue', label: 'Light blue', hex: '#aac8e6', neutral: true },
  { id: 'olive', label: 'Olive', hex: '#6b6b3a', neutral: true },
  { id: 'blue', label: 'Blue', hex: '#2f6bd0' },
  { id: 'green', label: 'Green', hex: '#3b8a4f' },
  { id: 'red', label: 'Red', hex: '#c23a30' },
  { id: 'burgundy', label: 'Burgundy', hex: '#7a2232' },
  { id: 'pink', label: 'Pink', hex: '#eba6bb' },
  { id: 'purple', label: 'Purple', hex: '#7a4ea3' },
  { id: 'yellow', label: 'Yellow', hex: '#e8c64a' },
  { id: 'orange', label: 'Orange', hex: '#df7838' },
];

const COLOR_BY_ID = new Map(COLORS.map((c) => [c.id, c]));

export function colorInfo(id: string): ColorInfo {
  return COLOR_BY_ID.get(id) ?? COLORS[2];
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** sRGB → CIE Lab, for "which palette colour is closest to this photo pixel". */
function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function nearestColor(rgb: [number, number, number]): ColorInfo {
  const lab = toLab(rgb);
  let best = COLORS[0];
  let bestD = Infinity;
  for (const c of COLORS) {
    const l2 = toLab(hexToRgb(c.hex));
    const d = (lab[0] - l2[0]) ** 2 + (lab[1] - l2[1]) ** 2 + (lab[2] - l2[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * 0–1: how well the colours and patterns of these items sit together.
 * Neutrals pair with anything; bold colours should be few and either close
 * in hue or opposite; more than one pattern gets busy.
 */
export function harmony(items: Item[]): number {
  let penalty = 0;

  const bold = items.map((i) => colorInfo(i.color)).filter((c) => !c.neutral);
  const distinct = [...new Map(bold.map((c) => [c.id, c])).values()];
  if (distinct.length >= 3) penalty += 0.5;
  if (bold.length > distinct.length) penalty += 0.1;
  for (let a = 0; a < distinct.length; a++) {
    for (let b = a + 1; b < distinct.length; b++) {
      let d = Math.abs(hue(distinct[a].hex) - hue(distinct[b].hex));
      if (d > 180) d = 360 - d;
      if (d >= 35 && d < 150) penalty += 0.2;
      else if (d >= 150) penalty += 0.05;
    }
  }

  const patterned = items.filter((i) => i.pattern !== 'plain').length;
  if (patterned === 2) penalty += 0.25;
  if (patterned >= 3) penalty += 0.5;

  return Math.max(0, Math.min(1, 1 - penalty));
}
