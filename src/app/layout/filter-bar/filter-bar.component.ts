import { Component, computed, inject, signal } from '@angular/core';
import { COMPARE_MODES, CompareMode, RANGE_PRESETS, RangePreset } from '../../core/analytics/date-range';
import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES, DimensionKey, REGIONS, SEGMENTS } from '../../core/data/catalog';
import { DATASET_END, DATASET_START } from '../../core/data/dataset-config';
import { DATASET_BOUNDS, FilterStore } from '../../core/state/filter-store';
import { formatRange } from '../../shared/format/format';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { MultiSelectComponent, SelectOption } from '../../shared/ui/multi-select/multi-select.component';

interface DimensionControl {
  readonly key: DimensionKey;
  readonly label: string;
}

const toOptions = (members: readonly { code: string; label: string }[]): SelectOption[] => members.map((m) => ({ value: m.code, label: m.label }));

@Component({
  selector: 'app-filter-bar',
  imports: [MultiSelectComponent, IconComponent],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent {
  protected readonly store = inject(FilterStore);
  protected readonly presets = RANGE_PRESETS;
  protected readonly compareModes = COMPARE_MODES;
  protected readonly minDate = DATASET_START;
  protected readonly maxDate = DATASET_END;
  /** Mobile: the controls row is collapsible to save vertical space. */
  protected readonly expanded = signal(false);

  protected readonly controls: readonly DimensionControl[] = [
    { key: 'region', label: 'Region' },
    { key: 'country', label: 'Country' },
    { key: 'channel', label: 'Channel' },
    { key: 'category', label: 'Category' },
    { key: 'segment', label: 'Segment' },
    { key: 'device', label: 'Device' },
  ];

  /** Countries are grouped by region and narrowed to the selected regions. */
  private readonly countryOptions = computed<SelectOption[]>(() => {
    const regions = new Set(this.store.state().region);
    return COUNTRIES.filter((c) => regions.size === 0 || regions.has(REGIONS[c.region].code)).map((c) => ({
      value: c.code,
      label: c.label,
      group: REGIONS[c.region].label,
    }));
  });

  protected readonly options = computed<Record<DimensionKey, SelectOption[]>>(() => ({
    region: toOptions(REGIONS),
    country: this.countryOptions(),
    channel: toOptions(CHANNELS),
    category: toOptions(CATEGORIES),
    segment: toOptions(SEGMENTS),
    device: toOptions(DEVICES),
  }));

  protected readonly rangeText = computed(() => {
    const r = this.store.range();
    return formatRange(r.start, r.end);
  });

  protected readonly comparisonText = computed(() => {
    const c = this.store.comparison();
    return c ? formatRange(c.start, c.end) : null;
  });

  protected readonly chips = computed(() => {
    const state = this.store.state();
    return this.controls.flatMap((control) =>
      state[control.key].map((code) => ({
        key: control.key,
        code,
        label: this.options()[control.key].find((o) => o.value === code)?.label ?? code,
        dimension: control.label,
      })),
    );
  });

  protected onPreset(value: string): void {
    if (value === 'custom') {
      const r = this.store.range();
      this.store.setCustomRange(r.start, r.end);
    } else {
      this.store.setPreset(value as Exclude<RangePreset, 'custom'>);
    }
  }

  protected onCustomDate(which: 'start' | 'end', value: string): void {
    if (!value) return;
    const r = this.store.range();
    const clamp = (d: string) => (d < DATASET_BOUNDS.start ? DATASET_BOUNDS.start : d > DATASET_BOUNDS.end ? DATASET_BOUNDS.end : d);
    this.store.setCustomRange(which === 'start' ? clamp(value) : r.start, which === 'end' ? clamp(value) : r.end);
  }

  protected onCompare(value: string): void {
    this.store.setCompare(value as CompareMode);
  }

  protected onDimension(key: DimensionKey, values: readonly string[]): void {
    this.store.setDimension(key, values);
    if (key === 'region' && values.length) {
      // Drop countries that fall outside the newly selected regions.
      const allowed = new Set(COUNTRIES.filter((c) => values.includes(REGIONS[c.region].code)).map((c) => c.code));
      this.store.setDimension('country', this.store.state().country.filter((c) => allowed.has(c)));
    }
  }
}
