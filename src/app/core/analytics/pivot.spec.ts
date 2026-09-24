import { buildPivot, PivotAccessors, PivotConfig, PivotDimension } from './pivot';

interface Row {
  region: number;
  channel: number;
  year: number;
  revenue: number;
  cost: number;
  customer: number;
  refunded: boolean;
}

const rows: Row[] = [
  { region: 0, channel: 0, year: 0, revenue: 100, cost: 60, customer: 1, refunded: false },
  { region: 0, channel: 0, year: 1, revenue: 50, cost: 30, customer: 1, refunded: false },
  { region: 0, channel: 1, year: 1, revenue: 30, cost: 10, customer: 2, refunded: true },
  { region: 1, channel: 0, year: 0, revenue: 200, cost: 100, customer: 3, refunded: false },
  { region: 1, channel: 1, year: 0, revenue: 20, cost: 5, customer: 3, refunded: false },
];

const accessors: PivotAccessors = {
  rows: rows.map((_, i) => i),
  member: (dim: PivotDimension, i: number) => rows[i][dim as 'region' | 'channel' | 'year'],
  revenue: (i) => rows[i].revenue,
  cost: (i) => rows[i].cost,
  discount: () => 0,
  units: () => 1,
  customer: (i) => rows[i].customer,
  refunded: (i) => rows[i].refunded,
};

const base: PivotConfig = {
  rows: ['region', 'channel'],
  columns: null,
  metrics: [
    { field: 'revenue', agg: 'sum' },
    { field: 'orders', agg: 'count' },
  ],
  sort: { by: 'label' },
};

describe('buildPivot', () => {
  it('emits group rows with subtotals before their children, and a grand total', () => {
    const result = buildPivot(base, accessors);
    expect(result.rows.map((r) => [r.path.join('.'), r.leaf, r.values])).toEqual([
      ['0', false, [180, 3]],
      ['0.0', true, [150, 2]],
      ['0.1', true, [30, 1]],
      ['1', false, [220, 2]],
      ['1.0', true, [200, 1]],
      ['1.1', true, [20, 1]],
    ]);
    expect(result.grandTotal).toEqual([400, 5]);
    expect(result.leafCount).toBe(4);
  });

  it('adds a column dimension with per-column cells and a row-total block', () => {
    const result = buildPivot({ ...base, rows: ['region'], columns: 'year', metrics: [{ field: 'revenue', agg: 'sum' }] }, accessors);
    expect(result.colKeys).toEqual([0, 1]);
    // [year 0, year 1, total]
    expect(result.rows[0].values).toEqual([100, 80, 180]);
    expect(result.rows[1].values).toEqual([220, null, 220]);
    expect(result.grandTotal).toEqual([320, 80, 400]);
  });

  it('supports avg/min/max, distinct counts and ratio metrics that roll up correctly', () => {
    const result = buildPivot(
      {
        ...base,
        rows: ['region'],
        metrics: [
          { field: 'revenue', agg: 'avg' },
          { field: 'revenue', agg: 'max' },
          { field: 'customers', agg: 'distinct' },
          { field: 'refundRate', agg: 'ratio' },
        ],
      },
      accessors,
    );
    expect(result.rows[0].values).toEqual([60, 100, 2, 1 / 3]);
    // Distinct customers are unioned, not summed: {1, 2} ∪ {3} = 3.
    expect(result.grandTotal).toEqual([80, 200, 3, 0.2]);
  });

  it('computes margin % as a ratio of sums, with refunded orders earning nothing', () => {
    const result = buildPivot({ ...base, rows: ['region'], metrics: [{ field: 'marginPct', agg: 'ratio' }] }, accessors);
    // Region 0: margin (40 + 20 + 0) / revenue (100 + 50) = 0.4 — the refunded order is excluded.
    expect(result.rows[0].values[0]).toBeCloseTo(0.4);
  });

  it('sorts siblings by a metric within each level', () => {
    const result = buildPivot({ ...base, sort: { by: 'metric', metric: 0, dir: 'desc' } }, accessors);
    expect(result.rows.map((r) => r.path.join('.'))).toEqual(['1', '1.0', '1.1', '0', '0.0', '0.1']);
  });

  it('rejects more than three row dimensions', () => {
    expect(() => buildPivot({ ...base, rows: ['region', 'channel', 'year', 'device'] }, accessors)).toThrow();
  });
});
