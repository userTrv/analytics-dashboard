/**
 * Metric formulas over additive totals. Every ratio returns `null` when the denominator is
 * zero — "no data" must never render as 0 % or ∞.
 */
export interface Totals {
  /** Gross revenue after discounts, before refunds. */
  revenue: number;
  refunds: number;
  /** Cost of goods for orders that were not refunded. */
  cogs: number;
  orders: number;
  refundedOrders: number;
  newCustomers: number;
  units: number;
  // Traffic cube (not split by category / segment):
  sessions: number;
  purchases: number;
  trafficRevenue: number;
  trafficNewCustomers: number;
  spend: number;
}

export const TOTAL_KEYS: readonly (keyof Totals)[] = [
  'revenue',
  'refunds',
  'cogs',
  'orders',
  'refundedOrders',
  'newCustomers',
  'units',
  'sessions',
  'purchases',
  'trafficRevenue',
  'trafficNewCustomers',
  'spend',
];

export function emptyTotals(): Totals {
  return {
    revenue: 0,
    refunds: 0,
    cogs: 0,
    orders: 0,
    refundedOrders: 0,
    newCustomers: 0,
    units: 0,
    sessions: 0,
    purchases: 0,
    trafficRevenue: 0,
    trafficNewCustomers: 0,
    spend: 0,
  };
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export const netRevenue = (t: Pick<Totals, 'revenue' | 'refunds'>): number => t.revenue - t.refunds;
export const aov = (t: Pick<Totals, 'revenue' | 'orders'>): number | null => ratio(t.revenue, t.orders);
export const conversionRate = (t: Pick<Totals, 'purchases' | 'sessions'>): number | null => ratio(t.purchases, t.sessions);
export const refundRate = (t: Pick<Totals, 'refundedOrders' | 'orders'>): number | null => ratio(t.refundedOrders, t.orders);
/** Gross margin on net revenue: (net revenue − COGS) / net revenue. */
export const grossMargin = (t: Pick<Totals, 'revenue' | 'refunds' | 'cogs'>): number | null =>
  ratio(netRevenue(t) - t.cogs, netRevenue(t));
/** Return on ad spend, on the traffic cube so numerator and denominator share dimensions. */
export const roas = (t: Pick<Totals, 'trafficRevenue' | 'spend'>): number | null => ratio(t.trafficRevenue, t.spend);
/** Customer acquisition cost. */
export const cac = (t: Pick<Totals, 'spend' | 'trafficNewCustomers'>): number | null => ratio(t.spend, t.trafficNewCustomers);

export interface Delta {
  readonly abs: number | null;
  /** Relative change (0.12 = +12 %); null when the base is 0 or unknown. */
  readonly pct: number | null;
}

export function delta(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null) return { abs: null, pct: null };
  return { abs: current - previous, pct: previous === 0 ? null : (current - previous) / Math.abs(previous) };
}

export type MetricFormat = 'currency' | 'number' | 'percent' | 'ratio';

export interface KpiDefinition {
  readonly id: string;
  readonly label: string;
  readonly format: MetricFormat;
  readonly value: (t: Totals) => number | null;
  /** Which direction is good — drives delta colouring (refund rate: down is good). */
  readonly better: 'up' | 'down';
  /** Computed on the traffic cube, so category/segment filters do not apply. */
  readonly trafficBased?: boolean;
  readonly hint: string;
}

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  { id: 'revenue', label: 'Revenue', format: 'currency', value: (t) => t.revenue, better: 'up', hint: 'Gross order value after discounts, before refunds' },
  { id: 'orders', label: 'Orders', format: 'number', value: (t) => t.orders, better: 'up', hint: 'Number of orders placed' },
  { id: 'aov', label: 'Avg. order value', format: 'currency', value: aov, better: 'up', hint: 'Revenue ÷ orders' },
  { id: 'cr', label: 'Conversion rate', format: 'percent', value: conversionRate, better: 'up', trafficBased: true, hint: 'Purchases ÷ sessions' },
  { id: 'margin', label: 'Gross margin', format: 'percent', value: grossMargin, better: 'up', hint: '(Net revenue − COGS) ÷ net revenue' },
  { id: 'newCustomers', label: 'New customers', format: 'number', value: (t) => t.newCustomers, better: 'up', hint: 'Customers placing their first order' },
  { id: 'refundRate', label: 'Refund rate', format: 'percent', value: refundRate, better: 'down', hint: 'Refunded orders ÷ orders' },
  { id: 'roas', label: 'ROAS', format: 'ratio', value: roas, better: 'up', trafficBased: true, hint: 'Revenue ÷ marketing spend' },
];
