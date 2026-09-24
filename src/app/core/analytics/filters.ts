import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES, DimensionKey, REGIONS, SEGMENTS } from '../data/catalog';
import { IsoDate } from '../data/dates';
import { CompareMode, DateRange, RangePreset } from './date-range';

export type DimensionFilters = Readonly<Record<DimensionKey, readonly string[]>>;

/** What the user picked — lives in the store and the URL. */
export interface FilterState extends DimensionFilters {
  readonly preset: RangePreset;
  /** Only meaningful for the `custom` preset. */
  readonly start: IsoDate | null;
  readonly end: IsoDate | null;
  readonly compare: CompareMode;
}

/** What a query needs — ranges already resolved against the dataset anchor. */
export interface QueryFilters extends DimensionFilters {
  readonly range: DateRange;
  readonly comparison: DateRange | null;
}

export const DIMENSION_KEYS: readonly DimensionKey[] = ['region', 'country', 'channel', 'device', 'category', 'segment'];

export const EMPTY_DIMENSIONS: DimensionFilters = {
  region: [],
  country: [],
  channel: [],
  device: [],
  category: [],
  segment: [],
};

export const DEFAULT_FILTER_STATE: FilterState = {
  ...EMPTY_DIMENSIONS,
  preset: '90d',
  start: null,
  end: null,
  compare: 'previous',
};

/** Byte masks (1 = allowed) per dictionary-encoded dimension; region folds into country. */
export interface CompiledFilter {
  readonly country: Uint8Array;
  readonly channel: Uint8Array;
  readonly device: Uint8Array;
  readonly category: Uint8Array;
  readonly segment: Uint8Array;
}

function mask(size: number, codes: readonly string[], codeAt: (i: number) => string): Uint8Array {
  const out = new Uint8Array(size);
  const wanted = new Set(codes);
  for (let i = 0; i < size; i++) out[i] = wanted.size === 0 || wanted.has(codeAt(i)) ? 1 : 0;
  return out;
}

export function compileFilter(f: DimensionFilters): CompiledFilter {
  const regionMask = mask(REGIONS.length, f.region, (i) => REGIONS[i].code);
  const countryMask = mask(COUNTRIES.length, f.country, (i) => COUNTRIES[i].code);
  for (let i = 0; i < COUNTRIES.length; i++) countryMask[i] &= regionMask[COUNTRIES[i].region];
  return {
    country: countryMask,
    channel: mask(CHANNELS.length, f.channel, (i) => CHANNELS[i].code),
    device: mask(DEVICES.length, f.device, (i) => DEVICES[i].code),
    category: mask(CATEGORIES.length, f.category, (i) => CATEGORIES[i].code),
    segment: mask(SEGMENTS.length, f.segment, (i) => SEGMENTS[i].code),
  };
}

export function activeDimensionCount(f: DimensionFilters): number {
  return DIMENSION_KEYS.reduce((n, k) => n + (f[k].length > 0 ? 1 : 0), 0);
}

/** Traffic, spend and funnel data has no category/segment — those filters cannot apply there. */
export function hasNonTrafficFilters(f: DimensionFilters): boolean {
  return f.category.length > 0 || f.segment.length > 0;
}

export function sameFilters(a: FilterState, b: FilterState): boolean {
  return (
    a.preset === b.preset &&
    a.start === b.start &&
    a.end === b.end &&
    a.compare === b.compare &&
    DIMENSION_KEYS.every((k) => a[k].length === b[k].length && a[k].every((v, i) => v === b[k][i]))
  );
}
