/**
 * Calendar helpers on ISO dates ('YYYY-MM-DD'). Everything is UTC so a date never shifts
 * with the viewer's timezone — the dataset is a calendar, not a timeline of instants.
 */
export type IsoDate = string;

export const DAY_MS = 86_400_000;

export function parseIso(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toIso(parseIso(value)) === value;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(parseIso(date) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((parseIso(b) - parseIso(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function dayOfWeek(date: IsoDate): number {
  return (new Date(parseIso(date)).getUTCDay() + 6) % 7;
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

export function startOfQuarter(date: IsoDate): IsoDate {
  const month = Number(date.slice(5, 7));
  const qMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${date.slice(0, 4)}-${String(qMonth).padStart(2, '0')}-01`;
}

export function startOfYear(date: IsoDate): IsoDate {
  return `${date.slice(0, 4)}-01-01`;
}

/** ISO week start (Monday). */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -dayOfWeek(date));
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Adds calendar months, clamping the day (Mar 31 − 1 month = Feb 28/29). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return toIso(Date.UTC(ny, nm, nd));
}

export function addYears(date: IsoDate, years: number): IsoDate {
  return addMonths(date, years * 12);
}

export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

/** Months between two month keys ('2025-01' → '2025-03' = 2). */
export function monthDiff(fromKey: string, toKey: string): number {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}
