import { MetricFormat } from '../../core/analytics/metrics';
import {
  Aggregation,
  FIELD_AGGREGATIONS,
  MAX_METRICS,
  MAX_ROW_DIMENSIONS,
  PivotConfig,
  PivotDimension,
  PivotField,
  PivotMetric,
  PivotSort,
} from '../../core/analytics/pivot';

export type ReportChart = 'none' | 'bar';

/** Everything that defines a report view besides the global filters. */
export interface ReportView {
  readonly config: PivotConfig;
  readonly heat: boolean;
  readonly chart: ReportChart;
}

export const DIMENSION_LABELS: Readonly<Record<PivotDimension, string>> = {
  region: 'Region',
  country: 'Country',
  channel: 'Channel',
  device: 'Device',
  category: 'Category',
  product: 'Product',
  segment: 'Segment',
  customerType: 'Customer type',
  year: 'Year',
  quarter: 'Quarter',
  month: 'Month',
  weekday: 'Weekday',
};

export const FIELD_LABELS: Readonly<Record<PivotField, string>> = {
  revenue: 'Revenue',
  margin: 'Gross profit',
  cost: 'COGS',
  discount: 'Discounts',
  units: 'Units',
  orders: 'Orders',
  customers: 'Customers',
  marginPct: 'Margin %',
  refundRate: 'Refund rate',
};

export const AGGREGATION_LABELS: Readonly<Record<Aggregation, string>> = {
  sum: 'Sum',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
  count: 'Count',
  distinct: 'Distinct count',
  ratio: 'Ratio',
};

export const DIMENSIONS = Object.keys(DIMENSION_LABELS) as PivotDimension[];
export const FIELDS = Object.keys(FIELD_LABELS) as PivotField[];

export function metricLabel(m: PivotMetric): string {
  const field = FIELD_LABELS[m.field];
  return m.agg === 'count' || m.agg === 'ratio' || m.agg === 'distinct' ? field : `${field} (${AGGREGATION_LABELS[m.agg].toLowerCase()})`;
}

export function metricFormat(m: PivotMetric): MetricFormat {
  if (m.field === 'marginPct' || m.field === 'refundRate') return 'percent';
  if (m.field === 'units' || m.field === 'orders' || m.field === 'customers') return 'number';
  return 'currency';
}

export const DEFAULT_REPORT: ReportView = {
  config: {
    rows: ['region', 'channel'],
    columns: 'quarter',
    metrics: [
      { field: 'revenue', agg: 'sum' },
      { field: 'orders', agg: 'count' },
    ],
    sort: { by: 'metric', metric: 0, dir: 'desc' },
  },
  heat: true,
  chart: 'bar',
};

// ---------------------------------------------------------------------------------------
// URL (de)serialisation. Compact and human-readable, e.g.
//   rows=region.channel&cols=quarter&m=revenue:sum,orders:count&sort=m0:desc&heat=1&chart=bar
// ---------------------------------------------------------------------------------------

export const REPORT_PARAM_KEYS = ['rows', 'cols', 'm', 'sort', 'heat', 'chart'] as const;

export function reportToParams(view: ReportView): Record<string, string> {
  const { config } = view;
  return {
    rows: config.rows.join('.'),
    cols: config.columns ?? '',
    m: config.metrics.map((m) => `${m.field}:${m.agg}`).join(','),
    sort: config.sort.by === 'label' ? 'label' : `m${config.sort.metric}:${config.sort.dir}`,
    heat: view.heat ? '1' : '0',
    chart: view.chart,
  };
}

const isDimension = (v: string): v is PivotDimension => (DIMENSIONS as string[]).includes(v);

/** Parses untrusted params; anything invalid falls back to the default piece by piece. */
export function reportFromParams(params: Readonly<Record<string, string | undefined | null>>): ReportView {
  if (!params['rows'] && !params['m'] && !params['cols']) return DEFAULT_REPORT;

  const rows = [...new Set((params['rows'] ?? '').split('.').filter(isDimension))].slice(0, MAX_ROW_DIMENSIONS);
  const colsParam = params['cols'] ?? '';
  const columns = isDimension(colsParam) && !rows.includes(colsParam) ? colsParam : null;

  const metrics: PivotMetric[] = [];
  for (const token of (params['m'] ?? '').split(',')) {
    const [field, agg] = token.split(':') as [PivotField, Aggregation];
    if (FIELD_AGGREGATIONS[field]?.includes(agg) && !metrics.some((m) => m.field === field && m.agg === agg)) metrics.push({ field, agg });
  }
  const finalMetrics = metrics.length ? metrics.slice(0, MAX_METRICS) : DEFAULT_REPORT.config.metrics;

  let sort: PivotSort = { by: 'label' };
  const match = /^m(\d):(asc|desc)$/.exec(params['sort'] ?? '');
  if (match && Number(match[1]) < finalMetrics.length) sort = { by: 'metric', metric: Number(match[1]), dir: match[2] as 'asc' | 'desc' };

  return {
    config: { rows: rows.length ? rows : DEFAULT_REPORT.config.rows, columns, metrics: finalMetrics, sort },
    heat: params['heat'] !== '0',
    chart: params['chart'] === 'none' ? 'none' : 'bar',
  };
}
