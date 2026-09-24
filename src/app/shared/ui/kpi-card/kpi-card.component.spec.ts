import { TestBed } from '@angular/core/testing';
import { deltaTone } from '../delta-badge/delta-badge.component';
import { sparklinePath } from '../sparkline/sparkline';
import { KpiCardComponent, KpiView } from './kpi-card.component';

const kpi = (patch: Partial<KpiView> = {}): KpiView => ({
  id: 'revenue',
  label: 'Revenue',
  format: 'currency',
  value: 1_234_567,
  previous: 1_000_000,
  deltaPct: 0.2346,
  better: 'up',
  spark: [1, 3, 2, 5],
  hint: 'Gross order value',
  ...patch,
});

async function render(view: KpiView): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(KpiCardComponent);
  fixture.componentRef.setInput('kpi', view);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('KpiCardComponent', () => {
  it('renders the formatted value, delta and comparison value', async () => {
    const el = await render(kpi());
    expect(el.querySelector('h3')?.textContent).toContain('Revenue');
    expect(el.querySelector('[data-testid="kpi-value"]')?.textContent?.trim()).toBe('$1.2M');
    expect(el.textContent).toContain('+23.5%');
    expect(el.textContent).toContain('vs $1M');
    expect(el.querySelector('app-delta-badge')?.classList).toContain('good');
    expect(el.querySelector('app-sparkline path.line')?.getAttribute('d')).toMatch(/^M0\.0,/);
  });

  it('colours a rise as bad when lower is better', async () => {
    const el = await render(kpi({ label: 'Refund rate', format: 'percent', value: 0.07, previous: 0.05, deltaPct: 0.4, better: 'down' }));
    expect(el.querySelector('[data-testid="kpi-value"]')?.textContent?.trim()).toBe('7.0%');
    expect(el.querySelector('app-delta-badge')?.classList).toContain('bad');
  });

  it('handles missing comparison and missing values', async () => {
    const el = await render(kpi({ value: null, previous: null, deltaPct: null, caveat: 'Category/segment filters don’t apply' }));
    expect(el.querySelector('[data-testid="kpi-value"]')?.textContent?.trim()).toBe('—');
    expect(el.textContent).toContain('No comparison');
    expect(el.querySelector('app-delta-badge')).toBeNull();
    expect(el.querySelector('.caveat')?.textContent).toContain('filters');
  });

  it('links the hint to the card for assistive technology', async () => {
    const el = await render(kpi());
    const article = el.querySelector('article')!;
    const hintId = article.getAttribute('aria-describedby')!;
    expect(el.querySelector(`#${hintId}`)?.textContent).toContain('Gross order value');
  });
});

describe('deltaTone & sparklinePath', () => {
  it('treats tiny changes as neutral', () => {
    expect(deltaTone(0.001, 'up')).toBe('neutral');
    expect(deltaTone(null, 'up')).toBe('neutral');
    expect(deltaTone(-0.1, 'down')).toBe('good');
  });

  it('scales values into the box and draws flat series through the middle', () => {
    expect(sparklinePath([0, 10], 100, 20, 0)).toBe('M0.0,20.0 L100.0,0.0');
    expect(sparklinePath([5, 5, 5], 100, 20)).toBe('M0.0,10.0 L50.0,10.0 L100.0,10.0');
    expect(sparklinePath([1], 100, 20)).toBe('');
  });
});
