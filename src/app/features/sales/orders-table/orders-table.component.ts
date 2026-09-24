import { ListRange } from '@angular/cdk/collections';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { afterNextRender, Component, DestroyRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { QueryFilters } from '../../../core/analytics/filters';
import { OrderRow, OrderSortKey } from '../../../core/analytics/queries/orders';
import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES } from '../../../core/data/catalog';
import { AnalyticsDataService } from '../../../core/state/analytics-data.service';
import { FormatPipe } from '../../../shared/format/format.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

const PAGE = 200;
const ROW_HEIGHT = 36;

const byCode = (list: readonly { code: string; label: string }[]) => new Map(list.map((m) => [m.code, m.label]));
const LABELS = { category: byCode(CATEGORIES), channel: byCode(CHANNELS), device: byCode(DEVICES), country: byCode(COUNTRIES) };

/**
 * Order-level table over 100k+ rows: CDK virtual scroll renders ~30 DOM rows, and rows are
 * fetched from the worker in pages of 200 as the rendered range moves (like server-side
 * pagination, but the "server" is a Web Worker holding a cached, sorted selection).
 */
@Component({
  selector: 'app-orders-table',
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf, FormatPipe, IconComponent],
  templateUrl: './orders-table.component.html',
  styleUrl: './orders-table.component.scss',
})
export class OrdersTableComponent {
  readonly filters = input.required<QueryFilters>();
  readonly drill = input<string | null>(null);

  private readonly data = inject(AnalyticsDataService);
  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly labels = LABELS;
  protected readonly sort = signal<{ key: OrderSortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  protected readonly total = signal<number | null>(null);
  protected readonly rows = signal<(OrderRow | null)[]>([]);

  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);
  private readonly loaded = new Set<number>();
  private current: { filters: QueryFilters; drill: string | null; sort: { key: OrderSortKey; dir: 'asc' | 'desc' } } | null = null;
  private generation = 0;
  private lastRange: ListRange = { start: 0, end: 40 };
  private readonly abort = new Set<AbortController>();

  constructor() {
    effect(() => {
      const params = { filters: this.filters(), drill: this.drill(), sort: this.sort() };
      untracked(() => this.reset(params));
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const sub = this.viewport().renderedRangeStream.subscribe((range) => this.onRange(range));
      destroyRef.onDestroy(() => sub.unsubscribe());
    });
    destroyRef.onDestroy(() => this.abort.forEach((c) => c.abort()));
  }

  private onRange(range: ListRange): void {
    this.lastRange = range;
    const first = Math.floor(range.start / PAGE);
    const last = Math.floor(Math.max(range.start, range.end - 1) / PAGE);
    for (let p = first; p <= last; p++) void this.loadPage(p);
  }

  protected sortBy(key: OrderSortKey): void {
    this.sort.update((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }

  protected ariaSort(key: OrderSortKey): 'ascending' | 'descending' | null {
    const s = this.sort();
    return s.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : null;
  }

  protected trackRow = (index: number, row: OrderRow | null) => row?.id ?? `pending-${index}`;

  private reset(params: { filters: QueryFilters; drill: string | null; sort: { key: OrderSortKey; dir: 'asc' | 'desc' } }): void {
    this.generation++;
    this.loaded.clear();
    this.abort.forEach((c) => c.abort());
    this.abort.clear();
    this.total.set(null);
    this.current = params;
    void this.loadPage(0).then(() => this.onRange(this.lastRange));
  }

  private async loadPage(page: number): Promise<void> {
    const total = this.total();
    if (!this.current || this.loaded.has(page) || (total !== null && page * PAGE >= total)) return;
    this.loaded.add(page);
    const generation = this.generation;
    const controller = new AbortController();
    this.abort.add(controller);
    try {
      const result = await this.data.query('orders', { ...this.current, offset: page * PAGE, limit: PAGE }, controller.signal);
      if (generation !== this.generation) return;
      if (this.total() === null) {
        this.total.set(result.total);
        this.rows.set(new Array<OrderRow | null>(result.total).fill(null));
      }
      this.rows.update((rows) => {
        const next = rows.slice();
        result.rows.forEach((row, i) => (next[result.offset + i] = row));
        return next;
      });
    } catch {
      this.loaded.delete(page); // aborted or failed — allow a retry on the next scroll
    } finally {
      this.abort.delete(controller);
    }
  }
}
