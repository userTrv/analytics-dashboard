/**
 * Rule-based RFM segmentation. Deliberately simple and explainable: thresholds on recency
 * (days since last order) and frequency (orders in the trailing 12 months).
 */
export type RfmSegment = 'champions' | 'loyal' | 'new' | 'promising' | 'atRisk' | 'hibernating';

export const RFM_SEGMENTS: readonly { code: RfmSegment; label: string; rule: string }[] = [
  { code: 'champions', label: 'Champions', rule: 'Ordered in the last 30 days, 4+ orders' },
  { code: 'loyal', label: 'Loyal', rule: 'Ordered in the last 90 days, 3+ orders' },
  { code: 'new', label: 'New', rule: 'First order in the last 30 days' },
  { code: 'promising', label: 'Promising', rule: 'Ordered in the last 60 days, 1–2 orders' },
  { code: 'atRisk', label: 'At risk', rule: '2+ orders, silent for 120+ days' },
  { code: 'hibernating', label: 'Hibernating', rule: 'Everyone else active in the last 12 months' },
];

export function rfmSegment(recencyDays: number, frequency: number, tenureDays: number): RfmSegment {
  if (recencyDays <= 30 && frequency >= 4) return 'champions';
  if (recencyDays <= 90 && frequency >= 3) return 'loyal';
  if (tenureDays <= 30 && frequency === 1) return 'new';
  if (recencyDays <= 60 && frequency <= 2) return 'promising';
  if (frequency >= 2 && recencyDays > 120) return 'atRisk';
  return 'hibernating';
}
