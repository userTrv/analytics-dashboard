import { Component, computed, inject, signal } from '@angular/core';
import { hasNonTrafficFilters } from '../../core/analytics/filters';
import { delta, ratio } from '../../core/analytics/metrics';
import { CHANNELS } from '../../core/data/catalog';
import { FilterStore } from '../../core/state/filter-store';
import { queryResource } from '../../core/state/query-resource';
import { ThemeService } from '../../core/state/theme.service';
import { FormatPipe } from '../../shared/format/format.pipe';
import { columnExtent, heatBackground, heatLevel } from '../../shared/format/heat';
import { ChartComponent } from '../../shared/ui/chart/chart.component';
import { DeltaBadgeComponent } from '../../shared/ui/delta-badge/delta-badge.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card/kpi-card.component';
import { PanelComponent } from '../../shared/ui/panel/panel.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { conversionMatrix, funnelOption, marketingKpis, roasOption, spendRevenueOption, spendTrendOption } from './marketing-model';

@Component({
  selector: 'app-marketing-page',
  imports: [PanelComponent, ChartComponent, KpiCardComponent, SegmentedComponent, FormatPipe, DeltaBadgeComponent],
  templateUrl: './marketing.page.html',
})
export default class MarketingPage {
  protected readonly store = inject(FilterStore);
  private readonly theme = inject(ThemeService).theme;

  protected readonly query = queryResource('marketing', () => ({ filters: this.store.queryFilters() }));
  protected readonly ignoresFilters = computed(() => hasNonTrafficFilters(this.store.state()));

  protected readonly kpis = computed(() => {
    const r = this.query.value();
    return r ? marketingKpis(r) : [];
  });
  protected readonly spendRevenue = computed(() => {
    const r = this.query.value();
    return r ? spendRevenueOption(r) : null;
  });
  protected readonly roas = computed(() => {
    const r = this.query.value();
    return r ? roasOption(r, this.theme()) : null;
  });
  protected readonly trend = computed(() => {
    const r = this.query.value();
    return r ? spendTrendOption(r) : null;
  });
  protected readonly funnel = computed(() => {
    const r = this.query.value();
    if (!r) return null;
    const totals = r.channels.reduce(
      (t, c) => ({ sessions: t.sessions + c.sessions, views: t.views + c.views, carts: t.carts + c.carts, checkouts: t.checkouts + c.checkouts, purchases: t.purchases + c.purchases }),
      { sessions: 0, views: 0, carts: 0, checkouts: 0, purchases: 0 },
    );
    return funnelOption(totals);
  });

  protected readonly matrixBy = signal<'channel' | 'device'>('channel');
  protected readonly matrixOptions: SegmentOption<'channel' | 'device'>[] = [
    { value: 'channel', label: 'By channel' },
    { value: 'device', label: 'By device' },
  ];
  protected readonly stepLabels = ['Session → view', 'View → cart', 'Cart → checkout', 'Checkout → buy'];

  /** Rows plus per-cell heat so drop-offs stand out without reading every number. */
  protected readonly matrix = computed(() => {
    const r = this.query.value();
    if (!r) return [];
    const rows = conversionMatrix(r, this.matrixBy());
    const extents = [...this.stepLabels.map((_, k) => columnExtent(rows.map((row) => row.steps[k]))), columnExtent(rows.map((row) => row.overall))];
    return rows.map((row) => ({
      ...row,
      cells: [...row.steps, row.overall].map((value, k) => ({ value, bg: heatBackground(heatLevel(value, extents[k].min, extents[k].max)) })),
    }));
  });

  protected readonly channelTable = computed(() => {
    const r = this.query.value();
    if (!r) return [];
    return r.channels.map((c, i) => {
      const prev = r.previous?.[i];
      const roasNow = ratio(c.revenue, c.spend);
      return {
        label: CHANNELS[i].label,
        paid: CHANNELS[i].paid,
        spend: c.spend,
        revenue: c.revenue,
        roas: roasNow,
        roasDelta: prev ? delta(roasNow, ratio(prev.revenue, prev.spend)).pct : null,
        newCustomers: c.newCustomers,
        cac: ratio(c.spend, c.newCustomers),
        cr: ratio(c.purchases, c.sessions),
      };
    });
  });
}
