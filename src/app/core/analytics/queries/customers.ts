import { CHANNELS, SEGMENTS } from '../../data/catalog';
import { Dataset } from '../../data/dataset';
import { addDays, addMonths, diffDays, monthDiff, monthKey } from '../../data/dates';
import { cohortRetention, ltvCurves } from '../cohorts';
import { compileFilter, QueryFilters } from '../filters';
import { RFM_SEGMENTS, rfmSegment, RfmSegment } from '../rfm';

export type LtvGrouping = 'segment' | 'channel';

export interface CustomersParams {
  readonly filters: QueryFilters;
  readonly ltvBy: LtvGrouping;
}

export interface CustomersResult {
  readonly cohorts: {
    /** Month keys ('2026-03') of the acquisition cohorts. */
    readonly months: string[];
    readonly sizes: number[];
    readonly retention: (number | null)[][];
    /** True when the selected range was too short and the window was widened. */
    readonly widened: boolean;
  };
  readonly ltv: { readonly groups: string[]; readonly curves: (number | null)[][] };
  readonly newVsReturning: {
    readonly months: string[];
    readonly newRevenue: number[];
    readonly returningRevenue: number[];
    readonly newOrders: number[];
    readonly returningOrders: number[];
  };
  readonly rfm: { readonly code: RfmSegment; readonly customers: number; readonly revenue: number }[];
  readonly totals: { readonly customers: number; readonly activeCustomers: number; readonly repeatRate: number | null };
}

const MIN_COHORTS = 6;
const WIDENED_COHORTS = 12;
const MAX_OFFSET = 12;
const dayMonthCache = new WeakMap<Dataset, Int32Array>();

/** Month index (months since the dataset's first month) for each day of the dataset. */
function dayToMonth(ds: Dataset): Int32Array {
  let cached = dayMonthCache.get(ds);
  if (!cached) {
    const first = monthKey(ds.start);
    cached = new Int32Array(ds.days);
    for (let d = 0; d < ds.days; d++) cached[d] = monthDiff(first, monthKey(addDays(ds.start, d)));
    dayMonthCache.set(ds, cached);
  }
  return cached;
}

/**
 * Customer analytics filter customers by their acquisition attributes (country, first
 * channel, first device, segment). Category does not describe a customer, so it is ignored.
 */
export function customersQuery(ds: Dataset, { filters, ltvBy }: CustomersParams): CustomersResult {
  const f = compileFilter(filters);
  const months = dayToMonth(ds);
  const firstKey = monthKey(ds.start);
  const lastDataMonth = months[ds.days - 1];
  const rangeStartDay = Math.max(0, diffDays(ds.start, filters.range.start));
  const rangeEndDay = Math.min(ds.days - 1, diffDays(ds.start, filters.range.end));
  let from = months[rangeStartDay];
  const to = months[rangeEndDay];
  const widened = to - from + 1 < MIN_COHORTS;
  if (widened) from = Math.max(0, to - WIDENED_COHORTS + 1);
  const cohortCount = to - from + 1;

  const c = ds.customers;
  const customerCohort = new Int32Array(ds.customerCount);
  const customerGroup = new Int32Array(ds.customerCount);
  let customers = 0;
  for (let i = 0; i < ds.customerCount; i++) {
    const pass = f.country[c.country[i]] && f.channel[c.channel[i]] && f.device[c.device[i]] && f.segment[c.segment[i]];
    const m = months[c.firstDay[i]];
    customerCohort[i] = pass && m >= from && m <= to ? m - from : -1;
    customerGroup[i] = pass ? (ltvBy === 'segment' ? c.segment[i] : c.channel[i]) : -1;
    if (customerCohort[i] >= 0) customers++;
  }

  const o = ds.orders;
  const orderMonth = new Int32Array(ds.orderCount);
  for (let i = 0; i < ds.orderCount; i++) orderMonth[i] = months[o.day[i]] - from;
  const netValue = new Float64Array(ds.orderCount);
  for (let i = 0; i < ds.orderCount; i++) netValue[i] = o.refunded[i] ? 0 : o.revenue[i];

  const base = { cohortCount, maxOffset: MAX_OFFSET, lastMonth: lastDataMonth - from, customerCohort, orderCustomer: o.customer, orderMonth };
  const matrix = cohortRetention(base);
  const groups = ltvBy === 'segment' ? SEGMENTS : CHANNELS;
  const curves = ltvCurves({ ...base, groupCount: groups.length, customerGroup, orderValue: netValue });

  // New vs returning by calendar month inside the range, for customers passing the filter.
  const monthLabels: string[] = [];
  for (let m = months[rangeStartDay]; m <= to; m++) monthLabels.push(addMonths(`${firstKey}-01`, m).slice(0, 7));
  const nvr = {
    months: monthLabels,
    newRevenue: monthLabels.map(() => 0),
    returningRevenue: monthLabels.map(() => 0),
    newOrders: monthLabels.map(() => 0),
    returningOrders: monthLabels.map(() => 0),
  };
  const passes = (cust: number) => customerGroup[cust] >= 0;
  const rStart = ds.dayStart[rangeStartDay];
  const rEnd = ds.dayStart[rangeEndDay + 1];
  for (let i = rStart; i < rEnd; i++) {
    if (!passes(o.customer[i])) continue;
    const k = months[o.day[i]] - months[rangeStartDay];
    if (o.isNew[i]) {
      nvr.newRevenue[k] += o.revenue[i];
      nvr.newOrders[k]++;
    } else {
      nvr.returningRevenue[k] += o.revenue[i];
      nvr.returningOrders[k]++;
    }
  }

  // RFM snapshot at the end of the range over a trailing 12-month window.
  const windowStart = Math.max(0, rangeEndDay - 364);
  const lastDay = new Int32Array(ds.customerCount).fill(-1);
  const frequency = new Uint16Array(ds.customerCount);
  const monetary = new Float64Array(ds.customerCount);
  for (let i = ds.dayStart[windowStart]; i < rEnd; i++) {
    const cust = o.customer[i];
    if (!passes(cust)) continue;
    lastDay[cust] = o.day[i];
    frequency[cust]++;
    monetary[cust] += netValue[i];
  }
  const rfm = new Map<RfmSegment, { customers: number; revenue: number }>(RFM_SEGMENTS.map((s) => [s.code, { customers: 0, revenue: 0 }]));
  let active = 0;
  let repeaters = 0;
  for (let i = 0; i < ds.customerCount; i++) {
    if (lastDay[i] < 0) continue;
    active++;
    if (frequency[i] > 1) repeaters++;
    const seg = rfmSegment(rangeEndDay - lastDay[i], frequency[i], rangeEndDay - c.firstDay[i]);
    const acc = rfm.get(seg)!;
    acc.customers++;
    acc.revenue += monetary[i];
  }

  return {
    cohorts: {
      months: Array.from({ length: cohortCount }, (_, k) => addMonths(`${firstKey}-01`, from + k).slice(0, 7)),
      sizes: matrix.sizes,
      retention: matrix.retention,
      widened,
    },
    ltv: { groups: groups.map((g) => g.code), curves },
    newVsReturning: nvr,
    rfm: RFM_SEGMENTS.map((s) => ({ code: s.code, ...rfm.get(s.code)! })),
    totals: { customers, activeCustomers: active, repeatRate: active ? repeaters / active : null },
  };
}
