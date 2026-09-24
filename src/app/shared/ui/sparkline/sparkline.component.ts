import { Component, computed, input } from '@angular/core';
import { sparklineArea, sparklinePath } from './sparkline';

/** Dependency-free SVG sparkline: cheaper than a chart instance per KPI card. */
@Component({
  selector: 'app-sparkline',
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="area" [attr.d]="area()" />
      <path class="line" [attr.d]="line()" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      color: var(--accent);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .line {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      vector-effect: non-scaling-stroke;
      stroke-linejoin: round;
    }
    .area {
      fill: currentColor;
      opacity: 0.1;
    }
  `,
})
export class SparklineComponent {
  readonly values = input.required<readonly number[]>();
  readonly width = input(120);
  readonly height = input(32);

  protected readonly line = computed(() => sparklinePath(this.values(), this.width(), this.height()));
  protected readonly area = computed(() => sparklineArea(this.values(), this.width(), this.height()));
}
