import { afterNextRender, effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import { AnalyticsDataService } from './analytics-data.service';
import { FilterStore } from './filter-store';

export interface UpdateSample {
  /** Filter change → all queries resolved → rendered → next frame painted. */
  readonly totalMs: number;
  readonly at: number;
}

/**
 * Measures what users feel: the time from a filter change until every visible query has
 * resolved and the resulting frame is painted. Samples are also exposed on
 * `window.__pulsePerf` so they can be collected by a script.
 */
@Injectable({ providedIn: 'root' })
export class PerfMonitor {
  private readonly data = inject(AnalyticsDataService);
  private readonly injector = inject(Injector);
  private startedAt: number | null = null;
  private first = true;

  readonly last = signal<UpdateSample | null>(null);
  readonly samples: UpdateSample[] = [];

  constructor() {
    const store = inject(FilterStore);
    effect(() => {
      store.queryFilters();
      untracked(() => {
        if (this.first) {
          this.first = false; // the initial load is dominated by dataset generation
          return;
        }
        this.startedAt = performance.now();
      });
    });
    effect(() => {
      if (this.data.inflight() > 0 || this.startedAt === null) return;
      const start = this.startedAt;
      untracked(() =>
        afterNextRender(
          () =>
            requestAnimationFrame(() =>
              setTimeout(() => {
                if (this.startedAt !== start || this.data.inflight() > 0) return;
                this.startedAt = null;
                const sample = { totalMs: performance.now() - start, at: Date.now() };
                this.samples.push(sample);
                this.last.set(sample);
              }),
            ),
          { injector: this.injector },
        ),
      );
    });
    (globalThis as { __pulsePerf?: UpdateSample[] }).__pulsePerf = this.samples;
  }
}
