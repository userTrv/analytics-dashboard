import { autoGranularity } from '../../core/analytics/date-range';
import { cac, conversionRate, delta, ratio, roas } from '../../core/analytics/metrics';
import { ChannelPerformance, FunnelTotals, MarketingResult } from '../../core/analytics/queries/marketing';
import { bucketIndex, sumByBucket } from '../../core/analytics/series';
import { CHANNELS, DEVICES } from '../../core/data/catalog';
import { addDays } from '../../core/data/dates';
import { Theme } from '../../core/state/theme.service';
import { formatCurrency, formatNumber, formatPercent, formatRatio } from '../../shared/format/format';
import { SERIES_COLORS } from '../../shared/ui/chart/chart-theme';
import { asParams, ChartOption } from '../../shared/ui/chart/chart-types';
import { KpiView } from '../../shared/ui/kpi-card/kpi-card.component';
import { bucketLabels } from '../overview/overview-model';

export const FUNNEL_STEPS: readonly { key: keyof FunnelTotals; label: string }[] = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'views', label: 'Product views' },
  { key: 'carts', label: 'Add to cart' },
  { key: 'checkouts', label: 'Checkout' },
  { key: 'purchases', label: 'Purchase' },
];

const channelLabel = (code: string) => CHANNELS.find((c) => c.code === code)?.label ?? code;
const deviceLabel = (code: string) => DEVICES.find((d) => d.code === code)?.label ?? code;

type Totals = Pick<ChannelPerformance, 'spend' | 'revenue' | 'newCustomers' | 'sessions' | 'purchases'>;

function sum(rows: readonly ChannelPerformance[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({ spend: t.spend + r.spend, revenue: t.revenue + r.revenue, newCustomers: t.newCustomers + r.newCustomers, sessions: t.sessions + r.sessions, purchases: t.purchases + r.purchases }),
    { spend: 0, revenue: 0, newCustomers: 0, sessions: 0, purchases: 0 },
  );
}

const asMetricTotals = (t: Totals) => ({ spend: t.spend, trafficRevenue: t.revenue, trafficNewCustomers: t.newCustomers, sessions: t.sessions, purchases: t.purchases });

export function marketingKpis(r: MarketingResult): KpiView[] {
  const cur = asMetricTotals(sum(r.channels));
  const prev = r.previous ? asMetricTotals(sum(r.previous)) : null;
  const make = (id: string, label: string, format: KpiView['format'], better: 'up' | 'down', fn: (t: typeof cur) => number | null, hint: string): KpiView => {
    const value = fn(cur);
    const previous = prev ? fn(prev) : null;
    return { id, label, format, better, value, previous, deltaPct: delta(value, previous).pct, spark: [], hint };
  };
  return [
    make('spend', 'Marketing spend', 'currency', 'down', (t) => t.spend, 'Ad and programme costs across channels'),
    make('roas', 'ROAS', 'ratio', 'up', roas, 'Revenue ÷ spend'),
    make('cac', 'CAC', 'currency', 'down', cac, 'Spend ÷ new customers'),
    make('cr', 'Conversion rate', 'percent', 'up', conversionRate, 'Purchases ÷ sessions'),
  ];
}

export function spendRevenueOption(r: MarketingResult): ChartOption {
  const rows = r.channels;
  return {
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => formatCurrency(v as number) },
    xAxis: { type: 'category', data: rows.map((c) => channelLabel(c.code)), axisLabel: { interval: 0, overflow: 'break', width: 80 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v, true) } },
    series: [
      { name: 'Spend', type: 'bar', data: rows.map((c) => c.spend), barGap: '8%', barMaxWidth: 26 },
      { name: 'Revenue', type: 'bar', data: rows.map((c) => c.revenue), barMaxWidth: 26 },
    ],
  };
}

