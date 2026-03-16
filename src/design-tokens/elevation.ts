/**
 * Elevation / zIndex Design Tokens
 *
 * Centralized z-index scale for consistent stacking context management.
 * Use these tokens instead of hardcoded zIndex values.
 *
 * Stacking order (low → high):
 * - base (0): Default content
 * - raised (10): Slightly raised elements (badges, indicators)
 * - sticky (100): Sticky headers, action bars
 * - navigation (1000): Bottom nav, tab bars, fixed headers
 * - dropdown (1050): Menus, popovers, tooltips
 * - floating (1100): Dropdowns, combobox, action menus, bottom sheets
 * - overlay (1500): Animations, overlays
 * - modal (2000): Dialogs, modals
 * - banner (9999): System banners (offline, storage warnings)
 * - critical (10000): Confirm dialogs, blocking UI
 */
export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  navigation: 1000,
  dropdown: 1050,
  floating: 1100,
  overlay: 1500,
  modal: 2000,
  banner: 9999,
  critical: 10000,
} as const;

export type ZIndexKey = keyof typeof zIndex;
