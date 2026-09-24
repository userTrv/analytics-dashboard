import { CATEGORIES, PRODUCTS } from './catalog';
import { blackFriday } from './calendar-effects';
import { generateDataset, GeneratorOptions } from './generator';
import { Rng } from './rng';

const SMALL: GeneratorOptions = { seed: 42, start: '2025-01-01', end: '2025-06-30', newCustomersPerDay: 12 };

describe('Rng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const c = new Rng(8);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
  });

  it('keeps samples in range and roughly centred', () => {
    const rng = new Rng(1);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1);
    const poisson = Array.from({ length: 5000 }, () => rng.poisson(4));
    expect(poisson.reduce((s, v) => s + v, 0) / 5000).toBeCloseTo(4, 0);
  });

  it('picks by cumulative weight', () => {
    const rng = new Rng(3);
    const counts = [0, 0];
    for (let i = 0; i < 4000; i++) counts[rng.pickCumulative([1, 4])]++;
    expect(counts[1] / 4000).toBeCloseTo(0.75, 1);
  });
});

describe('generateDataset', () => {
  const ds = generateDataset(SMALL);

  it('is deterministic: the same seed yields identical columns', () => {
    const again = generateDataset(SMALL);
    expect(again.orderCount).toBe(ds.orderCount);
    expect(again.orders.revenue).toEqual(ds.orders.revenue);
    expect(again.traffic.sessions).toEqual(ds.traffic.sessions);
    expect(generateDataset({ ...SMALL, seed: 43 }).orders.revenue).not.toEqual(ds.orders.revenue);
  });

  it('sorts rows by day and indexes day starts', () => {
    expect(ds.days).toBe(181);
    expect(ds.orderCount).toBeGreaterThan(1000);
    for (let i = 1; i < ds.orderCount; i++) expect(ds.orders.day[i]).toBeGreaterThanOrEqual(ds.orders.day[i - 1]);
    expect(ds.dayStart[0]).toBe(0);
    expect(ds.dayStart[ds.days]).toBe(ds.orderCount);
    for (let d = 0; d < ds.days; d++) {
      for (let i = ds.dayStart[d]; i < ds.dayStart[d + 1]; i++) expect(ds.orders.day[i]).toBe(d);
    }
  });

  it('keeps order lines internally consistent', () => {
    const o = ds.orders;
    const firstOrders = new Map<number, number>();
    for (let i = 0; i < ds.orderCount; i++) {
      expect(o.revenue[i]).toBeGreaterThan(0);
      expect(o.qty[i]).toBeGreaterThanOrEqual(1);
      expect(o.category[i]).toBe(PRODUCTS[o.product[i]].category);
      expect(o.segment[i]).toBe(ds.customers.segment[o.customer[i]]);
      if (o.isNew[i]) {
        expect(firstOrders.has(o.customer[i])).toBe(false);
        firstOrders.set(o.customer[i], o.day[i]);
        expect(o.day[i]).toBe(ds.customers.firstDay[o.customer[i]]);
      } else {
        expect(o.day[i]).toBeGreaterThan(ds.customers.firstDay[o.customer[i]]);
      }
    }
    // Every customer has exactly one first order.
    expect(firstOrders.size).toBe(ds.customerCount);
  });

  it('produces a traffic cube whose purchases equal the orders and whose funnel narrows', () => {
    let purchases = 0;
    const t = ds.traffic;
    for (let c = 0; c < t.sessions.length; c++) {
      purchases += t.purchases[c];
      expect(t.sessions[c]).toBeGreaterThanOrEqual(t.views[c]);
      expect(t.views[c]).toBeGreaterThanOrEqual(t.carts[c]);
      expect(t.carts[c]).toBeGreaterThanOrEqual(t.checkouts[c]);
      expect(t.checkouts[c]).toBeGreaterThanOrEqual(t.purchases[c]);
    }
    expect(purchases).toBe(ds.orderCount);
  });

  it('covers every category', () => {
    const seen = new Set(Array.from(ds.orders.category));
    expect(seen.size).toBe(CATEGORIES.length);
  });
});

describe('blackFriday', () => {
  it('is the day after the fourth Thursday of November', () => {
    expect(blackFriday(2024)).toBe('2024-11-29');
    expect(blackFriday(2025)).toBe('2025-11-28');
    expect(blackFriday(2026)).toBe('2026-11-27');
  });
});
