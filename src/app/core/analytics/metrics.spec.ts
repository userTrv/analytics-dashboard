import { aov, cac, conversionRate, delta, emptyTotals, grossMargin, KPI_DEFINITIONS, ratio, refundRate, roas, Totals } from './metrics';

const totals = (patch: Partial<Totals>): Totals => ({ ...emptyTotals(), ...patch });

describe('metric formulas', () => {
  it('computes AOV, conversion, refund rate, ROAS and CAC', () => {
    const t = totals({ revenue: 1000, orders: 8, sessions: 400, purchases: 10, refundedOrders: 2, trafficRevenue: 1200, spend: 300, trafficNewCustomers: 6 });
    expect(aov(t)).toBe(125);
    expect(conversionRate(t)).toBe(0.025);
    expect(refundRate(t)).toBe(0.25);
    expect(roas(t)).toBe(4);
    expect(cac(t)).toBe(50);
  });

  it('computes gross margin on net revenue (refunds removed, refunded COGS excluded)', () => {
    // 1000 gross, 200 refunded → 800 net; COGS of kept orders 480 → 40 % margin.
    expect(grossMargin(totals({ revenue: 1000, refunds: 200, cogs: 480 }))).toBeCloseTo(0.4);
  });

  it('returns null instead of 0 or Infinity when the denominator is zero', () => {
    const empty = emptyTotals();
    expect(ratio(5, 0)).toBeNull();
    expect(aov(empty)).toBeNull();
    expect(conversionRate(empty)).toBeNull();
    expect(roas(totals({ trafficRevenue: 100 }))).toBeNull();
    expect(cac(totals({ spend: 100 }))).toBeNull();
    expect(grossMargin(totals({ revenue: 100, refunds: 100 }))).toBeNull();
    for (const kpi of KPI_DEFINITIONS) expect(() => kpi.value(empty)).not.toThrow();
  });
});

describe('delta', () => {
  it('returns absolute and relative change', () => {
    expect(delta(120, 100)).toEqual({ abs: 20, pct: 0.2 });
    expect(delta(80, 100)).toEqual({ abs: -20, pct: -0.2 });
  });

  it('uses the magnitude of a negative base so the sign means direction', () => {
    expect(delta(-50, -100).pct).toBe(0.5);
  });

  it('has no percentage for a zero base and nothing for unknown values', () => {
    expect(delta(10, 0)).toEqual({ abs: 10, pct: null });
    expect(delta(null, 10)).toEqual({ abs: null, pct: null });
    expect(delta(10, null)).toEqual({ abs: null, pct: null });
  });
});
