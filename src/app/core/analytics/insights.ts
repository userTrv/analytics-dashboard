import { Anomaly } from './anomalies';

/** Structured insight; wording happens in the UI so the worker stays presentation-free. */
export type Insight =
  | {
      readonly kind: 'mover';
      readonly dimension: 'channel' | 'category';
      readonly member: string;
      readonly current: number;
      readonly previous: number;
      readonly pct: number;
      readonly driver: Driver | null;
    }
  | { readonly kind: 'anomaly'; readonly anomaly: Anomaly }
  | { readonly kind: 'total'; readonly current: number; readonly previous: number; readonly pct: number };

export interface Driver {
  /** Codes of the members that together explain most of the change, e.g. ['DE', 'mobile']. */
  readonly members: readonly string[];
  readonly delta: number;
  /** Driver delta ÷ total delta of the mover (0..1+). */
  readonly share: number;
}

export interface MemberChange {
  readonly code: string;
  readonly current: number;
  readonly previous: number;
}

export interface DriverCandidate {
  readonly members: readonly string[];
  readonly delta: number;
}

/**
 * Picks the most significant movers. A member qualifies when it changed by at least
 * `minPct` and its absolute change is at least `minShareOfTotal` of the previous total —
 * small members with big percentages are noise, not insight.
 */
export function findMovers(changes: readonly MemberChange[], minPct = 0.05, minShareOfTotal = 0.01): MemberChange[] {
  const totalPrev = changes.reduce((s, c) => s + c.previous, 0);
  return changes
    .filter((c) => c.previous > 0)
    .filter((c) => Math.abs(c.current - c.previous) / c.previous >= minPct)
    .filter((c) => Math.abs(c.current - c.previous) >= minShareOfTotal * totalPrev)
    .sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous));
}

/** The candidate that moved most in the same direction as the total, if it explains ≥ minShare. */
export function findDriver(totalDelta: number, candidates: readonly DriverCandidate[], minShare = 0.35): Driver | null {
  if (totalDelta === 0) return null;
  const sign = Math.sign(totalDelta);
  let best: DriverCandidate | null = null;
  for (const c of candidates) {
    if (sign * c.delta > 0 && (best === null || sign * c.delta > sign * best.delta)) best = c;
  }
  if (!best) return null;
  const share = best.delta / totalDelta;
  return share >= minShare ? { members: best.members, delta: best.delta, share } : null;
}
