import { Component, computed, input } from '@angular/core';
import { formatDelta } from '../../format/format';
import { IconComponent } from '../icon/icon.component';

export type DeltaTone = 'good' | 'bad' | 'neutral';

/** Tone of a change given which direction is desirable; tiny changes read as neutral. */
export function deltaTone(pct: number | null, better: 'up' | 'down', neutralBand = 0.005): DeltaTone {
  if (pct === null || Math.abs(pct) < neutralBand) return 'neutral';
  return (pct > 0) === (better === 'up') ? 'good' : 'bad';
}

/** Signed % change with an arrow — colour is never the only signal. */
@Component({
  selector: 'app-delta-badge',
  imports: [IconComponent],
  template: `
    @if (pct() !== null) {
      <app-icon [name]="pct()! >= 0 ? 'up' : 'down'" [size]="12" />
    }
    <span>{{ text() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 6px 1px 4px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 999px;
      font-variant-numeric: tabular-nums;
      background: var(--surface-2);
      color: var(--text-secondary);
    }
    :host(.good) {
      background: var(--good-soft);
      color: var(--good);
    }
    :host(.bad) {
      background: var(--bad-soft);
      color: var(--bad);
    }
  `,
  host: { '[class]': 'tone()' },
})
export class DeltaBadgeComponent {
  readonly pct = input.required<number | null>();
  readonly better = input<'up' | 'down'>('up');

  protected readonly tone = computed(() => deltaTone(this.pct(), this.better()));
  protected readonly text = computed(() => formatDelta(this.pct()));
}
