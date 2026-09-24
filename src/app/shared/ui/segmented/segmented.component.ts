import { Component, ElementRef, inject, input, model } from '@angular/core';

export interface SegmentOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

/**
 * Segmented control implemented as an ARIA radio group: one tab stop, arrow keys move
 * the selection (roving tabindex), Home/End jump to the ends.
 */
@Component({
  selector: 'app-segmented',
  template: `
    @for (option of options(); track option.value; let i = $index) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="option.value === value()"
        [tabIndex]="option.value === value() ? 0 : -1"
        (click)="value.set(option.value)"
        (keydown)="onKey($event, i)"
      >
        {{ option.label }}
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      padding: 2px;
      gap: 2px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    button {
      height: 28px;
      padding: 0 10px;
      font: inherit;
      font-size: 12px;
      font-weight: 550;
      color: var(--text-secondary);
      background: transparent;
      border: 0;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover {
      color: var(--text-primary);
    }
    button[aria-checked='true'] {
      color: var(--text-primary);
      background: var(--surface-raised);
      box-shadow: var(--shadow-sm);
    }
  `,
  host: { role: 'radiogroup', '[attr.aria-label]': 'label()' },
})
export class SegmentedComponent<T extends string = string> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly label = input.required<string>();
  readonly value = model.required<T>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onKey(event: KeyboardEvent, index: number): void {
    const count = this.options().length;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (index + 1) % count
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (index - 1 + count) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.value.set(this.options()[next].value);
    this.el.nativeElement.querySelectorAll('button')[next]?.focus();
  }
}
