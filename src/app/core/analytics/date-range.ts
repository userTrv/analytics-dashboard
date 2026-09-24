import {
  addDays,
  addMonths,
  addYears,
  diffDays,
  IsoDate,
  maxDate,
  minDate,
  startOfQuarter,
  startOfYear,
} from '../data/dates';

export type RangePreset = '7d' | '30d' | '90d' | 'qtd' | 'ytd' | '12m' | 'custom';
export type CompareMode = 'previous' | 'yoy' | 'none';

/** Inclusive calendar range. */
export interface DateRange {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

export const RANGE_PRESETS: readonly { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Last 12 months' },
];

export const COMPARE_MODES: readonly { value: CompareMode; label: string }[] = [
  { value: 'previous', label: 'Previous period' },
  { value: 'yoy', label: 'Same period last year' },
  { value: 'none', label: 'No comparison' },
];

/**
 * Resolves a preset against an anchor date ("today" of the dataset). Custom ranges are
 * normalised (swapped when reversed) and clamped to `bounds` when provided.
 */
export function resolveRange(
  preset: RangePreset,
  anchor: IsoDate,
  custom?: Partial<DateRange> | null,
  bounds?: DateRange,
): DateRange {
  let range: DateRange;
  switch (preset) {
    case '7d':
      range = { start: addDays(anchor, -6), end: anchor };
      break;
    case '30d':
      range = { start: addDays(anchor, -29), end: anchor };
      break;
    case '90d':
      range = { start: addDays(anchor, -89), end: anchor };
      break;
    case 'qtd':
      range = { start: startOfQuarter(anchor), end: anchor };
      break;
    case 'ytd':
      range = { start: startOfYear(anchor), end: anchor };
      break;
    case '12m':
      range = { start: addDays(addMonths(anchor, -12), 1), end: anchor };
      break;
    case 'custom': {
      const start = custom?.start ?? addDays(anchor, -29);
      const end = custom?.end ?? anchor;
      range = start <= end ? { start, end } : { start: end, end: start };
      break;
    }
  }
  return bounds ? clampRange(range, bounds) : range;
}

export function clampRange(range: DateRange, bounds: DateRange): DateRange {
  const start = minDate(maxDate(range.start, bounds.start), bounds.end);
  const end = maxDate(minDate(range.end, bounds.end), start);
  return { start, end };
}

export function rangeLength(range: DateRange): number {
  return diffDays(range.start, range.end) + 1;
}

/**
 * Comparison window: `previous` is the same number of days immediately before the range,
 * `yoy` shifts both ends by one calendar year (Feb 29 clamps to Feb 28).
 */
export function comparisonRange(range: DateRange, mode: CompareMode): DateRange | null {
  switch (mode) {
    case 'none':
      return null;
    case 'previous': {
      const len = rangeLength(range);
      return { start: addDays(range.start, -len), end: addDays(range.start, -1) };
    }
    case 'yoy':
      return { start: addYears(range.start, -1), end: addYears(range.end, -1) };
  }
}

/** Default granularity that keeps a time series readable (≤ ~60 points). */
export function autoGranularity(range: DateRange): Granularity {
  const len = rangeLength(range);
  if (len <= 62) return 'day';
  if (len <= 366) return 'week';
  return 'month';
}

export type Granularity = 'day' | 'week' | 'month';
