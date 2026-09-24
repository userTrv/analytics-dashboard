import { Component, computed, input } from '@angular/core';
import { MetricFormat } from '../../../core/analytics/metrics';
import { formatMetric } from '../../format/format';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';
import { IconComponent } from '../icon/icon.component';
import { SparklineComponent } from '../sparkline/sparkline.component';

export interface KpiView {
  readonly id: string;
  readonly label: string;
  readonly format: MetricFormat;
  readonly value: number | null;
  /** Comparison-period value, null when comparison is off or unavailable. */
  readonly previous: number | null;
  readonly deltaPct: number | null;
  readonly better: 'up' | 'down';
  readonly spark: readonly number[];
  readonly hint: string;
  /** Short caveat, e.g. when some filters do not apply to this metric. */
  readonly caveat?: string | null;
}

let nextId = 0;

@Component({
  selector: 'app-kpi-card',
  imports: [DeltaBadgeComponent, SparklineComponent, IconComponent],
  template: `
    <article class="kpi" [attr.aria-labelledby]="titleId" [attr.aria-describedby]="hintId">
      <header>
        <h3 [id]="titleId">{{ kpi().label }}</h3>
        <span class="hint" tabindex="0" [attr.aria-label]="'About ' + kpi().label">
          <app-icon name="info" [size]="14" />
          <span class="tip" role="tooltip" [id]="hintId">{{ kpi().hint }}</span>
        </span>
      </header>
      <p class="value" data-testid="kpi-value">{{ value() }}</p>
      <div class="meta">
        @if (kpi().previous !== null) {
          <app-delta-badge [pct]="kpi().deltaPct" [better]="kpi().better" />
          <span class="prev">vs {{ previous() }}</span>
        } @else {
          <span class="prev">No comparison</span>
        }
      </div>
      <app-sparkline class="spark" [values]="kpi().spark" />
      @if (kpi().caveat) {
        <p class="caveat">{{ kpi().caveat }}</p>
      }
    </article>
  `,
  styles: `
    .kpi {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 100%;
      padding: 14px 16px 12px;
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h3 {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .hint {
      position: relative;
      display: inline-flex;
      color: var(--text-muted);
      cursor: help;
      border-radius: 50%;
    }
    .tip {
      position: absolute;
      right: -6px;
      bottom: calc(100% + 6px);
      z-index: 5;
      width: max-content;
      max-width: 220px;
      padding: 6px 8px;
      font-size: 12px;
      color: var(--text-primary);
      background: var(--surface-raised);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
    }
    .hint:hover .tip,
    .hint:focus-visible .tip {
      opacity: 1;
    }
    .value {
      font-size: 26px;
      font-weight: 650;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      line-height: 1.15;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .prev {
      color: var(--text-muted);
    }
    .spark {
      height: 30px;
      margin-top: auto;
    }
    .caveat {
      font-size: 11px;
      color: var(--warn);
    }
    @media (max-width: 480px) {
      .kpi {
        padding: 10px 12px;
      }
      .value {
        font-size: 20px;
      }
    }
  `,
})
export class KpiCardComponent {
  readonly kpi = input.required<KpiView>();

  protected readonly titleId = `kpi-title-${nextId++}`;
  protected readonly hintId = `${this.titleId}-hint`;
  protected readonly value = computed(() => formatMetric(this.kpi().value, this.kpi().format, true));
  protected readonly previous = computed(() => formatMetric(this.kpi().previous, this.kpi().format, true));
}
