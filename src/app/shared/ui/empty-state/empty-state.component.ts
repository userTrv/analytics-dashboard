import { Component, input, output } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  template: `
    <app-icon [name]="icon()" [size]="28" />
    <p class="title">{{ title() }}</p>
    @if (message()) {
      <p class="message">{{ message() }}</p>
    }
    @if (actionLabel()) {
      <button type="button" class="btn btn-sm" (click)="action.emit()">{{ actionLabel() }}</button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 160px;
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
    }
    .title {
      font-weight: 600;
      color: var(--text-primary);
    }
    .message {
      max-width: 360px;
      font-size: 13px;
    }
  `,
  host: { role: 'status' },
})
export class EmptyStateComponent {
  readonly title = input('No data for this selection');
  readonly message = input<string | null>('Try widening the date range or removing some filters.');
  readonly icon = input<IconName>('filter');
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();
}
