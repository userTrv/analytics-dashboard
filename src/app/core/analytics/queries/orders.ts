import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES, PRODUCTS, SEGMENTS } from '../../data/catalog';
import { Dataset } from '../../data/dataset';
import { addDays } from '../../data/dates';
import { compileFilter, QueryFilters } from '../filters';
import { daySpan, scanOrders } from './scan';

export type OrderSortKey = 'date' | 'revenue' | 'qty' | 'margin';

export interface OrdersParams {
  readonly filters: QueryFilters;
  readonly drill: string | null;
  readonly sort: { readonly key: OrderSortKey; readonly dir: 'asc' | 'desc' };
  readonly offset: number;
  readonly limit: number;
}

export interface OrderRow {
  readonly id: number;
  readonly date: string;
  readonly customer: number;
  readonly product: string;
  readonly category: string;
  readonly country: string;
  readonly channel: string;
  readonly device: string;
  readonly segment: string;
  readonly qty: number;
  readonly revenue: number;
  readonly margin: number;
  readonly refunded: boolean;
  readonly isNew: boolean;
}

export interface OrdersResult {
  readonly total: number;
  readonly offset: number;
  readonly rows: OrderRow[];
}

/** First order number shown to users; row index + this = the visible order id. */
export const ORDER_ID_BASE = 100_000;

/** Gross profit of one order; a refunded order earns nothing (goods come back to stock). */
export function orderMargin(ds: Dataset, i: number): number {
  return ds.orders.refunded[i] ? 0 : ds.orders.revenue[i] - ds.orders.cost[i];
}

/** Selected row indices, sorted — built once per filter/sort and then paged. */
export function selectOrders(ds: Dataset, params: Omit<OrdersParams, 'offset' | 'limit'>): Uint32Array {
  const f = compileFilter(params.filters);
  const drill = params.drill ? CATEGORIES.findIndex((c) => c.code === params.drill) : -1;
  const picked = new Uint32Array(ds.dayStart[ds.days]);
  let n = 0;
  const o = ds.orders;
  scanOrders(ds, f, daySpan(ds, params.filters.range), (i) => {
    if (drill < 0 || o.category[i] === drill) picked[n++] = i;
  });
  const rows = picked.slice(0, n);
  const { key, dir } = params.sort;
  if (key === 'date' && dir === 'asc') return rows; // already chronological
  if (key === 'date') return rows.reverse();
  const value = key === 'revenue' ? o.revenue : key === 'qty' ? o.qty : null;
  const sortKey = new Float64Array(ds.dayStart[ds.days]);
  for (const i of rows) sortKey[i] = value ? value[i] : orderMargin(ds, i);
  const sign = dir === 'asc' ? 1 : -1;
  return rows.sort((a, b) => sign * (sortKey[a] - sortKey[b]) || b - a);
}

export function orderRows(ds: Dataset, selection: Uint32Array, offset: number, limit: number): OrderRow[] {
  const o = ds.orders;
  const rows: OrderRow[] = [];
  for (let k = offset; k < Math.min(selection.length, offset + limit); k++) {
    const i = selection[k];
    rows.push({
      id: ORDER_ID_BASE + i,
      date: addDays(ds.start, o.day[i]),
      customer: o.customer[i],
      product: PRODUCTS[o.product[i]].label,
      category: CATEGORIES[o.category[i]].code,
      country: COUNTRIES[o.country[i]].code,
      channel: CHANNELS[o.channel[i]].code,
      device: DEVICES[o.device[i]].code,
      segment: SEGMENTS[o.segment[i]].code,
      qty: o.qty[i],
      revenue: o.revenue[i],
      margin: orderMargin(ds, i),
      refunded: o.refunded[i] === 1,
      isNew: o.isNew[i] === 1,
    });
  }
  return rows;
}
