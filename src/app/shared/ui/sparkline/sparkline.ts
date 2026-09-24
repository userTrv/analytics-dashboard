/**
 * SVG path for a sparkline scaled into a width × height box (y grows downwards).
 * A flat series is drawn through the middle; fewer than two points draw nothing.
 */
export function sparklinePath(values: readonly number[], width: number, height: number, padding = 2): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerH = height - padding * 2;
  const stepX = width / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = span === 0 ? height / 2 : padding + innerH - ((v - min) / span) * innerH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Closed area under the sparkline, for a soft fill. */
export function sparklineArea(values: readonly number[], width: number, height: number, padding = 2): string {
  const line = sparklinePath(values, width, height, padding);
  return line ? `${line} L${width},${height} L0,${height} Z` : '';
}
