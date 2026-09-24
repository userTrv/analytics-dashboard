import { IsoDate } from './dates';

/**
 * Columnar, dictionary-encoded storage. Each order line is one index `i` across all
 * `OrderColumns`; dimension columns hold indices into the catalogue arrays. Rows are sorted
 * by day, so a date range maps to one contiguous slice via `dayStart`.
 */
export interface OrderColumns {
  readonly day: Uint16Array;
  readonly customer: Uint32Array;
  readonly product: Uint16Array;
  readonly category: Uint8Array;
  readonly country: Uint8Array;
  readonly channel: Uint8Array;
  readonly device: Uint8Array;
  readonly segment: Uint8Array;
  readonly isNew: Uint8Array;
  readonly refunded: Uint8Array;
  readonly qty: Uint16Array;
  /** Gross revenue after discount, USD. */
  readonly revenue: Float64Array;
  /** Cost of goods, USD. */
  readonly cost: Float64Array;
  /** Discount given, USD. */
  readonly discount: Float64Array;
}

/** Attributes captured at acquisition (first order). */
export interface CustomerColumns {
  readonly firstDay: Uint16Array;
  readonly country: Uint8Array;
  readonly channel: Uint8Array;
  readonly device: Uint8Array;
  readonly segment: Uint8Array;
}

/**
 * Daily traffic & spend cube, one cell per (day, country, channel, device), day-major.
 * Category and segment are not tracked at session level — like in most real analytics stacks.
 */
export interface TrafficCube {
  readonly sessions: Uint32Array;
  readonly views: Uint32Array;
  readonly carts: Uint32Array;
  readonly checkouts: Uint32Array;
  readonly purchases: Uint32Array;
  readonly newCustomers: Uint32Array;
  readonly revenue: Float64Array;
  readonly spend: Float64Array;
}

export interface Dataset {
  readonly start: IsoDate;
  readonly end: IsoDate;
  readonly days: number;
  readonly orderCount: number;
  readonly customerCount: number;
  readonly orders: OrderColumns;
  readonly customers: CustomerColumns;
  /** `dayStart[d]` = first row of day `d`; length `days + 1`. */
  readonly dayStart: Uint32Array;
  readonly traffic: TrafficCube;
  /** Cells per day in the traffic cube (countries × channels × devices). */
  readonly trafficStride: number;
}

export interface DatasetMeta {
  readonly start: IsoDate;
  readonly end: IsoDate;
  readonly days: number;
  readonly orders: number;
  readonly customers: number;
  readonly trafficCells: number;
  readonly generationMs: number;
  readonly approxBytes: number;
}

export function datasetBytes(ds: Dataset): number {
  const cols = [
    ...Object.values(ds.orders),
    ...Object.values(ds.customers),
    ...Object.values(ds.traffic),
    ds.dayStart,
  ] as ArrayBufferView[];
  return cols.reduce((sum, c) => sum + c.byteLength, 0);
}
