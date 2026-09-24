import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES, PRODUCTS, REGIONS, SEGMENTS } from '../../data/catalog';
import { Dataset } from '../../data/dataset';
import { addDays, addMonths, monthDiff, monthKey } from '../../data/dates';
import { compileFilter, QueryFilters } from '../filters';
import { buildPivot, PivotAccessors, PivotConfig, PivotDimension, PivotResult } from '../pivot';
import { daySpan, scanOrders } from './scan';

export interface PivotParams {
  readonly filters: QueryFilters;
  readonly config: PivotConfig;
}

export interface PivotQueryResult extends PivotResult {
  /** Member labels for every dimension used by the config. */
  readonly labels: Readonly<Partial<Record<PivotDimension, string[]>>>;
  readonly sourceRows: number;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface TimeIndex {
  year: Uint8Array;
  quarter: Uint8Array;
  month: Uint8Array;
  weekday: Uint8Array;
  labels: Record<'year' | 'quarter' | 'month' | 'weekday', string[]>;
}

const timeCache = new WeakMap<Dataset, TimeIndex>();

/** Per-day calendar members, computed once per dataset. */
function timeIndex(ds: Dataset): TimeIndex {
  const hit = timeCache.get(ds);
  if (hit) return hit;
  const startYear = Number(ds.start.slice(0, 4));
  const firstMonth = monthKey(ds.start);
  const idx: TimeIndex = {
    year: new Uint8Array(ds.days),
    quarter: new Uint8Array(ds.days),
    month: new Uint8Array(ds.days),
    weekday: new Uint8Array(ds.days),
    labels: { year: [], quarter: [], month: [], weekday: WEEKDAYS },
  };
  for (let d = 0; d < ds.days; d++) {
    const date = addDays(ds.start, d);
    const y = Number(date.slice(0, 4)) - startYear;
    const m = Number(date.slice(5, 7)) - 1;
    idx.year[d] = y;
    idx.quarter[d] = y * 4 + Math.floor(m / 3);
    idx.month[d] = monthDiff(firstMonth, monthKey(date));
    idx.weekday[d] = (new Date(Date.parse(date)).getUTCDay() + 6) % 7;
  }
  const years = idx.year[ds.days - 1] + 1;
  for (let y = 0; y < years; y++) {
    idx.labels.year.push(String(startYear + y));
    for (let q = 0; q < 4; q++) idx.labels.quarter.push(`Q${q + 1} ${startYear + y}`);
  }
  for (let m = 0; m <= idx.month[ds.days - 1]; m++) {
    const key = addMonths(`${firstMonth}-01`, m);
    idx.labels.month.push(`${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`);
  }
  timeCache.set(ds, idx);
  return idx;
}

function dimensionLabels(dim: PivotDimension, time: TimeIndex): string[] {
  switch (dim) {
    case 'region':
      return REGIONS.map((m) => m.label);
    case 'country':
      return COUNTRIES.map((m) => m.label);
    case 'channel':
      return CHANNELS.map((m) => m.label);
    case 'device':
      return DEVICES.map((m) => m.label);
    case 'category':
      return CATEGORIES.map((m) => m.label);
    case 'product':
      return PRODUCTS.map((m) => m.label);
    case 'segment':
      return SEGMENTS.map((m) => m.label);
    case 'customerType':
      return ['New', 'Returning'];
    case 'year':
    case 'quarter':
    case 'month':
    case 'weekday':
      return time.labels[dim];
  }
}

export function pivotQuery(ds: Dataset, { filters, config }: PivotParams): PivotQueryResult {
  const f = compileFilter(filters);
  const o = ds.orders;
  const time = timeIndex(ds);
  const selected: number[] = [];
  scanOrders(ds, f, daySpan(ds, filters.range), (i) => selected.push(i));

  const member = (dim: PivotDimension, i: number): number => {
    switch (dim) {
      case 'region':
        return COUNTRIES[o.country[i]].region;
      case 'country':
        return o.country[i];
      case 'channel':
        return o.channel[i];
      case 'device':
        return o.device[i];
      case 'category':
        return o.category[i];
      case 'product':
        return o.product[i];
      case 'segment':
        return o.segment[i];
      case 'customerType':
        return o.isNew[i] ? 0 : 1;
      case 'year':
      case 'quarter':
      case 'month':
      case 'weekday':
        return time[dim][o.day[i]];
    }
  };
  const accessors: PivotAccessors = {
    rows: selected,
    member,
    revenue: (i) => o.revenue[i],
    cost: (i) => o.cost[i],
    discount: (i) => o.discount[i],
    units: (i) => o.qty[i],
    customer: (i) => o.customer[i],
    refunded: (i) => o.refunded[i] === 1,
  };
  const result = buildPivot(config, accessors);
  const labels: Partial<Record<PivotDimension, string[]>> = {};
  for (const dim of [...config.rows, ...(config.columns ? [config.columns] : [])]) labels[dim] = dimensionLabels(dim, time);
  return { ...result, labels, sourceRows: selected.length };
}
