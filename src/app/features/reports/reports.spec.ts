import { TestBed } from '@angular/core/testing';
import { buildPivot, PivotConfig } from '../../core/analytics/pivot';
import { PivotQueryResult } from '../../core/analytics/queries/pivot-query';
import { toCsv } from '../../core/analytics/csv';
import { pivotToSheet, safeFileName } from './pivot-export';
import { PivotTableComponent } from './pivot-table/pivot-table.component';
import { DEFAULT_REPORT, ReportView, reportFromParams, reportToParams } from './report-config';

const data = [
  { region: 0, channel: 0, revenue: 100 },
  { region: 0, channel: 1, revenue: 50 },
  { region: 1, channel: 0, revenue: 25 },
];

const config: PivotConfig = { rows: ['region', 'channel'], columns: null, metrics: [{ field: 'revenue', agg: 'sum' }], sort: { by: 'label' } };

function pivot(cfg: PivotConfig = config): PivotQueryResult {
  const result = buildPivot(cfg, {
    rows: data.map((_, i) => i),
    member: (dim, i) => data[i][dim as 'region' | 'channel'],
    revenue: (i) => data[i].revenue,
    cost: () => 0,
    discount: () => 0,
    units: () => 1,
    customer: (i) => i,
    refunded: () => false,
  });
  return { ...result, labels: { region: ['Europe', 'Asia, Pacific'], channel: ['Email', 'Paid "social"'] }, sourceRows: data.length };
}

describe('report definition ⇄ URL', () => {
  it('round-trips a full definition', () => {
    const view: ReportView = {
      config: { rows: ['category', 'product'], columns: 'month', metrics: [{ field: 'revenue', agg: 'avg' }, { field: 'customers', agg: 'distinct' }], sort: { by: 'metric', metric: 1, dir: 'asc' } },
      heat: false,
      chart: 'none',
    };
    expect(reportFromParams(reportToParams(view))).toEqual(view);
  });

  it('uses the default when nothing is given and repairs invalid parts', () => {
    expect(reportFromParams({})).toBe(DEFAULT_REPORT);
    const repaired = reportFromParams({ rows: 'region.bogus.region.channel.device.year', cols: 'region', m: 'revenue:median,orders:count,orders:count', sort: 'm7:desc' });
    expect(repaired.config.rows).toEqual(['region', 'channel', 'device']);
    expect(repaired.config.columns).toBeNull(); // already used as a row
    expect(repaired.config.metrics).toEqual([{ field: 'orders', agg: 'count' }]);
    expect(repaired.config.sort).toEqual({ by: 'label' });
  });
});

describe('pivotToSheet', () => {
  it('flattens subtotals, leaves and the grand total with labels and raw numbers', () => {
    const sheet = pivotToSheet(pivot(), config);
    expect(sheet).toEqual([
      ['Region', 'Channel', 'Revenue (sum)'],
      ['Europe', 'Total', 150],
      ['Europe', 'Email', 100],
      ['Europe', 'Paid "social"', 50],
      ['Asia, Pacific', 'Total', 25],
      ['Asia, Pacific', 'Email', 25],
      ['Grand total', '', 175],
    ]);
    expect(toCsv(sheet).split('\r\n')[3]).toBe('Europe,"Paid ""social""",50');
  });

  it('builds safe file names', () => {
    expect(safeFileName('Q3 / EU: revenue?')).toBe('q3-eu-revenue');
    expect(safeFileName('   ')).toBe('report');
  });
});

describe('PivotTableComponent', () => {
  async function render(heat = true) {
    const fixture = TestBed.createComponent(PivotTableComponent);
    fixture.componentRef.setInput('result', pivot());
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('heat', heat);
    await fixture.whenStable();
    return fixture;
  }

  it('renders group rows, leaves and a grand total', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    const rows = [...el.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent!.trim()).join(' | '));
    expect(rows).toEqual(['Europe | $150.00', 'Email | $100.00', 'Paid "social" | $50.00', 'Asia, Pacific | $25.00', 'Email | $25.00']);
    expect(el.querySelector('tfoot')?.textContent).toContain('$175.00');
    expect(el.querySelectorAll('tr.group').length).toBe(2);
  });

  it('collapses and expands a group', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('tr.group .toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(el.querySelector('tr.group .toggle')?.getAttribute('aria-expanded')).toBe('false');
    el.querySelector<HTMLButtonElement>('tr.group .toggle')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('heat-formats leaf cells only, and can be switched off', async () => {
    const withHeat = (await render(true)).nativeElement as HTMLElement;
    const leafBg = withHeat.querySelector<HTMLElement>('tbody tr:not(.group) td')!.style.background;
    expect(leafBg).toContain('color-mix');
    const plain = (await render(false)).nativeElement as HTMLElement;
    expect(plain.querySelector<HTMLElement>('tbody tr:not(.group) td')!.style.background).not.toContain('color-mix');
  });
});
