import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES } from '../../data/catalog';
import { Dataset } from '../../data/dataset';
import { addDays } from '../../data/dates';
import { Anomaly, detectAnomalies } from '../anomalies';
import { compileFilter, CompiledFilter, QueryFilters } from '../filters';
import { Driver, findDriver, findMovers, Insight } from '../insights';
import { DailySeries, dailySeries, daySpan, scanOrders, sumSeries } from './scan';

export interface OverviewParams {
  readonly filters: QueryFilters;
}

export interface BreakdownValue {
  readonly code: string;
  readonly revenue: number;
  readonly prevRevenue: number;
  readonly orders: number;
  readonly netRevenue: number;
  readonly cogs: number;
}

export interface OverviewResult {
  readonly current: DailySeries;
  readonly comparison: DailySeries | null;
  /** Daily revenue per channel over the current period, in catalogue order. */
  readonly channelRevenue: Float64Array[];
  readonly categories: BreakdownValue[];
  readonly countries: BreakdownValue[];
  readonly anomalies: Anomaly[];
  readonly insights: Insight[];
}

const ANOMALY_WINDOW = 28;
const NCH = CHANNELS.length;
const NC = COUNTRIES.length;
const ND = DEVICES.length;

interface PeriodBreakdown {
  channel: Float64Array;
  category: Float64Array;
  categoryNet: Float64Array;
  categoryCogs: Float64Array;
  categoryOrders: Float64Array;
  country: Float64Array;
  countryOrders: Float64Array;
  /** Revenue per (channel, country, device) — used to explain channel movers. */
  cube: Float64Array;
}

function breakdown(ds: Dataset, f: CompiledFilter, filters: QueryFilters, which: 'range' | 'comparison'): PeriodBreakdown {
  const out: PeriodBreakdown = {
    channel: new Float64Array(NCH),
    category: new Float64Array(CATEGORIES.length),
    categoryNet: new Float64Array(CATEGORIES.length),
    categoryCogs: new Float64Array(CATEGORIES.length),
    categoryOrders: new Float64Array(CATEGORIES.length),
    country: new Float64Array(NC),
    countryOrders: new Float64Array(NC),
    cube: new Float64Array(NCH * NC * ND),
  };
  const range = which === 'range' ? filters.range : filters.comparison;
  if (!range) return out;
  const o = ds.orders;
  scanOrders(ds, f, daySpan(ds, range), (i) => {
    const rev = o.revenue[i];
    const cat = o.category[i];
    out.channel[o.channel[i]] += rev;
    out.category[cat] += rev;
    out.categoryOrders[cat]++;
    if (!o.refunded[i]) {
      out.categoryNet[cat] += rev;
      out.categoryCogs[cat] += o.cost[i];
    }
    out.country[o.country[i]] += rev;
    out.countryOrders[o.country[i]]++;
    out.cube[(o.channel[i] * NC + o.country[i]) * ND + o.device[i]] += rev;
  });
  return out;
}

/**
 * Two-step driver search for a channel's revenue change: first the single device or country
 * that explains most of it, then — inside that member — the best member of the other
 * dimension, kept only if it still explains a large share of the total.
 */
function explainChannelChange(ch: number, delta: number, cur: Float64Array, prev: Float64Array): Driver | null {
  const cellDelta = (c: number, d: number) => cur[(ch * NC + c) * ND + d] - prev[(ch * NC + c) * ND + d];
  const sum = (count: number, f: (i: number) => number) => Array.from({ length: count }, (_, i) => f(i)).reduce((a, b) => a + b, 0);
  const byDevice = DEVICES.map((dv, d) => ({ members: [dv.code], delta: sum(NC, (c) => cellDelta(c, d)) }));
  const byCountry = COUNTRIES.map((co, c) => ({ members: [co.code], delta: sum(ND, (d) => cellDelta(c, d)) }));
  const device = findDriver(delta, byDevice);
  const country = findDriver(delta, byCountry);
  const first = device && (!country || device.share >= country.share) ? device : country;
  if (!first) return null;

  const second =
    first === device
      ? findDriver(delta, COUNTRIES.map((co, c) => ({ members: [first.members[0], co.code], delta: cellDelta(c, DEVICES.findIndex((x) => x.code === first.members[0])) })))
      : findDriver(delta, DEVICES.map((dv, d) => ({ members: [first.members[0], dv.code], delta: cellDelta(COUNTRIES.findIndex((x) => x.code === first.members[0]), d) })));
  return second ?? first;
}

