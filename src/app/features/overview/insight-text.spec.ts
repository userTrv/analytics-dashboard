import { describeInsight } from './insight-text';

describe('describeInsight', () => {
  it('describes a channel mover with its driver', () => {
    const text = describeInsight(
      {
        kind: 'mover',
        dimension: 'channel',
        member: 'paid_social',
        current: 82_000,
        previous: 100_000,
        pct: -0.18,
        driver: { members: ['DE', 'mobile'], delta: -12_600, share: 0.7 },
      },
      'previous period',
    );
    expect(text.tone).toBe('bad');
    expect(text.title).toBe('Paid social revenue −18.0% vs previous period');
    expect(text.detail).toContain('Driven by Germany · mobile (−$12.6K, 70% of the change)');
  });

  it('describes anomalies neutrally with σ and baseline', () => {
    const text = describeInsight({ kind: 'anomaly', anomaly: { date: '2025-11-28', value: 150_000, baseline: 50_000, z: 6.25, direction: 'spike' } }, 'previous period');
    expect(text.tone).toBe('neutral');
    expect(text.title).toBe('Unusual spike on Nov 28, 2025');
    expect(text.detail).toContain('6.3σ above');
    expect(text.detail).toContain('+200.0%');
  });
});
