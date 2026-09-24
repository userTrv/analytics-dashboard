import { Component, input } from '@angular/core';

let nextId = 0;

/** Card with a title row; actions go into `[panelActions]`, the body into the default slot. */
@Component({
  selector: 'app-panel',
  template: `
    <header class="panel-header">
      <div>
        <h2 [id]="headingId()">{{ heading() }}</h2>
        @if (subtitle()) {
          <p class="panel-subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="toolbar"><ng-content select="[panelActions]" /></div>
    </header>
    <ng-content />
  `,
  host: { class: 'panel', role: 'region', '[attr.aria-labelledby]': 'headingId()' },
})
export class PanelComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly headingId = input(`panel-${nextId++}`);
}
