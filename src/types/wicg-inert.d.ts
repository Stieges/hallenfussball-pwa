/**
 * Type declarations for wicg-inert polyfill
 *
 * wicg-inert is a polyfill for the HTML inert attribute.
 * It doesn't export anything - it just patches the HTMLElement prototype.
 *
 * @see https://github.com/WICG/inert
 */
declare module 'wicg-inert' {
  // The polyfill doesn't export anything
  // It patches HTMLElement.prototype.inert automatically when imported
}
