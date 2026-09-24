import { COMPARE_MODES, DateRange } from '../../core/analytics/date-range';
import { DIMENSION_KEYS, FilterState } from '../../core/analytics/filters';
import { DIMENSION_MEMBERS, DimensionKey } from '../../core/data/catalog';
import { formatRange } from './format';

const DIMENSION_NAMES: Readonly<Record<DimensionKey, string>> = {
  region: 'Region',
  country: 'Country',
  channel: 'Channel',
  device: 'Device',
  category: 'Category',
  segment: 'Segment',
};

/** One-line human description of the active filters, e.g. for printed reports. */
export function describeFilters(state: FilterState, range: DateRange, comparison: DateRange | null): string {
  const parts = [formatRange(range.start, range.end)];
  if (comparison) parts.push(`vs ${COMPARE_MODES.find((m) => m.value === state.compare)?.label.toLowerCase()} (${formatRange(comparison.start, comparison.end)})`);
  for (const key of DIMENSION_KEYS) {
    if (!state[key].length) continue;
    const labels = state[key].map((code) => DIMENSION_MEMBERS[key].find((m) => m.code === code)?.label ?? code);
    parts.push(`${DIMENSION_NAMES[key]}: ${labels.join(', ')}`);
  }
  return parts.join(' · ');
}