export function roasOption(r: MarketingResult, theme: Theme): ChartOption {
  const rows = [...r.channels].map((c) => ({ code: c.code, roas: ratio(c.revenue, c.spend) ?? 0, cac: ratio(c.spend, c.newCustomers) })).sort((a, b) => a.roas - b.roas);
  return {
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const row = rows[asParams<{ dataIndex: number }>(p).dataIndex];
        return `<b>${channelLabel(row.code)}</b><br/>ROAS ${formatRatio(row.roas)}<br/>CAC ${formatCurrency(row.cac)}`;
      },
    },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${v}×` } },
    yAxis: { type: 'category', data: rows.map((x) => channelLabel(x.code)) },
    series: [
      {
        type: 'bar',
        data: rows.map((x) => x.roas),
        barMaxWidth: 18,
        color: SERIES_COLORS[theme][2],
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: (p) => formatRatio(asParams<{ value: number }>(p).value) },
        markLine: { symbol: 'none', silent: true, data: [{ xAxis: 1, name: 'Break-even' }], lineStyle: { type: 'dashed', color: SERIES_COLORS[theme][7] }, label: { show: false } },
      },
    ],
  };
}

export function spendTrendOption(r: MarketingResult): ChartOption {
  const length = r.daily.spend.length;
  const granularity = autoGranularity({ start: r.daily.start, end: addDays(r.daily.start, Math.max(0, length - 1)) });
  const bucket = bucketIndex(r.daily.start, length, granularity);
  return {
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatCurrency(v as number) },
    xAxis: { type: 'category', data: bucketLabels(bucket, granularity), boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v, true) } },
    series: [
      { name: 'Spend', type: 'line', data: sumByBucket(r.daily.spend, bucket) },
      { name: 'Revenue', type: 'line', data: sumByBucket(r.daily.revenue, bucket), areaStyle: { opacity: 0.08 } },
    ],
  };
}

/** Ordinal blue ramp (one hue, light → dark); every step clears 2:1 on both surfaces. */
const FUNNEL_RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#184f95'];

export function funnelOption(totals: FunnelTotals): ChartOption {
  const top = totals.sessions || 1;
  const ramp = FUNNEL_RAMP;
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const { dataIndex, value } = asParams<{ dataIndex: number; value: number }>(p);
        const prev = dataIndex === 0 ? null : totals[FUNNEL_STEPS[dataIndex - 1].key];
        return `<b>${FUNNEL_STEPS[dataIndex].label}</b><br/>${formatNumber(value)} (${formatPercent(value / top)} of sessions)${prev ? `<br/>Step conversion ${formatPercent(value / prev)}` : ''}`;
      },
    },
    series: [
      {
        type: 'funnel',
        sort: 'none',
        left: '4%',
        width: '62%',
        top: 8,
        bottom: 8,
        minSize: '8%',
        gap: 3,
        // Widths are linear with a floor (minSize) so the last steps stay visible; labels carry exact numbers.
        data: FUNNEL_STEPS.map((s, i) => ({ name: s.label, value: totals[s.key], itemStyle: { color: ramp[i] } })),
        label: {
          position: 'right',
          formatter: (p) => {
            const { dataIndex, value } = asParams<{ dataIndex: number; value: number }>(p);
            const prev = dataIndex === 0 ? null : totals[FUNNEL_STEPS[dataIndex - 1].key];
            return `${FUNNEL_STEPS[dataIndex].label}  ${formatNumber(value, true)}${prev ? `  (${formatPercent(value / prev)})` : ''}`;
          },
        },
        labelLine: { show: true, length: 12 },
        itemStyle: { borderWidth: 0 },
      },
    ],
  };
}

export interface ConversionRow {
  readonly code: string;
  readonly label: string;
  readonly steps: (number | null)[];
  readonly overall: number | null;
}

/** Step-to-step conversion per channel or device — where in the funnel users drop off. */
export function conversionMatrix(r: MarketingResult, by: 'channel' | 'device'): ConversionRow[] {
  const rows: (FunnelTotals & { code: string })[] = by === 'channel' ? r.channels : r.devices;
  return rows.map((row) => ({
    code: row.code,
    label: by === 'channel' ? channelLabel(row.code) : deviceLabel(row.code),
    steps: FUNNEL_STEPS.slice(1).map((s, i) => ratio(row[s.key], row[FUNNEL_STEPS[i].key])),
    overall: ratio(row.purchases, row.sessions),
  }));
}
