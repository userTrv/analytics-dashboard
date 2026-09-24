import { Routes } from '@angular/router';

/** Every page is a lazy chunk; ECharts is a further lazy chunk loaded by the first chart. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  { path: 'overview', title: 'Overview · Pulse Analytics', loadComponent: () => import('./features/overview/overview.page') },
  { path: 'sales', title: 'Sales explorer · Pulse Analytics', loadComponent: () => import('./features/sales/sales.page') },
  { path: 'marketing', title: 'Marketing · Pulse Analytics', loadComponent: () => import('./features/marketing/marketing.page') },
  { path: 'customers', title: 'Customers · Pulse Analytics', loadComponent: () => import('./features/customers/customers.page') },
  { path: 'reports', title: 'Report builder · Pulse Analytics', loadComponent: () => import('./features/reports/reports.page') },
  { path: '**', redirectTo: 'overview' },
];
