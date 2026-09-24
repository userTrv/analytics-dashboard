import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { sameFilters } from '../analytics/filters';
import { FilterStore } from './filter-store';
import { filtersToParams, paramsToFilters } from './url-state';

/**
 * Two-way binding between the filter store and the URL query string.
 * URL → store on every navigation (deep links, back/forward); store → URL on every change,
 * as a new history entry. Equality checks on both sides stop the ping-pong.
 */
@Injectable({ providedIn: 'root' })
export class UrlSyncService {
  private readonly router = inject(Router);
  private readonly store = inject(FilterStore);
  /** Store → URL waits for the first navigation, otherwise defaults would overwrite a deep link. */
  private readonly ready = signal(false);

  constructor() {
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      const fromUrl = paramsToFilters(this.router.routerState.snapshot.root.queryParams);
      if (!sameFilters(fromUrl, this.store.state())) this.store.replace(fromUrl);
      this.ready.set(true);
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());

    effect(() => {
      if (!this.ready()) return;
      const state = this.store.state();
      untracked(() => {
        const tree = this.router.parseUrl(this.router.url);
        const current = paramsToFilters(tree.queryParams);
        if (sameFilters(current, state)) return;
        const merged: Record<string, string> = { ...tree.queryParams };
        for (const [key, value] of Object.entries(filtersToParams(state))) {
          if (value === null) delete merged[key];
          else merged[key] = value;
        }
        tree.queryParams = merged;
        void this.router.navigateByUrl(tree);
      });
    });
  }
}
