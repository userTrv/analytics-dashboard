import { detectAnomalies, rollingZScores } from './anomalies';
import { findDriver, findMovers } from './insights';

describe('rollingZScores', () => {
  it('is null until a full window exists and for a flat baseline', () => {
    const z = rollingZScores([5, 5, 5, 5, 9], 4);
    expect(z.slice(0, 4)).toEqual([null, null, null, null]);
    expect(z[4]).toBeNull(); // std of [5,5,5,5] is 0
  });

  it('measures distance from the trailing window, excluding the point itself', () => {
    // Window [1, 3, 1, 3]: mean 2, std 1 → value 5 is 3σ above.
    const z = rollingZScores([1, 3, 1, 3, 5], 4);
    expect(z[4]).toBeCloseTo(3);
  });
});

describe('detectAnomalies', () => {
  it('flags spikes and drops beyond the threshold with dates and baseline', () => {
    const values = [10, 12, 10, 12, 10, 12, 30, 11, 12, 11, 12, 11, 12, 0];
    const found = detectAnomalies('2026-01-01', values, { window: 6, threshold: 3 });
    expect(found.map((a) => [a.date, a.direction])).toEqual([
      ['2026-01-07', 'spike'],
      ['2026-01-14', 'drop'],
    ]);
    expect(found[0].baseline).toBe(11);
  });
});

describe('insight helpers', () => {
  it('finds significant movers and ignores small or tiny-base members', () => {
    const movers = findMovers([
      { code: 'a', current: 80, previous: 100 },
      { code: 'b', current: 103, previous: 100 },
      { code: 'c', current: 3, previous: 1 },
      { code: 'd', current: 130, previous: 100 },
    ]);
    expect(movers.map((m) => m.code)).toEqual(['d', 'a']);
  });

  it('names a driver only when it explains a large share of the change', () => {
    expect(findDriver(-100, [{ members: ['DE'], delta: -70 }, { members: ['FR'], delta: -30 }])).toEqual({ members: ['DE'], delta: -70, share: 0.7 });
    expect(findDriver(-100, [{ members: ['DE'], delta: -20 }, { members: ['FR'], delta: -20 }])).toBeNull();
    expect(findDriver(-100, [{ members: ['DE'], delta: 50 }])).toBeNull();
  });
});
