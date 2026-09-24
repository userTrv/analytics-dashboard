import { rfmSegment } from './rfm';
import { bucketIndex, downsample, ratioSeries, sumByBucket, trailingBlocks } from './series';

describe('bucketIndex', () => {
  it('builds calendar months and flags partial ones', () => {
    const b = bucketIndex('2026-06-03', 90, 'month'); // Jun 3 – Aug 31
    expect(b.labels).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
    expect(b.partial).toEqual([true, false, false]);
    expect(sumByBucket(new Array(90).fill(1), b)).toEqual([28, 31, 31]);
  });

  it('aligns weeks to the end of the range so only the oldest block can be partial', () => {
    const b = bucketIndex('2026-06-03', 10, 'week');
    expect(b.labels).toEqual(['2026-06-03', '2026-06-06']);
    expect(b.partial).toEqual([true, false]);
    expect(sumByBucket(new Array(10).fill(1), b)).toEqual([3, 7]);
  });

  it('drops the partial oldest block for sparklines', () => {
    const b = trailingBlocks('2026-01-01', 10, 4);
    expect(sumByBucket(new Array(10).fill(1), b)).toEqual([4, 4]);
  });
});

describe('series helpers', () => {
  it('computes ratios with nulls for empty denominators and downsamples by sums', () => {
    expect(ratioSeries([1, 2], [2, 0])).toEqual([0.5, null]);
    expect(downsample([1, 1, 1, 1, 1], 2)).toEqual([3, 2]);
    expect(downsample([1, 2], 5)).toEqual([1, 2]);
  });
});

describe('rfmSegment', () => {
  it('applies the documented rules in priority order', () => {
    expect(rfmSegment(10, 5, 400)).toBe('champions');
    expect(rfmSegment(80, 3, 400)).toBe('loyal');
    expect(rfmSegment(5, 1, 5)).toBe('new');
    expect(rfmSegment(45, 2, 200)).toBe('promising');
    expect(rfmSegment(200, 3, 400)).toBe('atRisk');
    expect(rfmSegment(100, 1, 300)).toBe('hibernating');
  });
});