function buildInsights(cur: PeriodBreakdown, prev: PeriodBreakdown, current: DailySeries, comparison: DailySeries, anomalies: Anomaly[]): Insight[] {
  const insights: Insight[] = [];
  const curTotal = sumSeries(current).revenue;
  const prevTotal = sumSeries(comparison).revenue;
  if (prevTotal > 0) insights.push({ kind: 'total', current: curTotal, previous: prevTotal, pct: (curTotal - prevTotal) / prevTotal });

  const channelMovers = findMovers(CHANNELS.map((c, i) => ({ code: c.code, current: cur.channel[i], previous: prev.channel[i] })));
  const negative = channelMovers.find((m) => m.current < m.previous);
  const positive = channelMovers.find((m) => m.current > m.previous);
  for (const mover of [negative, positive]) {
    if (!mover) continue;
    const ch = CHANNELS.findIndex((c) => c.code === mover.code);
    const delta = mover.current - mover.previous;
    insights.push({
      kind: 'mover',
      dimension: 'channel',
      member: mover.code,
      current: mover.current,
      previous: mover.previous,
      pct: delta / mover.previous,
      driver: explainChannelChange(ch, delta, cur.cube, prev.cube),
    });
  }

  const categoryMover = findMovers(CATEGORIES.map((c, i) => ({ code: c.code, current: cur.category[i], previous: prev.category[i] })), 0.08)[0];
  if (categoryMover) {
    insights.push({
      kind: 'mover',
      dimension: 'category',
      member: categoryMover.code,
      current: categoryMover.current,
      previous: categoryMover.previous,
      pct: (categoryMover.current - categoryMover.previous) / categoryMover.previous,
      driver: null,
    });
  }

  [...anomalies]
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 2)
    .forEach((anomaly) => insights.push({ kind: 'anomaly', anomaly }));
  return insights;
}

export function overviewQuery(ds: Dataset, { filters }: OverviewParams): OverviewResult {
  const f = compileFilter(filters);
  const current = dailySeries(ds, f, filters.range);
  const comparison = filters.comparison ? dailySeries(ds, f, filters.comparison) : null;

  const span = daySpan(ds, filters.range);
  const channelRevenue = CHANNELS.map(() => new Float64Array(span.length));
  const o = ds.orders;
  scanOrders(ds, f, span, (i) => {
    channelRevenue[o.channel[i]][o.day[i] - span.origin] += o.revenue[i];
  });

  // Look-back history so the first days of the range have a full baseline window.
  const history = dailySeries(ds, f, { start: addDays(filters.range.start, -ANOMALY_WINDOW), end: filters.range.end });
  const anomalies = detectAnomalies(history.start, history.revenue, { window: ANOMALY_WINDOW, threshold: 3 });

  const cur = breakdown(ds, f, filters, 'range');
  const prev = breakdown(ds, f, filters, 'comparison');
  const toBreakdown = (codes: readonly { code: string }[], rev: Float64Array, prevRev: Float64Array, orders: Float64Array, net?: Float64Array, cogs?: Float64Array): BreakdownValue[] =>
    codes.map((m, i) => ({ code: m.code, revenue: rev[i], prevRevenue: prevRev[i], orders: orders[i], netRevenue: net?.[i] ?? 0, cogs: cogs?.[i] ?? 0 }));

  return {
    current,
    comparison,
    channelRevenue,
    categories: toBreakdown(CATEGORIES, cur.category, prev.category, cur.categoryOrders, cur.categoryNet, cur.categoryCogs),
    countries: toBreakdown(COUNTRIES, cur.country, prev.country, cur.countryOrders),
    anomalies,
    insights: comparison ? buildInsights(cur, prev, current, comparison, anomalies) : [...anomalies].slice(0, 2).map((anomaly) => ({ kind: 'anomaly' as const, anomaly })),
  };
}
