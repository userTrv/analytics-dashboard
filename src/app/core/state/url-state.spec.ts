import { DEFAULT_FILTER_STATE, FilterState } from '../analytics/filters';
import { compactParams, filtersToParams, paramsToFilters } from './url-state';

const roundTrip = (state: FilterState) => paramsToFilters(compactParams(filtersToParams(state)));

describe('URL ⇄ filter state', () => {
  it('omits defaults entirely', () => {
    expect(compactParams(filtersToParams(DEFAULT_FILTER_STATE))).toEqual({});
    expect(paramsToFilters({})).toEqual(DEFAULT_FILTER_STATE);
  });

  it('round-trips presets, comparison and dimension lists', () => {
    const state: FilterState = { ...DEFAULT_FILTER_STATE, preset: 'ytd', compare: 'yoy', region: ['eu'], country: ['DE', 'FR'], channel: ['paid_social'], device: ['mobile'], category: ['apparel'], segment: ['smb'] };
    expect(compactParams(filtersToParams(state))).toEqual({ range: 'ytd', cmp: 'yoy', region: 'eu', country: 'DE,FR', channel: 'paid_social', device: 'mobile', cat: 'apparel', seg: 'smb' });
    expect(roundTrip(state)).toEqual(state);
  });

  it('round-trips a custom range', () => {
    const state: FilterState = { ...DEFAULT_FILTER_STATE, preset: 'custom', start: '2025-11-01', end: '2025-12-31' };
    expect(compactParams(filtersToParams(state))).toEqual({ range: 'custom', from: '2025-11-01', to: '2025-12-31' });
    expect(roundTrip(state)).toEqual(state);
  });

  it('maps defaults to null so a merge removes stale params', () => {
    const params = filtersToParams(DEFAULT_FILTER_STATE);
    expect(params['country']).toBeNull();
    expect(params['range']).toBeNull();
  });

  it('sanitises hostile or broken input', () => {
    const parsed = paramsToFilters({ range: 'forever', cmp: 'nope', country: 'DE,XX,<script>,DE', channel: '' });
    expect(parsed.preset).toBe(DEFAULT_FILTER_STATE.preset);
    expect(parsed.compare).toBe('previous');
    expect(parsed.country).toEqual(['DE']);
    expect(parsed.channel).toEqual([]);
  });

  it('falls back when a custom range has invalid dates and swaps reversed ones', () => {
    expect(paramsToFilters({ range: 'custom', from: '2025-02-30', to: '2025-03-01' }).preset).toBe(DEFAULT_FILTER_STATE.preset);
    const swapped = paramsToFilters({ range: 'custom', from: '2025-03-10', to: '2025-03-01' });
    expect([swapped.start, swapped.end]).toEqual(['2025-03-01', '2025-03-10']);
  });

  it('canonicalises member order to the catalogue order', () => {
    expect(paramsToFilters({ country: 'FR,DE,US' }).country).toEqual(['US', 'DE', 'FR']);
  });
});
