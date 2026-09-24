import { Anomaly } from '../../core/analytics/anomalies';
import { Granularity } from '../../core/analytics/date-range';
import { delta, KPI_DEFINITIONS } from '../../core/analytics/metrics';
import { BreakdownValue } from '../../core/analytics/queries/overview';
import { DailySeries, sumSeries } from '../../core/analytics/queries/scan';
import { BucketIndex, bucketIndex, bucketTotals, sumByBucket, trailingBlocks } from '../../core/analytics/series';
import { CATEGORIES, CHANNELS, COUNTRIES, REGIONS } from '../../core/data/catalog';
import { Theme } from '../../core/state/theme.service';
import { formatCurrency, formatDate, formatDelta } from '../../shared/format/format';
import { SERIES_COLORS } from '../../shared/ui/chart/chart-theme';
import { asParams, ChartOption } from '../../shared/ui/chart/chart-types';
import { KpiView } from '../../shared/ui/kpi-card/kpi-card.component';

export const TRAFFIC_CAVEAT = 'Category/segment filters don’t apply';

/** KPI cards: totals, comparison deltas and a ≤ ~30-point sparkline per metric. */
export function buildKpis(current: DailySeries, comparison: DailySeries | null, trafficCaveat: boolean): KpiView[] {
  const cur = sumSeries(current);
  const prev = comparison && comparison.coveredDays > 0 ? sumSeries(comparison) : null;
  const spark = bucketTotals(current, trailingBlocks(current.start, current.length, Math.max(1, Math.ceil(current.length / 30))));
  return KPI_DEFINITIONS.map((def) => {
    const value = def.value(cur);
    const previous = prev ? def.value(prev) : null;
    return {
      id: def.id,
      label: def.label,
      format: def.format,
      value,
      previous,
      deltaPct: delta(value, previous).pct,
      better: def.better,
      spark: spark.map((t) => def.value(t) ?? 0),
      hint: def.hint,
      caveat: def.trafficBased && trafficCaveat ? TRAFFIC_CAVEAT : null,
    };
  });
}

export function bucketLabel(date: string, granularity: Granularity): string {
  return granularity === 'month' ? formatDate(date, 'month') : formatDate(date, 'day');
}

/** Axis labels; buckets only partly inside the range get an asterisk. */
export function bucketLabels(bucket: BucketIndex, granularity: Granularity): string[] {
  return bucket.labels.map((d, i) => bucketLabel(d, granularity) + (bucket.partial[i] ? '*' : ''));
}

export function partialNote(start: string, length: number, granularity: Granularity): string | null {
  return bucketIndex(start, length, granularity).partial.some(Boolean) ? `* partial ${granularity}` : null;
}

const currencyAxis = { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true) } };

export function revenueTrendOption(current: DailySeries, comparison: DailySeries | null, granularity: Granularity, anomalies: readonly Anomaly[], theme: Theme): ChartOption {
  const bucket = bucketIndex(current.start, current.length, granularity);
  const labels = bucketLabels(bucket, granularity);
  const revenue = sumByBucket(current.revenue, bucket);
  // Comparison is aligned by day offset, so bucket i compares like-for-like days.
  const previous = comparison ? sumByBucket(comparison.revenue, bucket) : null;
  const colors = SERIES_COLORS[theme];
  const anomalyPoints =
    granularity === 'day'
      ? anomalies.map((a) => ({
          name: a.date,
          coord: [labels[bucket.labels.indexOf(a.date)], a.value],
          value: a.direction === 'spike' ? '▲' : '▼',
          itemStyle: { color: a.direction === 'spike' ? colors[2] : colors[7] },
        }))
      : [];
  return {
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v) => formatCurrency(v as number),
    },
    xAxis: { type: 'category', data: labels, boundaryGap: false },
    yAxis: currencyAxis,
    series: [
      {
        name: 'Revenue',
        type: 'line',
        data: revenue,
        color: colors[0],
        areaStyle: { opacity: 0.12 },
        lineStyle: { width: 2 },
        markPoint: anomalyPoints.length
          ? { symbol: 'pin', symbolSize: 34, label: { fontSize: 10, color: '#fff' }, data: anomalyPoints }
          : undefined,
      },
      ...(previous
        ? [{ name: 'Comparison period', type: 'line' as const, data: previous, color: colors[1], lineStyle: { width: 1.5, type: 'dashed' as const } }]
        : []),
    ],
  };
}

