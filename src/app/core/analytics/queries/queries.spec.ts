import { generateDataset } from '../../data/generator';
import { QueryEngine } from '../../worker/query-engine';
import { comparisonRange } from '../date-range';
import { EMPTY_DIMENSIONS, QueryFilters } from '../filters';
import { sumSeries } from './scan';

const ds = generateDataset({ seed: 7, start: '2025-01-01', end: '2025-08-31', newCustomersPerDay: 10 });
const range = { start: '2025-06-01', end: '2025-08-31' };
const filters: QueryFilters = { ...EMPTY_DIMENSIONS, range, comparison: comparisonRange(range, 'previous') };

function bruteForceRevenue(predicate: (i: number) => boolean): number {
  let sum = 0;
  const from = ds.dayStart[151]; // 2025-06-01 is day 151
  for (let i = from; i < ds.orderCount; i++) if (predicate(i)) sum += ds.orders.revenue[i];
  return sum;
}

describe('queries against a small dataset', () => {
  const engine = new QueryEngine(ds);

  it('overview totals match a brute-force scan, with and without filters', () => {
    const all = engine.run('overview', { filters }).result;
    expect(sumSeries(all.current).revenue).toBeCloseTo(bruteForceRevenue(() => true), 2);

    const de = engine.run('overview', { filters: { ...filters, country: ['DE'], category: ['electronics'] } }).result;
    const deIndex = 3;
    expect(sumSeries(de.current).revenue).toBeCloseTo(bruteForceRevenue((i) => ds.orders.country[i] === deIndex && ds.orders.category[i] === 0), 2);
  });

  it('keeps traffic purchases equal to orders when only traffic dimensions are filtered', () => {
    const r = engine.run('overview', { filters: { ...filters, channel: ['email'], device: ['mobile'] } }).result;
    const t = sumSeries(r.current);
    expect(t.purchases).toBe(t.orders);
  });

  it('memoises identical queries', () => {
    const first = engine.run('sales', { filters, drill: null });
    const second = engine.run('sales', { filters, drill: null });
    expect(second.timing.cached).toBe(true);
    expect(second.result).toBe(first.result);
  });

  it('drills into a category and pages sorted orders', () => {
    const sales = engine.run('sales', { filters, drill: 'books' }).result;
    expect(sales.products.every((p) => p.code.startsWith('books-'))).toBe(true);

    const page = engine.run('orders', { filters, drill: 'books', sort: { key: 'revenue', dir: 'desc' }, offset: 0, limit: 50 }).result;
    expect(page.rows.length).toBe(Math.min(50, page.total));
    expect(page.rows.every((r) => r.category === 'books')).toBe(true);
    for (let i = 1; i < page.rows.length; i++) expect(page.rows[i - 1].revenue).toBeGreaterThanOrEqual(page.rows[i].revenue);
  });

  it('pivot grand total equals the overview revenue', () => {
    const pivot = engine.run('pivot', {
      filters,
      config: { rows: ['category'], columns: 'month', metrics: [{ field: 'revenue', agg: 'sum' }], sort: { by: 'label' } },
    }).result;
    const overview = engine.run('overview', { filters }).result;
    expect(pivot.grandTotal[pivot.grandTotal.length - 1]).toBeCloseTo(sumSeries(overview.current).revenue, 2);
    expect(pivot.labels.month?.[5]).toBe('Jun 2025');
  });

  it('builds cohorts whose first column is always 100 %', () => {
    const c = engine.run('customers', { filters, ltvBy: 'segment' }).result;
    expect(c.cohorts.widened).toBe(true); // 3 months < 6 → widened to 12 (clamped to data start)
    for (const row of c.cohorts.retention) expect(row[0]).toBe(1);
  });
});
