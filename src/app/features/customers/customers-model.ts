import { CustomersResult } from '../../core/analytics/queries/customers';
import { RFM_SEGMENTS } from '../../core/analytics/rfm';
import { CHANNELS, SEGMENTS } from '../../core/data/catalog';
import { Theme } from '../../core/state/theme.service';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../../shared/format/format';
import { SEQUENTIAL_BLUE } from '../../shared/ui/chart/chart-theme';
import { asParams, ChartOption } from '../../shared/ui/chart/chart-types';

/** Cohort × months-since-first-order heatmap; unknown (future) cells are simply absent. */
export function cohortHeatmapOption(c: CustomersResult['cohorts'], theme: Theme): ChartOption {
  const yLabels = c.months.map((m, i) => `${formatDate(m, 'month')}  (${formatNumber(c.sizes[i])})`);
  const width = c.retention[0]?.length ?? 0;
  const cells: [number, number, number][] = [];
  let max = 0;
  c.retention.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v === null || x === 0) return; // month 0 is 100 % by definition, so it is not drawn
      cells.push([x - 1, y, v]);
      max = Math.max(max, v);
    }),
  );
  const top = Math.max(0.05, max);
  const textDark = theme === 'dark' ? '#f5f5f3' : '#0b0b0b';
  // Light text on the darker half of the ramp keeps labels readable.
  const data = cells.map(([x, y, v]) => ({ value: [x, y, v], label: { color: v / top > 0.5 ? '#ffffff' : '#0b0b0b' } }));
  return {
    grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
    tooltip: {
      formatter: (p) => {
        const [x, y, v] = asParams<{ value: [number, number, number] }>(p).value;
        return `<b>${formatDate(c.months[y], 'month')} cohort</b><br/>Month ${x + 1}: ${formatPercent(v)} of ${formatNumber(c.sizes[y])} customers ordered again`;
      },
    },
    xAxis: { type: 'category', data: Array.from({ length: width - 1 }, (_, i) => `M${i + 1}`), name: 'Months since first order', nameLocation: 'middle', nameGap: 28, splitArea: { show: false } },
    yAxis: { type: 'category', data: yLabels, inverse: true, axisLabel: { fontSize: 11 } },
    visualMap: {
      min: 0,
      max: top,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 160,
      itemWidth: 10,
      text: ['more retained', 'fewer'],
      textStyle: { fontSize: 11 },
      inRange: { color: [...SEQUENTIAL_BLUE] },
      formatter: (v) => formatPercent(v as number, 0),
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontSize: 10,
          formatter: (p) => formatPercent(asParams<{ value: [number, number, number] }>(p).value[2], 0),
        },
        itemStyle: { borderColor: 'transparent', borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: textDark, borderWidth: 1 } },
      },
    ],
  };
}

export function ltvOption(ltv: CustomersResult['ltv'], by: 'segment' | 'channel'): ChartOption {
  const members = by === 'segment' ? SEGMENTS : CHANNELS;
  const width = ltv.curves[0]?.length ?? 0;
  return {
    grid: { left: 8, right: 16, top: 56, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatCurrency(v as number) },
    xAxis: { type: 'category', data: Array.from({ length: width }, (_, i) => `M${i}`), boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v, true) } },
    series: ltv.groups.map((code, i) => ({
      name: members.find((m) => m.code === code)?.label ?? code,
      type: 'line' as const,
      data: ltv.curves[i],
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,
      connectNulls: false,
    })),
  };
}

export function newVsReturningOption(n: CustomersResult['newVsReturning']): ChartOption {
  return {
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => formatCurrency(v as number) },
    xAxis: { type: 'category', data: n.months.map((m) => formatDate(m, 'month')) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v, true) } },
    series: [
      { name: 'New customers', type: 'bar', stack: 'r', data: n.newRevenue, barMaxWidth: 32, itemStyle: { borderRadius: 0 } },
      { name: 'Returning customers', type: 'bar', stack: 'r', data: n.returningRevenue, barMaxWidth: 32, itemStyle: { borderRadius: [3, 3, 0, 0] } },
    ],
  };
}

export function rfmOption(rfm: CustomersResult['rfm']): ChartOption {
  const total = rfm.reduce((s, r) => s + r.customers, 0) || 1;
  const label = (code: string) => RFM_SEGMENTS.find((s) => s.code === code)?.label ?? code;
  const rows = [...rfm].reverse();
  return {
    grid: { left: 8, right: 80, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const row = rows[asParams<{ dataIndex: number }>(p).dataIndex];
        const rule = RFM_SEGMENTS.find((s) => s.code === row.code)?.rule ?? '';
        return `<b>${label(row.code)}</b> — ${rule}<br/>${formatNumber(row.customers)} customers (${formatPercent(row.customers / total)})<br/>12-month net revenue ${formatCurrency(row.revenue)}`;
      },
    },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumber(v, true) } },
    yAxis: { type: 'category', data: rows.map((r) => label(r.code)) },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => r.customers),
        barMaxWidth: 20,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: (p) => formatPercent(asParams<{ value: number }>(p).value / total, 0) },
      },
    ],
  };
}