export function channelMixOption(start: string, length: number, channelRevenue: readonly Float64Array[], granularity: Granularity): ChartOption {
  const bucket = bucketIndex(start, length, granularity);
  return {
    grid: { left: 8, right: 8, top: 56, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => formatCurrency(v as number) },
    xAxis: { type: 'category', data: bucketLabels(bucket, granularity) },
    yAxis: currencyAxis,
    // Every channel is always a series, so a channel keeps its colour whatever the filters.
    series: CHANNELS.map((c, i) => ({
      name: c.label,
      type: 'bar' as const,
      stack: 'revenue',
      barMaxWidth: 28,
      data: sumByBucket(channelRevenue[i], bucket),
      itemStyle: { borderRadius: 0, borderColor: 'transparent', borderWidth: 0 },
      emphasis: { focus: 'series' as const },
    })),
  };
}

export function categoryOption(categories: readonly BreakdownValue[]): ChartOption {
  const rows = [...categories].filter((c) => c.revenue > 0).sort((a, b) => a.revenue - b.revenue);
  const label = (code: string) => CATEGORIES.find((c) => c.code === code)?.label ?? code;
  return {
    grid: { left: 8, right: 72, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const row = rows[asParams<{ dataIndex: number }>(p).dataIndex];
        const margin = row.netRevenue ? (row.netRevenue - row.cogs) / row.netRevenue : null;
        return `<b>${label(row.code)}</b><br/>Revenue ${formatCurrency(row.revenue)} (${formatDelta(delta(row.revenue, row.prevRevenue).pct)})<br/>Gross margin ${margin === null ? '—' : (margin * 100).toFixed(1) + ' %'}<br/><span style="opacity:.7">Click to drill down</span>`;
      },
    },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v, true) } },
    yAxis: { type: 'category', data: rows.map((r) => label(r.code)), axisLabel: { width: 120, overflow: 'truncate' } },
    series: [
      {
        type: 'bar',
        name: 'Revenue',
        data: rows.map((r) => ({ value: r.revenue, code: r.code })),
        barMaxWidth: 22,
        cursor: 'pointer',
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: (p) => formatCurrency(asParams<{ value: number }>(p).value, true) },
      },
    ],
  };
}

export function geographyOption(countries: readonly BreakdownValue[], theme: Theme): ChartOption {
  const colors = SERIES_COLORS[theme];
  const data = REGIONS.map((region, ri) => {
    const children = COUNTRIES.map((c, ci) => ({ c, v: countries[ci] }))
      .filter(({ c, v }) => c.region === ri && v.revenue > 0)
      .map(({ c, v }) => ({ name: c.label, value: v.revenue, prev: v.prevRevenue }));
    return {
      name: region.label,
      value: children.reduce((s, x) => s + x.value, 0),
      prev: children.reduce((s, x) => s + x.prev, 0),
      itemStyle: { color: colors[ri] },
      children,
    };
  }).filter((r) => r.value > 0);
  return {
    tooltip: {
      formatter: (p) => {
        const d = asParams<{ data: { name: string; value: number; prev: number } }>(p).data;
        return `<b>${d.name}</b><br/>${formatCurrency(d.value)} · ${formatDelta(delta(d.value, d.prev).pct)} vs comparison`;
      },
    },
    series: [
      {
        type: 'treemap',
        data,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        leafDepth: 2,
        upperLabel: { show: true, height: 22, color: '#fff', fontWeight: 600, textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowBlur: 3 },
        label: {
          show: true,
          formatter: (p) => `${asParams<{ name: string }>(p).name}\n${formatCurrency(asParams<{ value: number }>(p).value, true)}`,
          fontSize: 12,
          color: '#fff',
          textShadowColor: 'rgba(0, 0, 0, 0.55)',
          textShadowBlur: 3,
        },
        itemStyle: { borderColor: 'transparent', gapWidth: 2, borderRadius: 4 },
        levels: [{ itemStyle: { gapWidth: 3 } }, { colorSaturation: [0.35, 0.6], itemStyle: { gapWidth: 2, borderColorSaturation: 0.6 } }],
      },
    ],
  };
}
