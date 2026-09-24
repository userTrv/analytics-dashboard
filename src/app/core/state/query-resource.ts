import { computed, inject, linkedSignal, resource, Signal } from '@angular/core';
import { QueryKind, QueryMap } from '../worker/protocol';
import { AnalyticsDataService } from './analytics-data.service';

export interface QueryRef<T> {
  /** Latest successful result; kept while a newer query is loading (no flicker). */
  readonly value: Signal<T | undefined>;
  readonly loading: Signal<boolean>;
  /** True only before the first result — the moment for skeletons. */
  readonly initialLoading: Signal<boolean>;
  readonly error: Signal<string | null>;
}

/**
 * `resource()` bound to a worker query. Changing params cancels the superseded request.
 * Must be called in an injection context.
 */
export function queryResource<K extends QueryKind>(kind: K, params: () => QueryMap[K]['params'] | undefined): QueryRef<QueryMap[K]['result']> {
  const data = inject(AnalyticsDataService);
  const res = resource({
    params,
    loader: ({ params: p, abortSignal }) => data.query(kind, p, abortSignal),
  });
  const value = linkedSignal<QueryMap[K]['result'] | undefined, QueryMap[K]['result'] | undefined>({
    source: () => (res.hasValue() ? res.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });
  const loading = res.isLoading;
  return {
    value,
    loading,
    initialLoading: computed(() => loading() && value() === undefined),
    error: computed(() => {
      const e = res.error();
      return e ? (e instanceof Error ? e.message : String(e)) : null;
    }),
  };
}
