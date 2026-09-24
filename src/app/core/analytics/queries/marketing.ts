import { CHANNELS, DEVICES } from '../../data/catalog';
import { Dataset } from '../../data/dataset';
import { compileFilter, QueryFilters } from '../filters';
import { daySpan, scanTraffic } from './scan';

export interface MarketingParams {
  readonly filters: QueryFilters;
}

export interface FunnelTotals {
  sessions: number;
  views: number;
  carts: number;
  checkouts: number;
  purchases: number;
}

export interface ChannelPerformance extends FunnelTotals {
  readonly code: string;
  spend: number;
  revenue: number;
  newCustomers: number;
}

export interface MarketingResult {
  readonly channels: ChannelPerformance[];
  readonly previous: ChannelPerformance[] | null;
  readonly devices: (FunnelTotals & { readonly code: string })[];
  readonly daily: { readonly start: string; readonly spend: Float64Array; readonly revenue: Float64Array };
}

const funnel = (): FunnelTotals => ({ sessions: 0, views: 0, carts: 0, checkouts: 0, purchases: 0 });

function channelTotals(ds: Dataset, filters: QueryFilters, range: QueryFilters['range'], devices?: ReturnType<typeof funnel>[], daily?: { spend: Float64Array; revenue: Float64Array; origin: number }): ChannelPerformance[] {
  const f = compileFilter(filters);
  const out: ChannelPerformance[] = CHANNELS.map((c) => ({ code: c.code, ...funnel(), spend: 0, revenue: 0, newCustomers: 0 }));
  const t = ds.traffic;
  scanTraffic(ds, f, daySpan(ds, range), (cell, day) => {
    const within = cell % ds.trafficStride;
    // Cell layout within a day: (country × channels + channel) × devices + device.
    const ch = Math.floor(within / DEVICES.length) % CHANNELS.length;
    const acc = out[ch];
    acc.sessions += t.sessions[cell];
    acc.views += t.views[cell];
    acc.carts += t.carts[cell];
    acc.checkouts += t.checkouts[cell];
    acc.purchases += t.purchases[cell];
    acc.spend += t.spend[cell];
    acc.revenue += t.revenue[cell];
    acc.newCustomers += t.newCustomers[cell];
    if (devices) {
      const dv = devices[within % DEVICES.length];
      dv.sessions += t.sessions[cell];
      dv.views += t.views[cell];
      dv.carts += t.carts[cell];
      dv.checkouts += t.checkouts[cell];
      dv.purchases += t.purchases[cell];
    }
    if (daily) {
      daily.spend[day - daily.origin] += t.spend[cell];
      daily.revenue[day - daily.origin] += t.revenue[cell];
    }
  });
  return out;
}

/** Marketing works on the traffic cube: dates, geography, channel and device filters apply. */
export function marketingQuery(ds: Dataset, { filters }: MarketingParams): MarketingResult {
  const span = daySpan(ds, filters.range);
  const devices = DEVICES.map(() => funnel());
  const daily = { spend: new Float64Array(span.length), revenue: new Float64Array(span.length), origin: span.origin };
  const channels = channelTotals(ds, filters, filters.range, devices, daily);
  const previous = filters.comparison ? channelTotals(ds, filters, filters.comparison) : null;
  return {
    channels,
    previous,
    devices: DEVICES.map((d, i) => ({ code: d.code, ...devices[i] })),
    daily: { start: filters.range.start, spend: daily.spend, revenue: daily.revenue },
  };
}
