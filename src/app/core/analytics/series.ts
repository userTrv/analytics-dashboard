import { addDays, IsoDate, startOfMonth } from '../data/dates';
import { Granularity } from './date-range';
import { emptyTotals, Totals, TOTAL_KEYS } from './metrics';
import type { DailySeries } from './queries/scan';

export interface BucketIndex {
  /** First day of each bucket inside the range (month buckets: the 1st of the month). */
  readonly labels: IsoDate[];
  /** Bucket number per day offset. */
  readonly index: Int32Array;
  /** True when the range covers only part of the bucket's calendar period. */
  readonly partial: boolean[];
}

function periodDays(key: IsoDate, granularity: Granularity): number {
  if (granularity === 'day') return 1;
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Maps each day of `[start, start + days)` to a bucket. Days and calendar months are
 * calendar buckets; weeks are 7-day blocks aligned to the END of the range, so the newest
 * week is always complete and only the oldest block can be partial.
 */
export function bucketIndex(start: IsoDate, days: number, granularity: Granularity): BucketIndex {
  if (granularity === 'week') {
    const offset = days % 7;
    const index = new Int32Array(days);
    const labels: IsoDate[] = [];
    for (let i = 0; i < days; i++) {
      const b = offset === 0 ? Math.floor(i / 7) : i < offset ? 0 : Math.floor((i - offset) / 7) + 1;
      if (b === labels.length) labels.push(addDays(start, i));
      index[i] = b;
    }
    return { labels, index, partial: labels.map((_, b) => b === 0 && offset !== 0) };
  }
  const labels: IsoDate[] = [];
  const index = new Int32Array(days);
  let current = '';
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const key = granularity === 'day' ? date : startOfMonth(date);
    if (key !== current) {
      labels.push(key);
      current = key;
    }
    index[i] = labels.length - 1;
  }
  const counts = new Array<number>(labels.length).fill(0);
  for (let i = 0; i < days; i++) counts[index[i]]++;
  return { labels, index, partial: labels.map((key, b) => counts[b] < periodDays(key, granularity)) };
}

/**
 * Consecutive blocks of `size` days aligned to the END of the range (the newest block is
 * always complete). A partial oldest block is dropped: sparklines show shape, not totals.
 */
export function trailingBlocks(start: IsoDate, days: number, size: number): BucketIndex {
  const offset = days % size;
  const index = new Int32Array(days);
  const labels: IsoDate[] = [];
  for (let i = 0; i < days; i++) {
    if (i < offset) {
      index[i] = -1;
      continue;
    }
    const b = Math.floor((i - offset) / size);
    if (b === labels.length) labels.push(addDays(start, i));
    index[i] = b;
  }
  return { labels, index, partial: labels.map(() => false) };
}

export function sumByBucket(values: ArrayLike<number>, bucket: BucketIndex): number[] {
  const out = new Array<number>(bucket.labels.length).fill(0);
  const n = Math.min(values.length, bucket.index.length);
  for (let i = 0; i < n; i++) if (bucket.index[i] >= 0) out[bucket.index[i]] += values[i];
  return out;
}

/** Element-wise ratio of two bucketed series, null where the denominator is 0. */
export function ratioSeries(numerator: readonly number[], denominator: readonly number[]): (number | null)[] {
  return numerator.map((v, i) => (denominator[i] === 0 ? null : v / denominator[i]));
}

/** Downsamples a daily series to at most `maxPoints` equal-width sums (for sparklines). */
export function downsample(values: ArrayLike<number>, maxPoints: number): number[] {
  if (values.length <= maxPoints) return Array.from(values);
  const size = Math.ceil(values.length / maxPoints);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += size) {
    let sum = 0;
    for (let j = i; j < Math.min(i + size, values.length); j++) sum += values[j];
    out.push(sum);
  }
  return out;
}

/** Additive totals per bucket, so ratio KPIs (AOV, CR…) can be computed per bucket. */
export function bucketTotals(series: DailySeries, bucket: BucketIndex): Totals[] {
  const out = bucket.labels.map(() => emptyTotals());
  const n = Math.min(series.length, bucket.index.length);
  for (const key of TOTAL_KEYS) {
    const values = series[key];
    for (let i = 0; i < n; i++) if (bucket.index[i] >= 0) out[bucket.index[i]][key] += values[i];
  }
  return out;
}
