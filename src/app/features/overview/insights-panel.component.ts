import { Component, computed, input } from '@angular/core';
import { Insight } from '../../core/analytics/insights';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { describeInsight } from './insight-text';

@Component({
  selector: 'app-insights-panel',
  imports: [IconComponent],
  template: `
    @for (item of items(); track $index) {
      <article class="insight" [class]="item.tone">
        <app-icon [name]="item.tone === 'good' ? 'trendUp' : item.tone === 'bad' ? 'trendDown' : 'sparkles'" [size]="18" />
        <div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.detail }}</p>
        </div>
      </article>
    } @empty {
      <p class="empty">Nothing stands out for this selection{{ hasComparison() ? '' : ' — turn on a comparison period for change insights' }}.</p>
    }
    <p class="method">Movers: channels changing ≥ 5 % and ≥ 1 % of total revenue, explained by the device/country with the largest share of the change. Anomalies: daily revenue with |z| ≥ 3 against the trailing 28 days.</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .insight {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      background: var(--surface-2);
    }
    .insight app-icon {
      margin-top: 2px;
      color: var(--text-muted);
    }
    .insight.good app-icon {
      color: var(--good);
    }
    .insight.bad app-icon {
      color: var(--bad);
    }
    h3 {
      font-size: 13px;
      font-weight: 650;
    }
    p {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    .method {
      font-size: 11px;
      color: var(--text-muted);
    }
    .empty {
      font-size: 13px;
    }
  `,
})
export class InsightsPanelComponent {
  readonly insights = input.required<readonly Insight[]>();
  readonly comparisonLabel = input('previous period');
  readonly hasComparison = input(true);

  protected readonly items = computed(() => this.insights().map((i) => describeInsight(i, this.comparisonLabel())));
}
