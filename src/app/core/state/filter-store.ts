import { computed, Injectable, signal } from '@angular/core';
import { comparisonRange, CompareMode, DateRange, RangePreset, resolveRange } from '../analytics/date-range';
import { activeDimensionCount, DEFAULT_FILTER_STATE, FilterState, QueryFilters, sameFilters } from '../analytics/filters';
import { DIMENSION_MEMBERS, DimensionKey } from '../data/catalog';
import { DATASET_END, DATASET_START } from '../data/dataset-config';
import { IsoDate } from '../data/dates';
import { compactParams, filtersToParams } from './url-state';

export const DATASET_BOUNDS: DateRange = { start: DATASET_START, end: DATASET_END };

/** Unknown codes dropped, catalogue order — so equal selections serialise identically. */
function canonical(key: DimensionKey, values: readonly string[]): string[] {
  const wanted = new Set(values);
  return DIMENSION_MEMBERS[key].filter((m) => wanted.has(m.code)).map((m) => m.code);
}

/**
 * Global filter state as a small signal store: one writable signal, derived selectors,
 * and intent-named mutations. Everything else (URL, queries, charts) derives from it.
 */
@Injectable({ providedIn: 'root' })
export class FilterStore {
  private readonly _state = signal<FilterState>(DEFAULT_FILTER_STATE, { equal: sameFilters });

  readonly state = this._state.asReadonly();
  readonly preset = computed(() => this._state().preset);
  readonly compare = computed(() => this._state().compare);

  readonly range = computed<DateRange>(
    () => {
      const s = this._state();
      return resolveRange(s.preset, DATASET_END, { start: s.start ?? undefined, end: s.end ?? undefined }, DATASET_BOUNDS);
    },
    { equal: (a, b) => a.start === b.start && a.end === b.end },
  );

  readonly comparison = computed(() => comparisonRange(this.range(), this._state().compare), {
    equal: (a, b) => a?.start === b?.start && a?.end === b?.end,
  });

  /** True when part of the comparison window lies before the first day of data. */
  readonly comparisonPartial = computed(() => {
    const c = this.comparison();
    return c !== null && c.start < DATASET_START;
  });

  /** Resolved filters for the worker; structurally compared so equal filters never re-query. */
  readonly queryFilters = computed<QueryFilters>(
    () => {
      const { preset, start, end, compare, ...dimensions } = this._state();
      return { ...dimensions, range: this.range(), comparison: this.comparison() };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  readonly activeDimensionCount = computed(() => activeDimensionCount(this._state()));
  /** Non-default params, for links that must carry the current view to another page. */
  readonly linkParams = computed(() => compactParams(filtersToParams(this._state())));

  setPreset(preset: Exclude<RangePreset, 'custom'>): void {
    this._state.update((s) => ({ ...s, preset, start: null, end: null }));
  }

  setCustomRange(start: IsoDate, end: IsoDate): void {
    const [a, b] = start <= end ? [start, end] : [end, start];
    this._state.update((s) => ({ ...s, preset: 'custom', start: a, end: b }));
  }

  setCompare(compare: CompareMode): void {
    this._state.update((s) => ({ ...s, compare }));
  }

  setDimension(key: DimensionKey, values: readonly string[]): void {
    this._state.update((s) => ({ ...s, [key]: canonical(key, values) }));
  }

  toggle(key: DimensionKey, code: string): void {
    this._state.update((s) => {
      const current = s[key];
      return { ...s, [key]: canonical(key, current.includes(code) ? current.filter((c) => c !== code) : [...current, code]) };
    });
  }

  clearDimensions(): void {
    this._state.update((s) => ({ ...s, region: [], country: [], channel: [], device: [], category: [], segment: [] }));
  }

  reset(): void {
    this._state.set(DEFAULT_FILTER_STATE);
  }

  /** Replaces the whole state (URL → store, saved reports). */
  replace(state: FilterState): void {
    this._state.set(state);
  }
}
