import { Component, computed, inject, signal } from '@angular/core';
import { LtvGrouping } from '../../core/analytics/queries/customers';
import { RFM_SEGMENTS } from '../../core/analytics/rfm';
import { FilterStore } from '../../core/state/filter-store';
import { queryResource } from '../../core/state/query-resource';
import { ThemeService } from '../../core/state/theme.service';
import { formatDate } from '../../shared/format/format';
import { FormatPipe } from '../../shared/format/format.pipe';
import { ChartComponent } from '../../shared/ui/chart/chart.component';
import { PanelComponent } from '../../shared/ui/panel/panel.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { cohortHeatmapOption, ltvOption, newVsReturningOption, rfmOption } from './customers-model';

@Component({
  selector: 'app-customers-page',
  imports: [PanelComponent, ChartComponent, SegmentedComponent, FormatPipe],
  templateUrl: './customers.page.html',
  styles: `
    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-3);
    }
    .stat {
      padding: 14px 16px;
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
    }
    .stat dt {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
    }
    .stat dd {
      margin: 4px 0 0;
      font-size: 24px;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }
    .rules {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 4px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    @media (max-width: 640px) {
      .stats {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export default class CustomersPage {
  protected readonly store = inject(FilterStore);
  private readonly theme = inject(ThemeService).theme;

  protected readonly ltvBy = signal<LtvGrouping>('segment');
  protected readonly ltvOptions: SegmentOption<LtvGrouping>[] = [
    { value: 'segment', label: 'By segment' },
    { value: 'channel', label: 'By first channel' },
  ];
  protected readonly rules = RFM_SEGMENTS;

  protected readonly query = queryResource('customers', () => ({ filters: this.store.queryFilters(), ltvBy: this.ltvBy() }));
  protected readonly ignoresCategory = computed(() => this.store.state().category.length > 0);

  protected readonly cohortSubtitle = computed(() => {
    const c = this.query.value()?.cohorts;
    if (!c || !c.months.length) return '';
    const span = `${formatDate(c.months[0], 'month')} – ${formatDate(c.months[c.months.length - 1], 'month')}`;
    return c.widened ? `${span} · range too short for cohorts, showing the 12 months up to its end` : `Acquisition cohorts ${span}`;
  });

  protected readonly heatmap = computed(() => {
    const r = this.query.value();
    return r ? cohortHeatmapOption(r.cohorts, this.theme()) : null;
  });
  protected readonly heatmapHeight = computed(() => Math.max(260, (this.query.value()?.cohorts.months.length ?? 12) * 30 + 90));
  protected readonly ltv = computed(() => {
    const r = this.query.value();
    return r ? ltvOption(r.ltv, this.ltvBy()) : null;
  });
  protected readonly nvr = computed(() => {
    const r = this.query.value();
    return r ? newVsReturningOption(r.newVsReturning) : null;
  });
  protected readonly rfm = computed(() => {
    const r = this.query.value();
    return r ? rfmOption(r.rfm) : null;
  });
}
