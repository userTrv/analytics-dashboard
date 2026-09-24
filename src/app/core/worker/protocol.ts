import { CustomersParams, CustomersResult } from '../analytics/queries/customers';
import { MarketingParams, MarketingResult } from '../analytics/queries/marketing';
import { OrdersParams, OrdersResult } from '../analytics/queries/orders';
import { OverviewParams, OverviewResult } from '../analytics/queries/overview';
import { PivotParams, PivotQueryResult } from '../analytics/queries/pivot-query';
import { SalesParams, SalesResult } from '../analytics/queries/sales';
import { DatasetMeta } from '../data/dataset';

/** Every query the worker understands: name → params / result. */
export interface QueryMap {
  overview: { params: OverviewParams; result: OverviewResult };
  sales: { params: SalesParams; result: SalesResult };
  orders: { params: OrdersParams; result: OrdersResult };
  marketing: { params: MarketingParams; result: MarketingResult };
  customers: { params: CustomersParams; result: CustomersResult };
  pivot: { params: PivotParams; result: PivotQueryResult };
}

export type QueryKind = keyof QueryMap;

export type WorkerRequest =
  | { readonly id: number; readonly type: 'init'; readonly seed?: number }
  | { [K in QueryKind]: { readonly id: number; readonly type: 'query'; readonly kind: K; readonly params: QueryMap[K]['params'] } }[QueryKind];

export interface QueryTiming {
  /** Time spent computing (0 when served from cache). */
  readonly computeMs: number;
  readonly cached: boolean;
}

export type WorkerResponse =
  | { readonly id: number; readonly ok: true; readonly type: 'init'; readonly meta: DatasetMeta }
  | { readonly id: number; readonly ok: true; readonly type: 'query'; readonly result: unknown; readonly timing: QueryTiming }
  | { readonly id: number; readonly ok: false; readonly error: string };
