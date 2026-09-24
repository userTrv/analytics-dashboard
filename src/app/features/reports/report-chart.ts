import { PivotConfig } from '../../core/analytics/pivot';
import { PivotQueryResult } from '../../core/analytics/queries/pivot-query';
import { formatMetric } from '../../shared/format/format';
import { ChartOption } from '../../shared/ui/chart/chart-types';
import { memberLabel } from './pivot-export';
import { metricFormat, metricLabel } from './report-config';

const MAX_BARS = 24;
const MAX_STACKS = 8;

/**
 * Bar chart of the top-level rows for the first metric. Additive metrics with ≤ 8 column
 * members are stacked by column; anything else shows the row total (stacking averages or
 * ratios would be meaningless).
 */
export function reportChartOption(result: PivotQueryResult, config: PivotConfig): ChartOption | null {
  const metric = config.metrics[0];
  const m = config.metrics.length;
  const top = result.rows.filter((r) => r.path.length === 1).slice(0, MAX_BARS);
  if (!top.length) return null;
  const labels = top.map((r) => memberLabel(result, config.rows[0], r.path[0]));
  const format = metricFormat(metric);
  const additive = metric.agg === 'sum' || metric.agg === 'count';
  const stack = config.columns && additive && result.colKeys.length <= MAX_STACKS;
  const totalIndex = result.colKeys.length * m;

  const series = stack
    ? result.colKeys.map((key, c) => ({
        name: memberLabel(result, config.columns!, key),
        type: 'bar' as const,
        stack: 'total',
        barMaxWidth: 36,
        itemStyle: { borderRadius: 0 },
        data: top.map((r) => r.values[c * m] ?? 0),
      }))
    : [{ name: metricLabel(metric), type: 'bar' as const, barMaxWidth: 36, data: top.map((r) => r.values[totalIndex] ?? 0) }];

  return {
    grid: { left: 8, right: 16, top: stack ? 40 : 16, bottom: 8, containLabel: true },
    legend: stack ? { top: 0, left: 0, type: 'scroll' } : undefined,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => formatMetric(v as number, format) },
    xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, hideOverlap: false, rotate: labels.length > 6 ? 30 : 0, width: 110, overflow: 'truncate' } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatMetric(v, format, true) } },
    series,
  };
}
