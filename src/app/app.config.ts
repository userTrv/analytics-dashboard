import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

/**
 * Zoneless by default (Angular 21+), no zone.js in the bundle.
 * Hash routing: the app is served as static files from an unknown sub-path without an
 * SPA fallback, so every deep link must resolve to the same index.html.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation(), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};
