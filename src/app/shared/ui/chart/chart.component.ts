import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import type { EChartsType } from 'echarts/core';
import { ThemeService } from '../../../core/state/theme.service';
import { buildEchartsTheme, readChartTokens } from './chart-theme';
import { ChartClick, ChartOption } from './chart-types';

type EchartsModule = typeof import('./echarts-setup')['echarts'];

/**
 * Thin ECharts host. Loads the library lazily, re-creates the instance on theme change
 * (themes are init-time in ECharts), follows container size with a ResizeObserver and
 * disposes everything with the component.
 */
@Component({
  selector: 'app-chart',
  template: `
    <div #host class="chart-host" role="img" [attr.aria-label]="label()" [style.height.px]="height()"></div>
    @if (!chart()) {
      <div class="chart-placeholder skeleton" [style.height.px]="height()" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      min-width: 0;
    }
    :host(.is-updating) .chart-host {
      opacity: 0.6;
      transition: opacity 120ms ease;
    }
    .chart-host {
      width: 100%;
    }
    .chart-placeholder {
      position: absolute;
      inset: 0;
      border-radius: var(--radius-md);
    }
  `,
  host: { '[class.is-updating]': 'updating()' },
})
export class ChartComponent {
  readonly option = input.required<ChartOption>();
  /** Accessible one-sentence summary of what the chart shows. */
  readonly label = input.required<string>();
  readonly height = input(300);
  readonly updating = input(false);
  readonly chartClick = output<ChartClick>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly theme = inject(ThemeService).theme;
  private readonly lib = signal<EchartsModule | null>(null);
  protected readonly chart = signal<EChartsType | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    let observer: ResizeObserver | null = null;
    let frame = 0;

    afterNextRender(() => {
      void import('./echarts-setup').then(({ echarts }) => {
        if (!destroyRef.destroyed) this.lib.set(echarts);
      });
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => this.chart()?.resize());
      });
      observer.observe(this.host().nativeElement);
    });

    // (Re)create the instance when the library arrives or the theme changes.
    effect(() => {
      const lib = this.lib();
      const theme = this.theme();
      if (!lib) return;
      untracked(() => {
        this.chart()?.dispose();
        const el = this.host().nativeElement;
        const instance = lib.init(el, buildEchartsTheme(theme, readChartTokens(el)), { renderer: 'canvas' });
        instance.on('click', (p) => {
          const params = p as { name: string; seriesName?: string; dataIndex: number; value: unknown; data: unknown };
          this.chartClick.emit({ name: params.name, seriesName: params.seriesName, dataIndex: params.dataIndex, value: params.value, data: params.data });
        });
        this.chart.set(instance);
      });
    });

    effect(() => {
      const chart = this.chart();
      const option = this.option();
      chart?.setOption({ animationDuration: 350, animationDurationUpdate: 250, ...option }, { notMerge: true, lazyUpdate: true });
    });

    destroyRef.onDestroy(() => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      this.chart()?.dispose();
    });
  }
}
