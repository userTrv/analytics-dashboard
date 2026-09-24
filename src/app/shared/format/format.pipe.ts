import { Pipe, PipeTransform } from '@angular/core';
import { MetricFormat } from '../../core/analytics/metrics';
import { formatDelta, formatMetric } from './format';

/** `value | fmt: 'currency'` — pure, so it only re-runs when the value changes. */
@Pipe({ name: 'fmt' })
export class FormatPipe implements PipeTransform {
  transform(value: number | null | undefined, format: MetricFormat | 'delta', compact = false): string {
    return format === 'delta' ? formatDelta(value) : formatMetric(value, format, compact);
  }
}
