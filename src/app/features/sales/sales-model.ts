import { autoGranularity } from '../../core/analytics/date-range';
import { SalesRow } from '../../core/analytics/queries/sales';
import { bucketIndex, sumByBucket } from '../../core/analytics/series';
import { CATEGORIES, PRODUCTS } from '../../core/data/catalog';
import { addDays } from '../../core/data/dates';
import { formatCurrency, formatDelta } from '../../shared/format/format';
import { asParams, ChartOption } from '../../shared/ui/chart/chart-types';
import { bucketLabels } from '../overview/overview-model';

export const labelOfCode = (code: string): string =>
  CATEGORIES.find((c) => c.code === code)?.label ?? PRODUCTS.find((p) => p.code === code)?.label ?? code;

export interface ProductTableRow {
  readonly code: string;
  readonly product: string;
  readonly category: string;
  readonly revenue: number;
  readonly deltaPct: number | null;
  readonly orders: number;
  readonly units: number;
  readonly aov: number | null;
  readonly margin: number | null;
  readonly refundRate: number | null;
  readonly discount: number;
}

export function toProductRows(rows: readonly SalesRow[]): ProductTableRow[] {
  return rows.map((r) => {
    const product = PRODUCTS.find((p) => p.code === r.code);
    const net = r.revenue - r.refunds;
    return {
      code: r.code,
      product: product?.label ?? r.code,
      category: product ? CATEGORIES[product.category].label : '',
      revenue: r.revenue,
      deltaPct: r.prevRevenue ? (r.revenue - r.prevRevenue) / r.prevRevenue : null,
      orders: r.orders,
      units: r.units,
      aov: r.orders ? r.revenue / r.orders : null,
      margin: net ? (net - r.cogs) / net : null,
      refundRate: r.orders ? r.refundedOrders / r.orders : null,
      discount: r.discount,
    };
  });
}

/** Horizontal bars; each bar carries its code so a click can drill down. */
export function breakdownOption(rows: readonly SalesRow[], limit = 12): ChartOption {
  const top = [...rows].filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, limit).reverse();
  return {
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const r = top[asParams<{ dataIndex: number }>(p).dataIndex];
        const change = r.prevRevenue ? (r.revenue - r.prevRevenue) / r.prevRevenue : null;
        return `<b>${labelOfCode(r.code)}</b><br/>${formatCurrency(r.revenue)} · ${r.orders.toLocaleString('en-US')} orders<br/>${formatDelta(change)} vs comparison`;
      },
    },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v, true) } },
    yAxis: { type: 'category', data: top.map((r) => labelOfCode(r.code)), axisLabel: { width: 130, overflow: 'truncate' } },
    series: [
      {
        type: 'bar',
        data: top.map((r) => ({ value: r.revenue, code: r.code })),
        barMaxWidth: 20,
        cursor: 'pointer',
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: (p) => formatCurrency(asParams<{ value: number }>(p).value, true) },
      },
    ],
  };
}

export function trendOption(trend: readonly { code: string; values: Float64Array }[], start: string): ChartOption {
  const length = trend[0]?.values.length ?? 0;
  const granularity = autoGranularity({ start, end: addDays(start, Math.max(0, length - 1)) });
  const bucket = bucketIndex(start, length, granularity);
  return {
    grid: { left: 8, right: 16, top: 64, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, type: 'scroll' },
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatCurrency(v as number) },
    xAxis: { type: 'category', data: bucketLabels(bucket, granularity), boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v, true) } },
    series: trend.map((t) => ({
      name: labelOfCode(t.code),
      type: 'line' as const,
      stack: 'total',
      areaStyle: { opacity: 0.55 },
      lineStyle: { width: 1 },
      emphasis: { focus: 'series' as const },
      data: sumByBucket(t.values, bucket),
    })),
  };
}
