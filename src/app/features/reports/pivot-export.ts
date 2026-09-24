import { CsvCell } from '../../core/analytics/csv';
import { PivotConfig } from '../../core/analytics/pivot';
import { PivotQueryResult } from '../../core/analytics/queries/pivot-query';
import { DIMENSION_LABELS, metricLabel } from './report-config';

export function memberLabel(result: PivotQueryResult, dim: PivotConfig['rows'][number], member: number): string {
  return result.labels[dim]?.[member] ?? String(member);
}

/**
 * Flattens a pivot into a rectangular sheet: one column per row dimension (subtotal rows
 * say "Total"), then one column per (column member × metric), then row totals. Numbers
 * stay numbers so spreadsheets can sum them.
 */
export function pivotToSheet(result: PivotQueryResult, config: PivotConfig): CsvCell[][] {
  const colNames = config.columns ? result.colKeys.map((k) => memberLabel(result, config.columns!, k)) : [];
  const metricNames = config.metrics.map(metricLabel);
  const header: CsvCell[] = [
    ...config.rows.map((d) => DIMENSION_LABELS[d]),
    ...colNames.flatMap((c) => metricNames.map((m) => `${c} · ${m}`)),
    ...metricNames.map((m) => (config.columns ? `Total · ${m}` : m)),
  ];
  const body = result.rows.map((node) => [
    ...config.rows.map((dim, level) => (level < node.path.length ? memberLabel(result, dim, node.path[level]) : level === node.path.length ? 'Total' : '')),
    ...node.values.map(roundCell),
  ]);
  const grand: CsvCell[] = [...config.rows.map((_, i) => (i === 0 ? 'Grand total' : '')), ...result.grandTotal.map(roundCell)];
  return [header, ...body, grand];
}

function roundCell(v: number | null): CsvCell {
  return v === null ? null : Math.round(v * 10_000) / 10_000;
}

export function safeFileName(name: string): string {
  return (name.trim() || 'report').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'report';
}
