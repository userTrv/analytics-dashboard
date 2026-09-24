import { CATEGORIES, PRODUCTS } from '../../data/catalog';
import { Dataset } from '../../data/dataset';
import { compileFilter, QueryFilters } from '../filters';
import { daySpan, scanOrders } from './scan';

export interface SalesParams {
  readonly filters: QueryFilters;
  /** Category code to drill into, or null for the category level. */
  readonly drill: string | null;
}

export interface SalesRow {
  readonly code: string;
  readonly revenue: number;
  readonly prevRevenue: number;
  readonly orders: number;
  readonly units: number;
  readonly refunds: number;
  readonly refundedOrders: number;
  readonly cogs: number;
  readonly discount: number;
}

export interface SalesResult {
  /** Categories (always, for the breadcrumb and the category chart). */
  readonly categories: SalesRow[];
  /** Products — of the drilled category, or all products passing the filters. */
  readonly products: SalesRow[];
  /** Daily revenue of the top series (categories, or top products when drilled). */
  readonly trend: { readonly code: string; readonly values: Float64Array }[];
  readonly trendStart: string;
}

class RowAcc {
  revenue = 0;
  prevRevenue = 0;
  orders = 0;
  units = 0;
  refunds = 0;
  refundedOrders = 0;
  cogs = 0;
  discount = 0;
}

export function salesQuery(ds: Dataset, { filters, drill }: SalesParams): SalesResult {
  const f = compileFilter(filters);
  const drillIndex = drill ? CATEGORIES.findIndex((c) => c.code === drill) : -1;
  const cats = CATEGORIES.map(() => new RowAcc());
  const prods = PRODUCTS.map(() => new RowAcc());
  const o = ds.orders;
  const span = daySpan(ds, filters.range);
  const catTrend = CATEGORIES.map(() => new Float64Array(span.length));
  const prodTrend = new Map<number, Float64Array>();

  scanOrders(ds, f, span, (i) => {
    const rev = o.revenue[i];
    const cat = o.category[i];
    for (const acc of [cats[cat], prods[o.product[i]]]) {
      acc.revenue += rev;
      acc.orders++;
      acc.units += o.qty[i];
      acc.discount += o.discount[i];
      if (o.refunded[i]) {
        acc.refunds += rev;
        acc.refundedOrders++;
      } else {
        acc.cogs += o.cost[i];
      }
    }
    const d = o.day[i] - span.origin;
    catTrend[cat][d] += rev;
    if (cat === drillIndex) {
      let arr = prodTrend.get(o.product[i]);
      if (!arr) prodTrend.set(o.product[i], (arr = new Float64Array(span.length)));
      arr[d] += rev;
    }
  });
  if (filters.comparison) {
    scanOrders(ds, f, daySpan(ds, filters.comparison), (i) => {
      cats[o.category[i]].prevRevenue += o.revenue[i];
      prods[o.product[i]].prevRevenue += o.revenue[i];
    });
  }

  const toRow = (code: string, a: RowAcc): SalesRow => ({ code, ...a });
  const categories = CATEGORIES.map((c, i) => toRow(c.code, cats[i]));
  const products = PRODUCTS.map((p, i) => toRow(p.code, prods[i])).filter((row, i) =>
    drillIndex >= 0 ? PRODUCTS[i].category === drillIndex : f.category[PRODUCTS[i].category] === 1,
  );

  const trend =
    drillIndex >= 0
      ? [...prodTrend.entries()]
          .sort((a, b) => prods[b[0]].revenue - prods[a[0]].revenue)
          .slice(0, 6)
          .map(([p, values]) => ({ code: PRODUCTS[p].code, values }))
      : CATEGORIES.map((c, i) => ({ code: c.code, values: catTrend[i] }));

  return { categories, products, trend, trendStart: filters.range.start };
}
