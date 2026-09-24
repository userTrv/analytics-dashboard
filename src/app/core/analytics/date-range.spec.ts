import { addMonths, dayOfWeek, isIsoDate, monthDiff } from '../data/dates';
import { autoGranularity, clampRange, comparisonRange, rangeLength, resolveRange } from './date-range';

const ANCHOR = '2026-08-31';

describe('resolveRange', () => {
  it.each([
    ['7d', '2026-08-25', 7],
    ['30d', '2026-08-02', 30],
    ['90d', '2026-06-03', 90],
    ['qtd', '2026-07-01', 62],
    ['ytd', '2026-01-01', 243],
    ['12m', '2025-09-01', 365],
  ] as const)('%s ends on the anchor and starts on %s', (preset, start, days) => {
    const range = resolveRange(preset, ANCHOR);
    expect(range).toEqual({ start, end: ANCHOR });
    expect(rangeLength(range)).toBe(days);
  });

  it('normalises a reversed custom range and clamps it to bounds', () => {
    expect(resolveRange('custom', ANCHOR, { start: '2026-03-10', end: '2026-03-01' })).toEqual({ start: '2026-03-01', end: '2026-03-10' });
    const bounds = { start: '2024-01-01', end: ANCHOR };
    expect(resolveRange('custom', ANCHOR, { start: '2023-06-01', end: '2027-01-01' }, bounds)).toEqual(bounds);
  });

  it('clamps a range entirely outside the bounds to a single valid day', () => {
    expect(clampRange({ start: '2030-01-01', end: '2030-02-01' }, { start: '2024-01-01', end: ANCHOR })).toEqual({ start: ANCHOR, end: ANCHOR });
  });
});

describe('comparisonRange', () => {
  it('previous period has the same length and ends the day before', () => {
    const range = { start: '2026-06-03', end: ANCHOR };
    const prev = comparisonRange(range, 'previous')!;
    expect(prev).toEqual({ start: '2026-03-05', end: '2026-06-02' });
    expect(rangeLength(prev)).toBe(rangeLength(range));
  });

  it('year over year shifts both ends by one calendar year, clamping Feb 29', () => {
    expect(comparisonRange({ start: '2026-03-01', end: '2026-03-31' }, 'yoy')).toEqual({ start: '2025-03-01', end: '2025-03-31' });
    expect(comparisonRange({ start: '2024-02-29', end: '2024-02-29' }, 'yoy')).toEqual({ start: '2023-02-28', end: '2023-02-28' });
  });

  it('is null when comparison is off', () => {
    expect(comparisonRange({ start: '2026-01-01', end: '2026-01-31' }, 'none')).toBeNull();
  });
});

describe('calendar helpers', () => {
  it('picks a readable granularity', () => {
    expect(autoGranularity({ start: '2026-08-01', end: ANCHOR })).toBe('day');
    expect(autoGranularity({ start: '2026-01-01', end: ANCHOR })).toBe('week');
    expect(autoGranularity({ start: '2024-01-01', end: ANCHOR })).toBe('month');
  });

  it('handles month arithmetic, weekdays and validation', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2024-12-15', 2)).toBe('2025-02-15');
    expect(monthDiff('2024-11', '2025-02')).toBe(3);
    expect(dayOfWeek('2026-08-31')).toBe(0); // Monday
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });
});
