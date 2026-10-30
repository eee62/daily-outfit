export function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtTemp(celsius: number, units: 'C' | 'F'): string {
  const v = units === 'F' ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(v)}°`;
}

export function fmtHour(h: number): string {
  return new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
