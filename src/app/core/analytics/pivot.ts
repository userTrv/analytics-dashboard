/**
 * Generic pivot engine: groups rows by up to three row dimensions and one column dimension,
 * aggregates metrics per cell and rolls leaves up into subtotals and a grand total.
 * It knows nothing about the dataset — rows are reached through accessors.
 */
export type PivotDimension =
  | 'region'
  | 'country'
  | 'channel'
  | 'device'
  | 'category'
  | 'product'
  | 'segment'
  | 'customerType'
  | 'year'
  | 'quarter'
  | 'month'
  | 'weekday';

export type PivotField = 'revenue' | 'margin' | 'cost' | 'discount' | 'units' | 'orders' | 'customers' | 'marginPct' | 'refundRate';
export type Aggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct' | 'ratio';

export interface PivotMetric {
  readonly field: PivotField;
  readonly agg: Aggregation;
}

export type PivotSort = { readonly by: 'label' } | { readonly by: 'metric'; readonly metric: number; readonly dir: 'asc' | 'desc' };

export interface PivotConfig {
  readonly rows: readonly PivotDimension[];
  readonly columns: PivotDimension | null;
  readonly metrics: readonly PivotMetric[];
  readonly sort: PivotSort;
}

export const MAX_ROW_DIMENSIONS = 3;
export const MAX_METRICS = 4;

export const FIELD_AGGREGATIONS: Readonly<Record<PivotField, readonly Aggregation[]>> = {
  revenue: ['sum', 'avg', 'min', 'max'],
  margin: ['sum', 'avg', 'min', 'max'],
  cost: ['sum', 'avg'],
  discount: ['sum', 'avg'],
  units: ['sum', 'avg', 'max'],
  orders: ['count'],
  customers: ['distinct'],
  marginPct: ['ratio'],
  refundRate: ['ratio'],
};

export interface PivotAccessors {
  /** Row indices to aggregate. */
  readonly rows: ArrayLike<number>;
  /** Member index (0..1022) of a dimension for a row; only dimensions used by the config are read. */
  readonly member: (dim: PivotDimension, row: number) => number;
  readonly revenue: (row: number) => number;
  readonly cost: (row: number) => number;
  readonly discount: (row: number) => number;
  readonly units: (row: number) => number;
  readonly customer: (row: number) => number;
  readonly refunded: (row: number) => boolean;
}

export interface PivotNode {
  /** Member indices from the first row dimension down to this node. */
  readonly path: readonly number[];
  readonly leaf: boolean;
  /** `values[col * metrics + m]`; the last block (col = colKeys.length) is the row total. */
  readonly values: readonly (number | null)[];
}

export interface PivotResult {
  readonly colKeys: readonly number[];
  /** Depth-first: a group row precedes its children. */
  readonly rows: readonly PivotNode[];
  readonly grandTotal: readonly (number | null)[];
  readonly leafCount: number;
}

const BASE = 1024;
const NONE = BASE - 1;

class Acc {
  count = 0;
  readonly sum: Float64Array;
  readonly den: Float64Array;
  readonly min: Float64Array;
  readonly max: Float64Array;
  readonly sets: (Set<number> | null)[];

  constructor(metrics: readonly PivotMetric[]) {
    const n = metrics.length;
    this.sum = new Float64Array(n);
    this.den = new Float64Array(n);
    this.min = new Float64Array(n).fill(Infinity);
    this.max = new Float64Array(n).fill(-Infinity);
    this.sets = metrics.map((m) => (m.agg === 'distinct' ? new Set<number>() : null));
  }

  merge(other: Acc): void {
    this.count += other.count;
    for (let m = 0; m < this.sum.length; m++) {
      this.sum[m] += other.sum[m];
      this.den[m] += other.den[m];
      if (other.min[m] < this.min[m]) this.min[m] = other.min[m];
      if (other.max[m] > this.max[m]) this.max[m] = other.max[m];
      const set = this.sets[m];
      if (set) for (const v of other.sets[m]!) set.add(v);
    }
  }
}

function fieldValue(field: PivotField, a: PivotAccessors, row: number): number {
  switch (field) {
    case 'revenue':
      return a.revenue(row);
    case 'margin':
    case 'marginPct':
      return a.refunded(row) ? 0 : a.revenue(row) - a.cost(row);
    case 'cost':
      return a.cost(row);
    case 'discount':
      return a.discount(row);
    case 'units':
      return a.units(row);
    case 'orders':
      return 1;
    case 'customers':
      return a.customer(row);
    case 'refundRate':
      return a.refunded(row) ? 1 : 0;
  }
}

function denominator(field: PivotField, a: PivotAccessors, row: number): number {
  if (field === 'marginPct') return a.refunded(row) ? 0 : a.revenue(row);
  return 1;
}

