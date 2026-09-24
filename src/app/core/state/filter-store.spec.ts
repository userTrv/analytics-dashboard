import { TestBed } from '@angular/core/testing';
import { DEFAULT_FILTER_STATE } from '../analytics/filters';
import { FilterStore } from './filter-store';

describe('FilterStore', () => {
  let store: FilterStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(FilterStore);
  });

  it('starts at the default 90-day window anchored to the end of the data', () => {
    expect(store.state()).toEqual(DEFAULT_FILTER_STATE);
    expect(store.range()).toEqual({ start: '2026-06-03', end: '2026-08-31' });
    expect(store.comparison()).toEqual({ start: '2026-03-05', end: '2026-06-02' });
  });

  it('switches presets and custom ranges', () => {
    store.setPreset('7d');
    expect(store.range()).toEqual({ start: '2026-08-25', end: '2026-08-31' });
    store.setCustomRange('2025-12-31', '2025-12-01');
    expect(store.state().preset).toBe('custom');
    expect(store.range()).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('clamps custom ranges to the data and flags partial comparisons', () => {
    store.setCustomRange('2023-01-01', '2024-02-15');
    expect(store.range()).toEqual({ start: '2024-01-01', end: '2024-02-15' });
    expect(store.comparisonPartial()).toBe(true);
    store.setCompare('none');
    expect(store.comparison()).toBeNull();
    expect(store.comparisonPartial()).toBe(false);
  });

  it('toggles dimension members in catalogue order and counts active dimensions', () => {
    store.toggle('country', 'FR');
    store.toggle('country', 'US');
    expect(store.state().country).toEqual(['US', 'FR']);
    store.toggle('country', 'US');
    expect(store.state().country).toEqual(['FR']);
    store.setDimension('channel', ['email', 'organic']);
    expect(store.state().channel).toEqual(['organic', 'email']);
    expect(store.activeDimensionCount()).toBe(2);
    expect(store.linkParams()).toEqual({ country: 'FR', channel: 'organic,email' });
  });

  it('only emits new query filters when something relevant changed', () => {
    const first = store.queryFilters();
    store.setDimension('device', []); // no-op
    expect(store.queryFilters()).toBe(first);
    store.setDimension('device', ['mobile']);
    expect(store.queryFilters()).not.toBe(first);
    expect(store.queryFilters().device).toEqual(['mobile']);
  });

  it('resets dimensions without touching the date range, and resets everything', () => {
    store.setPreset('12m');
    store.toggle('segment', 'smb');
    store.clearDimensions();
    expect(store.state().segment).toEqual([]);
    expect(store.preset()).toBe('12m');
    store.reset();
    expect(store.state()).toEqual(DEFAULT_FILTER_STATE);
  });
});
