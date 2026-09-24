// Type-only imports: they give features a fully typed option object without pulling
// ECharts into the chunk that builds the option.
import type { BarSeriesOption, FunnelSeriesOption, HeatmapSeriesOption, LineSeriesOption, TreemapSeriesOption } from 'echarts/charts';
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  MarkPointComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from 'echarts/components';
import type { ComposeOption } from 'echarts/core';

export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | HeatmapSeriesOption
  | FunnelSeriesOption
  | TreemapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | VisualMapComponentOption
  | MarkLineComponentOption
  | MarkPointComponentOption
  | DataZoomComponentOption
>;

export interface ChartClick {
  readonly name: string;
  readonly seriesName?: string;
  readonly dataIndex: number;
  readonly value: unknown;
  readonly data: unknown;
}

/** ECharts callback params are loosely typed unions; narrow them in one visible place. */
export function asParams<T>(params: unknown): T {
  return params as T;
}