function finalize(acc: Acc | undefined, metrics: readonly PivotMetric[], m: number): number | null {
  if (!acc || acc.count === 0) return null;
  switch (metrics[m].agg) {
    case 'sum':
      return acc.sum[m];
    case 'avg':
      return acc.sum[m] / acc.count;
    case 'min':
      return acc.min[m];
    case 'max':
      return acc.max[m];
    case 'count':
      return acc.count;
    case 'distinct':
      return acc.sets[m]!.size;
    case 'ratio':
      return acc.den[m] === 0 ? null : acc.sum[m] / acc.den[m];
  }
}

/** Numeric cell key: row path padded with NONE to three levels, then the column member. */
function encode(path: readonly number[], col: number): number {
  let key = 0;
  for (let l = 0; l < MAX_ROW_DIMENSIONS; l++) key = key * BASE + (l < path.length ? path[l] : NONE);
  return key * BASE + col;
}

export function buildPivot(config: PivotConfig, a: PivotAccessors): PivotResult {
  const { rows: dims, columns, metrics } = config;
  if (dims.length > MAX_ROW_DIMENSIONS) throw new Error(`At most ${MAX_ROW_DIMENSIONS} row dimensions`);
  const depth = dims.length;

  // 1. Leaf cells (full row path × column member).
  const leaves = new Map<number, { path: number[]; col: number; acc: Acc }>();
  const path = new Array<number>(depth);
  for (let r = 0; r < a.rows.length; r++) {
    const row = a.rows[r];
    for (let l = 0; l < depth; l++) path[l] = a.member(dims[l], row);
    const col = columns ? a.member(columns, row) : NONE;
    const key = encode(path, col);
    let leaf = leaves.get(key);
    if (!leaf) leaves.set(key, (leaf = { path: path.slice(), col, acc: new Acc(metrics) }));
    const acc = leaf.acc;
    acc.count++;
    for (let m = 0; m < metrics.length; m++) {
      const v = fieldValue(metrics[m].field, a, row);
      acc.sum[m] += v;
      acc.den[m] += denominator(metrics[m].field, a, row);
      if (v < acc.min[m]) acc.min[m] = v;
      if (v > acc.max[m]) acc.max[m] = v;
      acc.sets[m]?.add(v);
    }
  }

  // 2. Roll leaves up into every prefix level and the row-total column.
  const cells = new Map<number, Acc>();
  const children = new Map<number, Set<number>>();
  const colSet = new Set<number>();
  for (const leaf of leaves.values()) {
    if (columns) colSet.add(leaf.col);
    for (let l = 0; l <= depth; l++) {
      const prefix = leaf.path.slice(0, l);
      if (l < depth) {
        const parent = encode(prefix, NONE);
        let set = children.get(parent);
        if (!set) children.set(parent, (set = new Set()));
        set.add(leaf.path[l]);
      }
      const targets = columns ? [leaf.col, NONE] : [NONE];
      for (const col of targets) {
        const key = encode(prefix, col);
        let acc = cells.get(key);
        if (!acc) cells.set(key, (acc = new Acc(metrics)));
        acc.merge(leaf.acc);
      }
    }
  }

  const colKeys = [...colSet].sort((x, y) => x - y);
  const valuesFor = (p: readonly number[]): (number | null)[] => {
    const out: (number | null)[] = [];
    for (const col of [...colKeys, NONE]) {
      const acc = cells.get(encode(p, col));
      for (let m = 0; m < metrics.length; m++) out.push(finalize(acc, metrics, m));
    }
    return out;
  };

  // 3. Depth-first flattening with per-level sorting of siblings.
  const totalOffset = colKeys.length * metrics.length;
  const rowsOut: PivotNode[] = [];
  const walk = (prefix: number[]): void => {
    const members = [...(children.get(encode(prefix, NONE)) ?? [])];
    const nodes = members.map((m) => {
      const p = [...prefix, m];
      return { p, values: valuesFor(p) };
    });
    const sort = config.sort;
    if (sort.by === 'metric') {
      const idx = totalOffset + sort.metric;
      const dir = sort.dir === 'asc' ? 1 : -1;
      nodes.sort((x, y) => dir * ((x.values[idx] ?? -Infinity) - (y.values[idx] ?? -Infinity)) || x.p[x.p.length - 1] - y.p[y.p.length - 1]);
    } else {
      nodes.sort((x, y) => x.p[x.p.length - 1] - y.p[y.p.length - 1]);
    }
    for (const node of nodes) {
      const leaf = node.p.length === depth;
      rowsOut.push({ path: node.p, leaf, values: node.values });
      if (!leaf) walk(node.p);
    }
  };
  if (depth > 0) walk([]);

  return { colKeys, rows: rowsOut, grandTotal: valuesFor([]), leafCount: rowsOut.filter((r) => r.leaf).length };
}
