import { DOCUMENT, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pulse.theme';

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Light/dark theme. Follows `prefers-color-scheme` until the user picks one explicitly;
 * the explicit choice is persisted. `index.html` applies the same logic before bootstrap
 * to avoid a flash of the wrong theme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private explicit = storedTheme() !== null;

  readonly theme = signal<Theme>(storedTheme() ?? (this.media?.matches ? 'dark' : 'light'));

  constructor() {
    this.apply(this.theme());
    this.media?.addEventListener('change', (e) => {
      if (!this.explicit) this.apply(e.matches ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.explicit = true;
    this.apply(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage unavailable (private mode) — the choice just won't persist */
    }
  }

  /**
   * The attribute is written synchronously, before the signal changes, so anything reacting
   * to `theme()` (charts reading CSS tokens) already sees the new custom properties.
   */
  private apply(theme: Theme): void {
    this.document.documentElement.dataset['theme'] = theme;
    this.theme.set(theme);
  }
}
