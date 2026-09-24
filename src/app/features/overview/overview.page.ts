import { Component, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { autoGranularity, COMPARE_MODES, Granularity, rangeLength } from '../../core/analytics/date-range';
import { hasNonTrafficFilters } from '../../core/analytics/filters';
import { FilterStore } from '../../core/state/filter-store';
import { queryResource } from '../../core/state/query-resource';
import { ThemeService } from '../../core/state/theme.service';
import { ChartComponent } from '../../shared/ui/chart/chart.component';
import { ChartClick } from '../../shared/ui/chart/chart-types';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card/kpi-card.component';
import { PanelComponent } from '../../shared/ui/panel/panel.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { InsightsPanelComponent } from './insights-panel.component';
import { buildKpis, categoryOption, channelMixOption, geographyOption, partialNote, revenueTrendOption } from './overview-model';

const GRANULARITIES: SegmentOption<Granularity>[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

@Component({
  selector: 'app-overview-page',
  imports: [KpiCardComponent, ChartComponent, PanelComponent, SegmentedComponent, InsightsPanelComponent, EmptyStateComponent],
  templateUrl: './overview.page.html',
})
export default class OverviewPage {
  protected readonly store = inject(FilterStore);
  private readonly theme = inject(ThemeService).theme;
  private readonly router = inject(Router);

  protected readonly granularities = GRANULARITIES;
  /** Follows the date range (auto granularity) but can be overridden until the range changes. */
  protected readonly granularity = linkedSignal<Granularity>(() => autoGranularity(this.store.range()));

  protected readonly query = queryResource('overview', () => ({ filters: this.store.queryFilters() }));
  private readonly result = this.query.value;

  protected readonly isEmpty = computed(() => {
    const r = this.result();
    return !!r && r.current.orders.every((v) => v === 0);
  });

  protected readonly kpis = computed(() => {
    const r = this.result();
    return r ? buildKpis(r.current, r.comparison, hasNonTrafficFilters(this.store.state())) : [];
  });

  protected readonly trendOption = computed(() => {
    const r = this.result();
    return r ? revenueTrendOption(r.current, r.comparison, this.granularity(), r.anomalies, this.theme()) : null;
  });

  protected readonly channelOption = computed(() => {
    const r = this.result();
    return r ? channelMixOption(r.current.start, r.current.length, r.channelRevenue, this.granularity()) : null;
  });

  protected readonly categoryOption = computed(() => {
    const r = this.result();
    return r ? categoryOption(r.categories) : null;
  });

  protected readonly geoOption = computed(() => {
    const r = this.result();
    return r ? geographyOption(r.countries, this.theme()) : null;
  });

  protected readonly trendSubtitle = computed(() => {
    const r = this.store.range();
    const parts = ['Gross revenue'];
    if (this.store.compare() !== 'none') parts.push(`dashed line = ${this.comparisonLabel()}`);
    const note = partialNote(r.start, rangeLength(r), this.granularity());
    if (note) parts.push(note);
    return parts.join(' · ');
  });

  protected readonly comparisonLabel = computed(() => COMPARE_MODES.find((m) => m.value === this.store.compare())?.label.toLowerCase() ?? '');

  protected drillIntoCategory(event: ChartClick): void {
    const code = (event.data as { code?: string } | null)?.code;
    if (code) void this.router.navigate(['/sales'], { queryParams: { ...this.store.linkParams(), drill: code } });
  }
}
