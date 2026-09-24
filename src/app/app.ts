import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AnalyticsDataService } from './core/state/analytics-data.service';
import { PerfMonitor } from './core/state/perf-monitor.service';
import { ThemeService } from './core/state/theme.service';
import { UrlSyncService } from './core/state/url-sync.service';
import { FilterBarComponent } from './layout/filter-bar/filter-bar.component';
import { NAV_ITEMS, SidebarComponent } from './layout/sidebar/sidebar.component';
import { formatNumber } from './shared/format/format';
import { IconComponent } from './shared/ui/icon/icon.component';

const SIDEBAR_KEY = 'pulse.sidebar.collapsed';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, FilterBarComponent, IconComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '[class.sidebar-collapsed]': 'collapsed()' },
})
export class App {
  protected readonly data = inject(AnalyticsDataService);
  protected readonly theme = inject(ThemeService);
  protected readonly perf = inject(PerfMonitor);
  private readonly router = inject(Router);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly isMobile = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((s) => s.matches)), { initialValue: false });
  protected readonly navOpen = signal(false);
  protected readonly collapsed = signal(readCollapsed());

  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)), { initialValue: '' });
  protected readonly pageTitle = computed(() => NAV_ITEMS.find((i) => this.url().startsWith(i.path))?.label ?? 'Pulse Analytics');

  protected readonly datasetSummary = computed(() => {
    const meta = this.data.meta();
    if (!meta) return null;
    return `${formatNumber(meta.orders)} orders · ${formatNumber(meta.customers)} customers · generated in ${Math.round(meta.generationMs)} ms`;
  });

  constructor() {
    inject(UrlSyncService); // starts URL ⇄ filter synchronisation
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((c) => !c);
    try {
      localStorage.setItem(SIDEBAR_KEY, String(this.collapsed()));
    } catch {
      /* storage unavailable — keep the in-memory state */
    }
  }

  protected skipToContent(): void {
    this.main().nativeElement.focus();
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  } catch {
    return false;
  }
}
