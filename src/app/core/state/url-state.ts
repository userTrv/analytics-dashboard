import { DIMENSION_MEMBERS, DimensionKey } from '../data/catalog';
import { isIsoDate } from '../data/dates';
import { CompareMode, RANGE_PRESETS, RangePreset } from '../analytics/date-range';
import { DEFAULT_FILTER_STATE, DIMENSION_KEYS, FilterState } from '../analytics/filters';

/** Short, human-readable query parameter names; defaults are omitted from the URL. */
export const DIMENSION_PARAMS: Readonly<Record<DimensionKey, string>> = {
  region: 'region',
  country: 'country',
  channel: 'channel',
  device: 'device',
  category: 'cat',
  segment: 'seg',
};

const COMPARE_PARAM: Readonly<Record<CompareMode, string>> = { previous: 'prev', yoy: 'yoy', none: 'none' };

export const FILTER_PARAM_KEYS: readonly string[] = ['range', 'from', 'to', 'cmp', ...Object.values(DIMENSION_PARAMS)];

export type ParamRecord = Readonly<Record<string, string | null>>;

/**
 * Serialises filters to query params. Every filter key is present: defaults map to `null`,
 * which removes the param when merged into the current URL.
 */
export function filtersToParams(state: FilterState): ParamRecord {
  const params: Record<string, string | null> = {
    range: state.preset === DEFAULT_FILTER_STATE.preset ? null : state.preset,
    from: state.preset === 'custom' ? state.start : null,
    to: state.preset === 'custom' ? state.end : null,
    cmp: state.compare === DEFAULT_FILTER_STATE.compare ? null : COMPARE_PARAM[state.compare],
  };
  for (const key of DIMENSION_KEYS) params[DIMENSION_PARAMS[key]] = state[key].length ? state[key].join(',') : null;
  return params;
}

/** Only the non-default params — handy for `[queryParams]` on links. */
export function compactParams(params: ParamRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== '') out[k] = v;
  return out;
}

/**
 * Parses (untrusted) query params back into a valid state: unknown codes are dropped,
 * invalid dates fall back to the default preset, lists are de-duplicated and kept in
 * catalogue order so equal selections always serialise identically.
 */
export function paramsToFilters(params: Readonly<Record<string, string | string[] | undefined | null>>): FilterState {
  const get = (key: string): string | null => {
    const v = params[key];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const presetParam = get('range');
  let preset: RangePreset = DEFAULT_FILTER_STATE.preset;
  if (presetParam === 'custom' || RANGE_PRESETS.some((p) => p.value === presetParam)) preset = presetParam as RangePreset;

  let start: string | null = null;
  let end: string | null = null;
  if (preset === 'custom') {
    const from = get('from');
    const to = get('to');
    if (from && to && isIsoDate(from) && isIsoDate(to)) [start, end] = from <= to ? [from, to] : [to, from];
    else preset = DEFAULT_FILTER_STATE.preset;
  }

  const cmpParam = get('cmp');
  const compare = (Object.entries(COMPARE_PARAM).find(([, v]) => v === cmpParam)?.[0] as CompareMode | undefined) ?? DEFAULT_FILTER_STATE.compare;

  const state: Record<string, unknown> = { preset, start, end, compare };
  for (const key of DIMENSION_KEYS) {
    const raw = get(DIMENSION_PARAMS[key]);
    const wanted = new Set(raw ? raw.split(',') : []);
    state[key] = DIMENSION_MEMBERS[key].filter((m) => wanted.has(m.code)).map((m) => m.code);
  }
  return state as unknown as FilterState;
}
