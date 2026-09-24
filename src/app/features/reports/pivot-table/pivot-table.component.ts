import { Component, computed, input, linkedSignal } from '@angular/core';
import { PivotConfig, PivotNode } from '../../../core/analytics/pivot';
import { PivotQueryResult } from '../../../core/analytics/queries/pivot-query';
import { formatMetric } from '../../../shared/format/format';
import { columnExtent, heatBackground, heatLevel } from '../../../shared/format/heat';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { memberLabel } from '../pivot-export';
import { DIMENSION_LABELS, metricFormat, metricLabel } from '../report-config';

interface VisibleRow {
  readonly key: string;
  readonly node: PivotNode;
  readonly label: string;
  readonly level: number;
  readonly expanded: boolean;
  readonly cells: readonly { readonly text: string; readonly bg: string; readonly total: boolean }[];
}

/**
 * Hierarchical pivot table: group rows carry subtotals and can be collapsed, leaf cells can
 * be heat-formatted per metric (the colour scale is shared across columns of one metric).
 */
@Component({
  selector: 'app-pivot-table',
  imports: [IconComponent],
  templateUrl: './pivot-table.component.html',
  styleUrl: './pivot-table.component.scss',
})
export class PivotTableComponent {
  readonly result = input.required<PivotQueryResult>();
  readonly config = input.required<PivotConfig>();
  readonly heat = input(true);

  /** Collapsed group keys; reset whenever a new result arrives. */
  protected readonly collapsed = linkedSignal<PivotQueryResult, ReadonlySet<string>>({ source: this.result, computation: () => new Set() });

  protected readonly rowHeader = computed(() => this.config().rows.map((d) => DIMENSION_LABELS[d]).join(' › '));
  protected readonly columnLabels = computed(() => {
    const { columns } = this.config();
    const result = this.result();
    return columns ? result.colKeys.map((k) => memberLabel(result, columns, k)) : [];
  });
  protected readonly metricLabels = computed(() => this.config().metrics.map(metricLabel));
  protected readonly hasGroups = computed(() => this.config().rows.length > 1);

  private readonly extents = computed(() => {
    const metrics = this.config().metrics;
    const result = this.result();
    const leaves = result.rows.filter((r) => r.leaf);
    const dataCols = result.colKeys.length * metrics.length;
    return metrics.map((_, m) => {
      const values: (number | null)[] = [];
      for (const leaf of leaves) {
        for (let c = m; c < (dataCols || metrics.length); c += metrics.length) values.push(leaf.values[c]);
      }
      return columnExtent(values);
    });
  });

  protected readonly visibleRows = computed<VisibleRow[]>(() => {
    const result = this.result();
    const config = this.config();
    const collapsed = this.collapsed();
    const metrics = config.metrics;
    const extents = this.extents();
    const heat = this.heat();
    const totalStart = result.colKeys.length * metrics.length;
    const out: VisibleRow[] = [];
    let hiddenUnder: string | null = null;
    for (const node of result.rows) {
      const key = node.path.join('.');
      if (hiddenUnder !== null && key.startsWith(`${hiddenUnder}.`)) continue;
      hiddenUnder = null;
      const expanded = !collapsed.has(key);
      if (!node.leaf && !expanded) hiddenUnder = key;
      const level = node.path.length - 1;
      out.push({
        key,
        node,
        level,
        expanded,
        label: memberLabel(result, config.rows[level], node.path[level]),
        cells: node.values.map((v, i) => {
          const m = i % metrics.length;
          const total = i >= totalStart && result.colKeys.length > 0;
          const bg = heat && node.leaf && !total ? heatBackground(heatLevel(v, extents[m].min, extents[m].max)) : 'transparent';
          return { text: formatMetric(v, metricFormat(metrics[m])), bg, total };
        }),
      });
    }
    return out;
  });

  protected readonly grandTotal = computed(() => {
    const metrics = this.config().metrics;
    return this.result().grandTotal.map((v, i) => formatMetric(v, metricFormat(metrics[i % metrics.length])));
  });

  protected toggle(key: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected setAll(expanded: boolean): void {
    this.collapsed.set(expanded ? new Set() : new Set(this.result().rows.filter((r) => !r.leaf && r.path.length === 1).map((r) => r.path.join('.'))));
  }
}
