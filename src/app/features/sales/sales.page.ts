import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CATEGORIES } from '../../core/data/catalog';
import { FilterStore } from '../../core/state/filter-store';
import { queryResource } from '../../core/state/query-resource';
import { ChartComponent } from '../../shared/ui/chart/chart.component';
import { ChartClick } from '../../shared/ui/chart/chart-types';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PanelComponent } from '../../shared/ui/panel/panel.component';
import { OrdersTableComponent } from './orders-table/orders-table.component';
import { ProductTableComponent } from './product-table/product-table.component';
import { breakdownOption, toProductRows, trendOption } from './sales-model';

@Component({
  selector: 'app-sales-page',
  imports: [PanelComponent, ChartComponent, ProductTableComponent, OrdersTableComponent, EmptyStateComponent, IconComponent],
  templateUrl: './sales.page.html',
  styles: `
    .crumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .crumbs button {
      padding: 0;
      font: inherit;
      color: var(--accent);
      background: none;
      border: 0;
      cursor: pointer;
    }
    .crumbs button:hover {
      text-decoration: underline;
    }
  `,
})
export default class SalesPage {
  /** Bound from the `drill` query param (router component input binding). */
  readonly drill = input<string>();

  protected readonly store = inject(FilterStore);
  private readonly router = inject(Router);

  /** Validated drill-down category code. */
  protected readonly drillCode = computed(() => {
    const code = this.drill();
    return code && CATEGORIES.some((c) => c.code === code) ? code : null;
  });
  protected readonly drillLabel = computed(() => CATEGORIES.find((c) => c.code === this.drillCode())?.label ?? null);

  protected readonly query = queryResource('sales', () => ({ filters: this.store.queryFilters(), drill: this.drillCode() }));

  protected readonly breakdown = computed(() => {
    const r = this.query.value();
    if (!r) return null;
    return breakdownOption(this.drillCode() ? r.products : r.categories);
  });
  protected readonly trend = computed(() => {
    const r = this.query.value();
    return r ? trendOption(r.trend, r.trendStart) : null;
  });
  protected readonly productRows = computed(() => toProductRows(this.query.value()?.products ?? []));
  protected readonly isEmpty = computed(() => {
    const r = this.query.value();
    return !!r && r.categories.every((c) => c.orders === 0);
  });

  protected onBarClick(event: ChartClick): void {
    const code = (event.data as { code?: string } | null)?.code;
    if (!this.drillCode() && code) this.setDrill(code);
  }

  protected setDrill(code: string | null): void {
    void this.router.navigate(['/sales'], { queryParams: { drill: code }, queryParamsHandling: 'merge' });
  }
}
