import { Component, computed, model } from '@angular/core';
import { FIELD_AGGREGATIONS, MAX_METRICS, MAX_ROW_DIMENSIONS, PivotConfig, PivotDimension, PivotField, PivotMetric } from '../../../core/analytics/pivot';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AGGREGATION_LABELS, DIMENSION_LABELS, DIMENSIONS, FIELD_LABELS, FIELDS, metricLabel, ReportView } from '../report-config';

/** Form for the pivot definition. Every change produces a new immutable `ReportView`. */
@Component({
  selector: 'app-report-designer',
  imports: [IconComponent],
  templateUrl: './report-designer.component.html',
  styleUrl: './report-designer.component.scss',
})
export class ReportDesignerComponent {
  readonly view = model.required<ReportView>();

  protected readonly dimensions = DIMENSIONS;
  protected readonly dimensionLabels = DIMENSION_LABELS;
  protected readonly fields = FIELDS;
  protected readonly fieldLabels = FIELD_LABELS;
  protected readonly aggLabels = AGGREGATION_LABELS;
  protected readonly fieldAggs = FIELD_AGGREGATIONS;
  protected readonly maxRows = MAX_ROW_DIMENSIONS;
  protected readonly maxMetrics = MAX_METRICS;

  protected readonly config = computed(() => this.view().config);
  protected readonly metricNames = computed(() => this.config().metrics.map(metricLabel));
  protected readonly sortValue = computed(() => {
    const s = this.config().sort;
    return s.by === 'label' ? 'label' : `${s.metric}:${s.dir}`;
  });

  /** A dimension can be used once across rows and columns. */
  protected isUsed(dim: PivotDimension): boolean {
    const c = this.config();
    return c.rows.includes(dim) || c.columns === dim;
  }

  protected setRow(index: number, dim: PivotDimension): void {
    this.patch({ rows: this.config().rows.map((d, i) => (i === index ? dim : d)) });
  }

  protected addRow(): void {
    const next = DIMENSIONS.find((d) => !this.isUsed(d));
    if (next && this.config().rows.length < MAX_ROW_DIMENSIONS) this.patch({ rows: [...this.config().rows, next] });
  }

  protected removeRow(index: number): void {
    if (this.config().rows.length > 1) this.patch({ rows: this.config().rows.filter((_, i) => i !== index) });
  }

  protected moveRow(index: number, by: -1 | 1): void {
    const rows = [...this.config().rows];
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.patch({ rows });
  }

  protected setColumns(value: string): void {
    this.patch({ columns: value ? (value as PivotDimension) : null });
  }

  protected setMetricField(index: number, field: PivotField): void {
    const metric: PivotMetric = { field, agg: FIELD_AGGREGATIONS[field][0] };
    this.patch({ metrics: this.config().metrics.map((m, i) => (i === index ? metric : m)) });
  }

  protected setMetricAgg(index: number, agg: string): void {
    this.patch({ metrics: this.config().metrics.map((m, i) => (i === index ? { ...m, agg: agg as PivotMetric['agg'] } : m)) });
  }

  protected addMetric(): void {
    const used = new Set(this.config().metrics.map((m) => m.field));
    const field = FIELDS.find((f) => !used.has(f)) ?? 'revenue';
    if (this.config().metrics.length < MAX_METRICS) this.patch({ metrics: [...this.config().metrics, { field, agg: FIELD_AGGREGATIONS[field][0] }] });
  }

  protected removeMetric(index: number): void {
    const metrics = this.config().metrics.filter((_, i) => i !== index);
    if (!metrics.length) return;
    const sort = this.config().sort;
    // Keep the sort pointing at the same metric, or fall back to label order.
    const nextSort =
      sort.by === 'metric' ? (sort.metric === index ? { by: 'label' as const } : { ...sort, metric: sort.metric > index ? sort.metric - 1 : sort.metric }) : sort;
    this.patch({ metrics, sort: nextSort });
  }

  protected setSort(value: string): void {
    if (value === 'label') {
      this.patch({ sort: { by: 'label' } });
      return;
    }
    const [metric, dir] = value.split(':');
    this.patch({ sort: { by: 'metric', metric: Number(metric), dir: dir as 'asc' | 'desc' } });
  }

  protected setHeat(heat: boolean): void {
    this.view.update((v) => ({ ...v, heat }));
  }

  protected setChart(on: boolean): void {
    this.view.update((v) => ({ ...v, chart: on ? 'bar' : 'none' }));
  }

  private patch(patch: Partial<PivotConfig>): void {
    this.view.update((v) => ({ ...v, config: { ...v.config, ...patch } }));
  }
}
