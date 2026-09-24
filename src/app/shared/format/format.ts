import { MetricFormat } from '../../core/analytics/metrics';
import { IsoDate, parseIso } from '../../core/data/dates';

const LOCALE = 'en-US';
const cache = new Map<string, Intl.NumberFormat>();

function nf(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new Intl.NumberFormat(LOCALE, options)));
  return f;
}

export const EMPTY_VALUE = '—';

export function formatCurrency(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  if (compact && Math.abs(value) >= 1000) {
    return nf('cur-c', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  // Whole amounts (axis ticks) drop the cents; prices like an AOV keep them.
  const digits = Math.abs(value) >= 1000 || (compact && Number.isInteger(value)) ? 0 : 2;
  return nf(`cur-${digits}`, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatNumber(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  if (compact && Math.abs(value) >= 10_000) return nf('num-c', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  return nf('num', { maximumFractionDigits: Math.abs(value) < 10 && !Number.isInteger(value) ? 2 : 0 }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return nf(`pct-${digits}`, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Signed relative change: +12.3 % / −4.0 %. Uses a real minus sign for legibility. */
export function formatDelta(pct: number | null | undefined, digits = 1): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return EMPTY_VALUE;
  const text = nf(`dpct-${digits}`, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(pct);
  return text.replace('-', '−');
}

export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return `${nf('ratio', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}×`;
}

export function formatMetric(value: number | null | undefined, format: MetricFormat, compact = false): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value, compact);
    case 'number':
      return formatNumber(value, compact);
    case 'percent':
      return formatPercent(value);
    case 'ratio':
      return formatRatio(value);
  }
}

const dateFormats = {
  day: new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  dayYear: new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  month: new Intl.DateTimeFormat(LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
};

export function formatDate(date: IsoDate, style: keyof typeof dateFormats = 'dayYear'): string {
  const iso = date.length === 7 ? `${date}-01` : date;
  return dateFormats[style].format(new Date(parseIso(iso)));
}

export function formatRange(start: IsoDate, end: IsoDate): string {
  if (start === end) return formatDate(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDate(start, sameYear ? 'day' : 'dayYear')} – ${formatDate(end)}`;
}
