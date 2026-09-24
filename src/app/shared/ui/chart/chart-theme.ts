import { Theme } from '../../../core/state/theme.service';

/**
 * Categorical palette (fixed order, validated for colour-vision deficiency on adjacent
 * pairs) with separate steps for light and dark surfaces — dark is selected, not inverted.
 */
export const SERIES_COLORS: Readonly<Record<Theme, readonly string[]>> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

/** Single-hue sequential ramp (blue) for heatmaps; light → dark. */
export const SEQUENTIAL_BLUE: readonly string[] = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

export interface ChartTokens {
  readonly text: string;
  readonly textMuted: string;
  readonly grid: string;
  readonly axis: string;
  readonly surface: string;
  readonly tooltipBg: string;
  readonly tooltipBorder: string;
  readonly fontFamily: string;
}

export function readChartTokens(el: Element): ChartTokens {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    text: v('--text-primary', '#0b0b0b'),
    textMuted: v('--text-secondary', '#52514e'),
    grid: v('--chart-grid', '#e8e7e3'),
    axis: v('--chart-axis', '#c9c8c2'),
    surface: v('--surface-1', '#fcfcfb'),
    tooltipBg: v('--surface-raised', '#ffffff'),
    tooltipBorder: v('--border', '#e2e1dc'),
    fontFamily: v('--font-sans', 'system-ui, sans-serif'),
  };
}

/** ECharts theme object built from CSS tokens, so charts follow the design system. */
export function buildEchartsTheme(theme: Theme, t: ChartTokens): Record<string, unknown> {
  const axis = {
    axisLine: { show: true, lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.textMuted, fontSize: 11, hideOverlap: true },
    splitLine: { show: true, lineStyle: { color: t.grid, type: 'solid' as const } },
    nameTextStyle: { color: t.textMuted },
  };
  return {
    color: SERIES_COLORS[theme],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: t.fontFamily, color: t.text },
    legend: { textStyle: { color: t.textMuted, fontSize: 12 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14 },
    tooltip: {
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: t.text, fontSize: 12 },
      extraCssText: 'box-shadow: 0 6px 20px rgb(0 0 0 / 0.12); border-radius: 8px;',
      axisPointer: { lineStyle: { color: t.axis }, crossStyle: { color: t.axis }, shadowStyle: { color: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
    },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    timeAxis: axis,
    line: { symbol: 'none', lineStyle: { width: 2 }, smooth: false },
    bar: { itemStyle: { borderRadius: [3, 3, 0, 0] }, label: { color: t.textMuted, textBorderWidth: 0 } },
    funnel: { label: { color: t.text, textBorderWidth: 0 } },
  };
}
