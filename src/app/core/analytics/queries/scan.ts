import { CHANNELS, COUNTRIES, DEVICES } from '../../data/catalog';
import { Dataset } from '../../data/dataset';
import { diffDays, IsoDate } from '../../data/dates';
import { DateRange, rangeLength } from '../date-range';
import { CompiledFilter } from '../filters';
import { emptyTotals, Totals, TOTAL_KEYS } from '../metrics';

/** A date range expressed in dataset day indices, clamped to the data that exists. */
export interface DaySpan {
  /** Day index of the range start (may be negative / beyond the data). */
  readonly origin: number;
  readonly length: number;
  /** Clamped inclusive bounds; `lo > hi` when the range has no data at all. */
  readonly lo: number;
  readonly hi: number;
}

export function daySpan(ds: Dataset, range: DateRange): DaySpan {
  const origin = diffDays(ds.start, range.start);
  const length = rangeLength(range);
  return { origin, length, lo: Math.max(0, origin), hi: Math.min(ds.days - 1, origin + length - 1) };
}

/** Calls `visit(row)` for every order row inside the span that passes the filter. */
export function scanOrders(ds: Dataset, f: CompiledFilter, span: DaySpan, visit: (row: number) => void): void {
  if (span.lo > span.hi) return;
  const o = ds.orders;
  const end = ds.dayStart[span.hi + 1];
  for (let i = ds.dayStart[span.lo]; i < end; i++) {
    if (f.country[o.country[i]] && f.channel[o.channel[i]] && f.device[o.device[i]] && f.category[o.category[i]] && f.segment[o.segment[i]]) {
      visit(i);
    }
  }
}

/** Offsets (within one day of the traffic cube) of the cells allowed by country/channel/device. */
export function allowedTrafficCells(f: CompiledFilter): Int32Array {
  const cells: number[] = [];
  for (let c = 0; c < COUNTRIES.length; c++) {
    if (!f.country[c]) continue;
    for (let ch = 0; ch < CHANNELS.length; ch++) {
      if (!f.channel[ch]) continue;
      for (let dv = 0; dv < DEVICES.length; dv++) {
        if (f.device[dv]) cells.push((c * CHANNELS.length + ch) * DEVICES.length + dv);
      }
    }
  }
  return Int32Array.from(cells);
}

export function scanTraffic(ds: Dataset, f: CompiledFilter, span: DaySpan, visit: (cell: number, day: number) => void): void {
  const cells = allowedTrafficCells(f);
  for (let d = span.lo; d <= span.hi; d++) {
    const base = d * ds.trafficStride;
    for (let k = 0; k < cells.length; k++) visit(base + cells[k], d);
  }
}

/** Daily additive totals over a period; arrays are indexed by day offset within the period. */
export type DailySeries = { readonly start: IsoDate; readonly length: number; readonly coveredDays: number } & {
  readonly [K in keyof Totals]: Float64Array;
};

export function dailySeries(ds: Dataset, f: CompiledFilter, range: DateRange): DailySeries {
  const span = daySpan(ds, range);
  const series = { start: range.start, length: span.length, coveredDays: Math.max(0, span.hi - span.lo + 1) } as {
    start: IsoDate;
    length: number;
    coveredDays: number;
  } & Record<keyof Totals, Float64Array>;
  for (const k of TOTAL_KEYS) series[k] = new Float64Array(span.length);
  const o = ds.orders;
  scanOrders(ds, f, span, (i) => {
    const d = o.day[i] - span.origin;
    series.revenue[d] += o.revenue[i];
    series.orders[d]++;
    series.units[d] += o.qty[i];
    if (o.isNew[i]) series.newCustomers[d]++;
    if (o.refunded[i]) {
      series.refunds[d] += o.revenue[i];
      series.refundedOrders[d]++;
    } else {
      series.cogs[d] += o.cost[i];
    }
  });
  const t = ds.traffic;
  scanTraffic(ds, f, span, (cell, day) => {
    const d = day - span.origin;
    series.sessions[d] += t.sessions[cell];
    series.purchases[d] += t.purchases[cell];
    series.trafficRevenue[d] += t.revenue[cell];
    series.trafficNewCustomers[d] += t.newCustomers[cell];
    series.spend[d] += t.spend[cell];
  });
  return series;
}

export function sumSeries(series: DailySeries, from = 0, to = series.length): Totals {
  const totals = emptyTotals();
  for (const k of TOTAL_KEYS) {
    const arr = series[k];
    let s = 0;
    for (let i = from; i < to; i++) s += arr[i];
    totals[k] = s;
  }
  return totals;
}
