import { Component, computed, effect, input, linkedSignal, signal } from '@angular/core';
import { MetricFormat } from '../../../core/analytics/metrics';
import { FormatPipe } from '../../../shared/format/format.pipe';
import { DeltaBadgeComponent } from '../../../shared/ui/delta-badge/delta-badge.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ProductTableRow } from '../sales-model';

type ColumnKey = Exclude<keyof ProductTableRow, 'code' | 'product'>;

interface Column {
  readonly key: ColumnKey;
  readonly label: string;
  readonly format: MetricFormat | 'text' | 'delta';
  readonly numeric: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: 'category', label: 'Category', format: 'text', numeric: false },
  { key: 'revenue', label: 'Revenue', format: 'currency', numeric: true },
  { key: 'deltaPct', label: 'Δ vs comp.', format: 'delta', numeric: true },
  { key: 'orders', label: 'Orders', format: 'number', numeric: true },
  { key: 'units', label: 'Units', format: 'number', numeric: true },
  { key: 'aov', label: 'AOV', format: 'currency', numeric: true },
  { key: 'margin', label: 'Gross margin', format: 'percent', numeric: true },
  { key: 'refundRate', label: 'Refund rate', format: 'percent', numeric: true },
  { key: 'discount', label: 'Discounts', format: 'currency', numeric: true },
];

const PAGE_SIZE = 15;
const COLUMNS_KEY = 'pulse.products.columns';

function readColumns(): ColumnKey[] {
  try {
    const stored = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? 'null') as ColumnKey[] | null;
    if (Array.isArray(stored)) return stored.filter((k) => COLUMNS.some((c) => c.key === k));
  } catch {
    /* fall through to defaults */
  }
  return ['category', 'revenue', 'deltaPct', 'orders', 'aov', 'margin', 'refundRate'];
}

/** Client-side table: the product list is small (≤ 160 rows), so sorting/paging happen here. */
@Component({
  selector: 'app-product-table',
  imports: [FormatPipe, DeltaBadgeComponent, IconComponent],
  templateUrl: './product-table.component.html',
  styleUrl: './product-table.component.scss',
})
export class ProductTableComponent {
  readonly rows = input.required<readonly ProductTableRow[]>();

  protected readonly allColumns = COLUMNS;
  protected readonly visible = signal<ColumnKey[]>(readColumns());
  protected readonly columns = computed(() => COLUMNS.filter((c) => this.visible().includes(c.key)));
  protected readonly search = signal('');
  protected readonly sort = signal<{ key: ColumnKey | 'product'; dir: 'asc' | 'desc' }>({ key: 'revenue', dir: 'desc' });
  /** Back to the first page whenever the data, search or sort changes. */
  protected readonly page = linkedSignal({ source: () => [this.rows(), this.search(), this.sort()], computation: () => 0 });

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const { key, dir } = this.sort();
    const sign = dir === 'asc' ? 1 : -1;
    return this.rows()
      .filter((r) => !term || r.product.toLowerCase().includes(term) || r.category.toLowerCase().includes(term))
      .sort((a, b) => {
        const x = a[key];
        const y = b[key];
        if (typeof x === 'string' && typeof y === 'string') return sign * x.localeCompare(y);
        return sign * (((x as number | null) ?? -Infinity) - ((y as number | null) ?? -Infinity));
      });
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  protected readonly pageRows = computed(() => this.filtered().slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE));
  protected readonly rangeText = computed(() => {
    const total = this.filtered().length;
    if (!total) return '0 products';
    const from = this.page() * PAGE_SIZE + 1;
    return `${from}–${Math.min(total, from + PAGE_SIZE - 1)} of ${total} products`;
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(COLUMNS_KEY, JSON.stringify(this.visible()));
      } catch {
        /* not persisted */
      }
    });
  }

  protected sortBy(key: ColumnKey | 'product'): void {
    this.sort.update((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'product' || key === 'category' ? 'asc' : 'desc' }));
  }

  protected ariaSort(key: ColumnKey | 'product'): 'ascending' | 'descending' | null {
    const s = this.sort();
    return s.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : null;
  }

  protected toggleColumn(key: ColumnKey): void {
    this.visible.update((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]));
  }
}
