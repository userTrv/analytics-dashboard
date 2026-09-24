/**
 * The only module that touches ECharts. It is loaded with a dynamic import, so the chart
 * library lives in a lazy chunk, and it registers just the pieces this app draws.
 */
import { BarChart, FunnelChart, HeatmapChart, LineChart, TreemapChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  HeatmapChart,
  FunnelChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

export { echarts };
