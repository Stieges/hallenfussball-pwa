/**
 * Inert Polyfill - Safari <15.5 Compatibility
 *
 * The `inert` attribute is used by useFocusTrap to make background content
 * inert (not focusable, not clickable, hidden from screen readers).
 *
 * Safari 15.5+ supports inert natively, but older versions need a polyfill.
 *
 * @see https://caniuse.com/mdn-api_htmlelement_inert
 * @see https://github.com/WICG/inert
 * @see docs/roadmap/P0-IMPLEMENTATION-PLAN.md#p0-2-wcag-413-focus-management
 */

/**
 * Initialize inert polyfill if needed
 *
 * Only loads the polyfill if the browser doesn't support the inert attribute natively.
 * This keeps the bundle size minimal for modern browsers.
 */
export async function initInertPolyfill(): Promise<void> {
  // Check if inert is natively supported
  if ('inert' in HTMLElement.prototype) {
    return;
  }

  // Load polyfill for browsers that need it
  try {
    await import('wicg-inert');
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[Polyfill] wicg-inert loaded for Safari <15.5 compatibility');
    }
  } catch (error) {
    // Error logging is important for polyfill initialization failures
    if (import.meta.env.DEV) {
      console.error('[Polyfill] Failed to load wicg-inert:', error);
    }
  }
}
