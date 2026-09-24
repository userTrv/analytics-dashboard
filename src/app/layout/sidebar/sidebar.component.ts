import { Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FilterStore } from '../../core/state/filter-store';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/overview', label: 'Overview', icon: 'overview' },
  { path: '/sales', label: 'Sales explorer', icon: 'sales' },
  { path: '/marketing', label: 'Marketing', icon: 'marketing' },
  { path: '/customers', label: 'Customers', icon: 'customers' },
  { path: '/reports', label: 'Report builder', icon: 'reports' },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="brand">
      <span class="logo" aria-hidden="true"><app-icon name="pulse" [size]="18" /></span>
      <span class="brand-name">Pulse Analytics</span>
    </div>
    <nav aria-label="Main">
      <ul>
        @for (item of items; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              [queryParams]="store.linkParams()"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              [attr.title]="collapsed() ? item.label : null"
              (click)="navigate.emit()"
            >
              <app-icon [name]="item.icon" [size]="18" />
              <span class="text">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
    <button type="button" class="collapse btn btn-ghost" (click)="toggleCollapsed.emit()" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'" [attr.aria-expanded]="!collapsed()">
      <app-icon name="chevronsLeft" [size]="16" />
      <span class="text">Collapse</span>
    </button>
  `,
  styleUrl: './sidebar.component.scss',
  host: { '[class.collapsed]': 'collapsed()', '[class.mobile-open]': 'mobileOpen()' },
})
export class SidebarComponent {
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);
  readonly toggleCollapsed = output<void>();
  readonly navigate = output<void>();

  protected readonly store = inject(FilterStore);
  protected readonly items = NAV_ITEMS;
}
