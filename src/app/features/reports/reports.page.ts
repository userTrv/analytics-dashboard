import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { csvBlob, toCsv } from '../../core/analytics/csv';
import { FilterStore } from '../../core/state/filter-store';
import { queryResource } from '../../core/state/query-resource';
import { compactParams, FILTER_PARAM_KEYS, filtersToParams } from '../../core/state/url-state';
import { describeFilters } from '../../shared/format/filter-summary';
import { FormatPipe } from '../../shared/format/format.pipe';
import { ChartComponent } from '../../shared/ui/chart/chart.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PanelComponent } from '../../shared/ui/panel/panel.component';
import { pivotToSheet, safeFileName } from './pivot-export';
import { PivotTableComponent } from './pivot-table/pivot-table.component';
import { reportChartOption } from './report-chart';
import { REPORT_PARAM_KEYS, ReportView, reportFromParams, reportToParams } from './report-config';
import { ReportDesignerComponent } from './report-designer/report-designer.component';
import { ReportStorageService, SavedReport } from './report-storage.service';
import { SavedReportsComponent } from './saved-reports/saved-reports.component';

@Component({
  selector: 'app-reports-page',
  imports: [PanelComponent, ReportDesignerComponent, PivotTableComponent, SavedReportsComponent, ChartComponent, EmptyStateComponent, IconComponent, FormatPipe],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export default class ReportsPage {
  protected readonly store = inject(FilterStore);
  protected readonly storage = inject(ReportStorageService);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).queryParams, { initialValue: {} as Record<string, string> });

  /** The report definition lives in the URL, so every state is a shareable link. */
  protected readonly view = computed<ReportView>(() => reportFromParams(this.params()));
  protected readonly activeId = computed(() => {
    const id = this.params()['rid'];
    return id && this.storage.get(id) ? id : null;
  });
  protected readonly activeReport = computed(() => (this.activeId() ? this.storage.get(this.activeId()!) : undefined));

  protected readonly query = queryResource('pivot', () => ({ filters: this.store.queryFilters(), config: this.view().config }));
  protected readonly chart = computed(() => {
    const r = this.query.value();
    return r && this.view().chart === 'bar' ? reportChartOption(r, this.view().config) : null;
  });
  protected readonly filterSummary = computed(() => describeFilters(this.store.state(), this.store.range(), this.store.comparison()));
  protected readonly generatedAt = signal(new Date());

  protected readonly name = signal('');
  protected readonly status = signal('');

  protected setView(view: ReportView): void {
    void this.router.navigate(['/reports'], { queryParams: reportToParams(view), queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected save(): void {
    const name = this.name().trim() || this.suggestName();
    const report = this.storage.create(name, this.view(), this.store.state());
    this.name.set('');
    this.announce(`Saved “${report.name}”`);
    void this.router.navigate(['/reports'], { queryParams: { rid: report.id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected update(): void {
    const report = this.activeReport();
    if (!report) return;
    this.storage.update(report.id, { view: this.view(), filters: this.store.state() });
    this.announce(`Updated “${report.name}”`);
  }

  protected openReport(report: SavedReport): void {
    // Replace the whole query string: filters + report definition + id, nothing stale.
    const queryParams = { ...compactParams(filtersToParams(report.filters)), ...reportToParams(report.view), rid: report.id };
    void this.router.navigate(['/reports'], { queryParams });
  }

  protected duplicate(id: string): void {
    const copy = this.storage.duplicate(id);
    if (copy) this.announce(`Created “${copy.name}”`);
  }

  protected remove(id: string): void {
    const report = this.storage.get(id);
    this.storage.remove(id);
    if (report) this.announce(`Deleted “${report.name}”`);
    if (this.activeId() === id) void this.router.navigate(['/reports'], { queryParams: { rid: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected exportCsv(): void {
    const result = this.query.value();
    if (!result) return;
    const sheet = pivotToSheet(result, this.view().config);
    const url = URL.createObjectURL(csvBlob(toCsv(sheet)));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName(this.activeReport()?.name ?? this.suggestName())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.announce('CSV downloaded');
  }

  protected print(): void {
    this.generatedAt.set(new Date());
    // Let the print header re-render with the fresh timestamp before the dialog opens.
    requestAnimationFrame(() => window.print());
  }

  protected async copyLink(): Promise<void> {
    const url = this.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      this.announce('Link copied to clipboard');
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  /** Current URL with only filter + report params — no transient state. */
  private shareUrl(): string {
    const keep = new Set<string>([...FILTER_PARAM_KEYS, ...REPORT_PARAM_KEYS]);
    const tree = this.router.parseUrl(this.router.url);
    tree.queryParams = Object.fromEntries(Object.entries(tree.queryParams).filter(([k]) => keep.has(k)));
    const base = location.href.split('#')[0];
    return `${base}#${this.router.serializeUrl(tree)}`;
  }

  private suggestName(): string {
    const c = this.view().config;
    return `${c.rows.join(' × ')}${c.columns ? ` by ${c.columns}` : ''}`;
  }

  private announce(message: string): void {
    this.status.set(message);
    setTimeout(() => this.status() === message && this.status.set(''), 3000);
  }
}
