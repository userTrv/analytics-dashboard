/** Position of `value` between min and max as 0..1 (0 when the range is flat or value is null). */
export function heatLevel(value: number | null, min: number, max: number): number {
  if (value === null || !Number.isFinite(value) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Background for a heat-formatted cell; a single hue (accent) from transparent to ~45 %. */
export function heatBackground(level: number): string {
  return level <= 0 ? 'transparent' : `color-mix(in srgb, var(--accent) ${Math.round(6 + level * 40)}%, transparent)`;
}

export function columnExtent(values: readonly (number | null)[]): { min: number; max: number } {
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return finite.length ? { min: Math.min(...finite), max: Math.max(...finite) } : { min: 0, max: 0 };
}
