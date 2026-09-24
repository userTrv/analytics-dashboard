import { Insight } from '../../core/analytics/insights';
import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES } from '../../core/data/catalog';
import { formatCurrency, formatDate, formatDelta, formatPercent } from '../../shared/format/format';

export interface InsightText {
  readonly tone: 'good' | 'bad' | 'neutral';
  readonly title: string;
  readonly detail: string;
}

const label = (code: string) =>
  [...CHANNELS, ...CATEGORIES, ...COUNTRIES, ...DEVICES].find((m) => m.code === code)?.label ?? code;

function driverText(members: readonly string[]): string {
  // Devices read better lower-case in a sentence: "Germany · mobile".
  return members.map((m) => (DEVICES.some((d) => d.code === m) ? label(m).toLowerCase() : label(m))).join(' · ');
}

/** Plain-language wording for a structured insight. Numbers only — no speculation about causes. */
export function describeInsight(insight: Insight, comparisonLabel: string): InsightText {
  switch (insight.kind) {
    case 'total':
      return {
        tone: insight.pct >= 0 ? 'good' : 'bad',
        title: `Revenue ${formatDelta(insight.pct)} vs ${comparisonLabel}`,
        detail: `${formatCurrency(insight.current, true)} against ${formatCurrency(insight.previous, true)}.`,
      };
    case 'mover': {
      const change = insight.current - insight.previous;
      const sign = change >= 0 ? '+' : '−';
      const what = insight.dimension === 'channel' ? `${label(insight.member)} revenue` : `${label(insight.member)} revenue`;
      const driver = insight.driver
        ? `Driven by ${driverText(insight.driver.members)} (${sign}${formatCurrency(Math.abs(insight.driver.delta), true)}, ${formatPercent(Math.min(insight.driver.share, 9.99), 0)} of the change).`
        : 'The change is spread across countries and devices.';
      return {
        tone: change >= 0 ? 'good' : 'bad',
        title: `${what} ${formatDelta(insight.pct)} vs ${comparisonLabel}`,
        detail: `${sign}${formatCurrency(Math.abs(change), true)} in absolute terms. ${insight.dimension === 'channel' ? driver : ''}`.trim(),
      };
    }
    case 'anomaly': {
      const a = insight.anomaly;
      const pct = a.baseline ? (a.value - a.baseline) / a.baseline : null;
      return {
        tone: 'neutral',
        title: `Unusual ${a.direction} on ${formatDate(a.date)}`,
        detail: `Revenue ${formatCurrency(a.value, true)} is ${Math.abs(a.z).toFixed(1)}σ ${a.direction === 'spike' ? 'above' : 'below'} the 28-day baseline (${formatDelta(pct)}).`,
      };
    }
  }
}
