import { Injectable, signal } from '@angular/core';
import { FilterState } from '../../core/analytics/filters';
import { filtersToParams, paramsToFilters } from '../../core/state/url-state';
import { ReportView, reportFromParams, reportToParams } from './report-config';

export interface SavedReport {
  readonly id: string;
  readonly name: string;
  readonly view: ReportView;
  readonly filters: FilterState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Stored as URL params: one canonical, validated representation for links and storage. */
interface StoredReport {
  id: string;
  name: string;
  params: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'pulse.reports.v1';

const EXAMPLES: readonly { name: string; params: Record<string, string> }[] = [
  { name: 'Category performance by quarter', params: { rows: 'category', cols: 'quarter', m: 'revenue:sum,marginPct:ratio', sort: 'm0:desc', heat: '1', chart: 'bar', range: '12m' } },
  { name: 'Channel × device conversion value', params: { rows: 'channel.device', cols: '', m: 'orders:count,revenue:avg,refundRate:ratio', sort: 'm0:desc', heat: '1', chart: 'bar', range: '90d' } },
  { name: 'Weekday pattern by segment', params: { rows: 'weekday', cols: 'segment', m: 'revenue:sum', sort: 'label', heat: '1', chart: 'bar', range: '12m' } },
];

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hydrate(stored: StoredReport): SavedReport {
  const params = Object.fromEntries(Object.entries(stored.params).filter(([, v]) => v !== null)) as Record<string, string>;
  return { id: stored.id, name: stored.name, view: reportFromParams(params), filters: paramsToFilters(params), createdAt: stored.createdAt, updatedAt: stored.updatedAt };
}

function dehydrate(report: SavedReport): StoredReport {
  return { id: report.id, name: report.name, params: { ...filtersToParams(report.filters), ...reportToParams(report.view) }, createdAt: report.createdAt, updatedAt: report.updatedAt };
}

/** Saved report definitions in localStorage; corrupt entries are skipped, never fatal. */
@Injectable({ providedIn: 'root' })
export class ReportStorageService {
  private readonly _reports = signal<SavedReport[]>(this.load());
  readonly reports = this._reports.asReadonly();

  create(name: string, view: ReportView, filters: FilterState): SavedReport {
    const now = new Date().toISOString();
    const report: SavedReport = { id: newId(), name: name.trim() || 'Untitled report', view, filters, createdAt: now, updatedAt: now };
    this.commit([report, ...this._reports()]);
    return report;
  }

  update(id: string, patch: Partial<Pick<SavedReport, 'name' | 'view' | 'filters'>>): void {
    this.commit(this._reports().map((r) => (r.id === id ? { ...r, ...patch, name: (patch.name ?? r.name).trim() || r.name, updatedAt: new Date().toISOString() } : r)));
  }

  duplicate(id: string): SavedReport | null {
    const source = this._reports().find((r) => r.id === id);
    return source ? this.create(`${source.name} (copy)`, source.view, source.filters) : null;
  }

  remove(id: string): void {
    this.commit(this._reports().filter((r) => r.id !== id));
  }

  get(id: string): SavedReport | undefined {
    return this._reports().find((r) => r.id === id);
  }

  private commit(reports: SavedReport[]): void {
    this._reports.set(reports);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.map(dehydrate)));
    } catch {
      /* quota or private mode: keep working in memory */
    }
  }

  private load(): SavedReport[] {
    let raw: string | null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return [];
    }
    if (raw === null) {
      // First visit: seed a few examples so the feature is discoverable.
      const now = new Date().toISOString();
      const seeded = EXAMPLES.map((e) => hydrate({ id: newId(), name: e.name, params: e.params, createdAt: now, updatedAt: now }));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded.map(dehydrate)));
      } catch {
        /* ignore */
      }
      return seeded;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((r): r is StoredReport => !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.params === 'object')
        .map(hydrate);
    } catch {
      return [];
    }
  }
}
