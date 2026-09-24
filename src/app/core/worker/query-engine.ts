import { LruCache } from '../analytics/lru-cache';
import { customersQuery } from '../analytics/queries/customers';
import { marketingQuery } from '../analytics/queries/marketing';
import { orderRows, selectOrders } from '../analytics/queries/orders';
import { overviewQuery } from '../analytics/queries/overview';
import { pivotQuery } from '../analytics/queries/pivot-query';
import { salesQuery } from '../analytics/queries/sales';
import { Dataset } from '../data/dataset';
import { QueryKind, QueryMap, QueryTiming } from './protocol';

type Handlers = { [K in QueryKind]: (ds: Dataset, params: QueryMap[K]['params']) => QueryMap[K]['result'] };

/**
 * Dispatches queries against the in-memory dataset and memoises results by a canonical
 * key of (kind, params). Filters are small, so JSON is a cheap and exact key.
 */
export class QueryEngine {
  private readonly results = new LruCache<string, unknown>(64);
  private readonly selections = new LruCache<string, Uint32Array>(8);

  private readonly handlers: Handlers = {
    overview: overviewQuery,
    sales: salesQuery,
    marketing: marketingQuery,
    customers: customersQuery,
    pivot: pivotQuery,
    orders: (ds, params) => {
      const { offset, limit, ...selection } = params;
      const key = JSON.stringify(selection);
      let rows = this.selections.get(key);
      if (!rows) {
        rows = selectOrders(ds, selection);
        this.selections.set(key, rows);
      }
      return { total: rows.length, offset, rows: orderRows(ds, rows, offset, limit) };
    },
  };

  constructor(private readonly ds: Dataset) {}

  run<K extends QueryKind>(kind: K, params: QueryMap[K]['params']): { result: QueryMap[K]['result']; timing: QueryTiming } {
    const key = `${kind}:${JSON.stringify(params)}`;
    const hit = this.results.get(key) as QueryMap[K]['result'] | undefined;
    if (hit) return { result: hit, timing: { computeMs: 0, cached: true } };
    const t0 = performance.now();
    const result = this.handlers[kind](this.ds, params);
    const computeMs = performance.now() - t0;
    this.results.set(key, result);
    return { result, timing: { computeMs, cached: false } };
  }
}
