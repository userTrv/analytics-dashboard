import { addDays, IsoDate } from '../data/dates';

/**
 * Rolling z-score: how many standard deviations each point sits from the mean of the
 * `window` points before it (the point itself is excluded so a spike cannot mask itself).
 * Returns null while there is not enough history or when the baseline is flat.
 */
export function rollingZScores(values: ArrayLike<number>, window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    if (i >= window) {
      const mean = sum / window;
      const variance = Math.max(0, sumSq / window - mean * mean);
      const std = Math.sqrt(variance);
      out[i] = std < 1e-9 ? null : (values[i] - mean) / std;
      const old = values[i - window];
      sum -= old;
      sumSq -= old * old;
    }
    sum += values[i];
    sumSq += values[i] * values[i];
  }
  return out;
}

export interface Anomaly {
  readonly date: IsoDate;
  readonly value: number;
  /** Mean of the trailing window. */
  readonly baseline: number;
  readonly z: number;
  readonly direction: 'spike' | 'drop';
}

/**
 * Flags days with |z| ≥ threshold. `values[0]` corresponds to `start`; only indices from
 * `reportFrom` are reported (the prefix is look-back history).
 */
export function detectAnomalies(
  start: IsoDate,
  values: ArrayLike<number>,
  options: { window?: number; threshold?: number; reportFrom?: number } = {},
): Anomaly[] {
  const window = options.window ?? 28;
  const threshold = options.threshold ?? 3;
  const reportFrom = options.reportFrom ?? window;
  const z = rollingZScores(values, window);
  const found: Anomaly[] = [];
  for (let i = reportFrom; i < values.length; i++) {
    const score = z[i];
    if (score === null || Math.abs(score) < threshold) continue;
    let base = 0;
    for (let j = i - window; j < i; j++) base += values[j];
    found.push({
      date: addDays(start, i),
      value: values[i],
      baseline: base / window,
      z: score,
      direction: score > 0 ? 'spike' : 'drop',
    });
  }
  return found;
}
