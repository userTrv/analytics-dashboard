import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
}

let nextId = 0;

/**
 * Filter dropdown with checkboxes in a CDK overlay. Native checkboxes keep semantics
 * simple; the popup traps focus while open, Escape closes it and focus returns to the
 * trigger. An empty selection means "all".
 */
@Component({
  selector: 'app-multi-select',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, CdkTrapFocus, IconComponent],
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
})
export class MultiSelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model<readonly string[]>([]);

  protected readonly open = signal(false);
  protected readonly search = signal('');
  protected readonly panelId = `multi-select-${nextId++}`;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  protected readonly selected = computed(() => new Set(this.value()));

  protected readonly summary = computed(() => {
    const value = this.value();
    if (value.length === 0) return 'All';
    if (value.length === 1) return this.options().find((o) => o.value === value[0])?.label ?? value[0];
    return `${value.length} selected`;
  });

  protected readonly groups = computed(() => {
    const term = this.search().trim().toLowerCase();
    const visible = this.options().filter((o) => !term || o.label.toLowerCase().includes(term) || o.value.toLowerCase() === term);
    const groups = new Map<string, SelectOption[]>();
    for (const option of visible) {
      const key = option.group ?? '';
      groups.set(key, [...(groups.get(key) ?? []), option]);
    }
    return [...groups.entries()].map(([name, options]) => ({ name, options }));
  });

  protected toggleOpen(): void {
    if (this.open()) this.close();
    else this.open.set(true);
  }

  protected close(restoreFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.search.set('');
    if (restoreFocus) this.trigger().nativeElement.focus();
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  protected toggleOption(value: string): void {
    const set = new Set(this.value());
    if (set.has(value)) set.delete(value);
    else set.add(value);
    // Keep the options' order so equal selections compare equal.
    this.value.set(this.options().filter((o) => set.has(o.value)).map((o) => o.value));
  }

  protected selectOnly(values: readonly string[]): void {
    this.value.set([...values]);
  }
}
