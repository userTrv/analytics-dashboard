/**
 * Small, fast, seedable PRNG (mulberry32) plus the sampling helpers the generator needs.
 * Deterministic across engines: only 32-bit integer math and IEEE doubles.
 */
export class Rng {
  private state: number;
  private spareNormal: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal via Box–Muller (caches the second value). */
  normal(): number {
    if (this.spareNormal !== null) {
      const v = this.spareNormal;
      this.spareNormal = null;
      return v;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spareNormal = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  /** Multiplicative noise centred on 1 (median = 1). */
  logNormal(sigma: number): number {
    return Math.exp(this.normal() * sigma);
  }

  exponential(mean: number): number {
    return -Math.log(1 - this.next()) * mean;
  }

  /** Poisson sample; Knuth for small lambdas, normal approximation above 40. */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * this.normal()));
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > limit);
    return k - 1;
  }

  /** Picks an index given a cumulative-weights array whose last element is the total. */
  pickCumulative(cumulative: Float64Array | readonly number[]): number {
    const target = this.next() * cumulative[cumulative.length - 1];
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid] > target) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }
}

export function cumulative(weights: readonly number[]): Float64Array {
  const out = new Float64Array(weights.length);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    out[i] = acc;
  }
  return out;
}
