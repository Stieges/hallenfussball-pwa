/**
 * Lage der schwebenden Taste „Zum laufenden Spiel“ (@ZP-109): Wert für `bottom`.
 *
 * Am Handy (unter Tablet-Breite) schweben unten die Navigationsleiste und die Leiste „Teilen · Als PDF“ (Höhe aus `--schedule-action-bar-h`,
 * wie in der Fußzeile): die Pille liegt darüber, nie auf ihnen. Ab Tablet-Breite gibt es die Navigationsleiste nicht.
 */
import { cssVars } from '../../../design-tokens';

export const jumpButtonBottom = (phone: boolean): string => (phone
  ? `calc(${cssVars.spacing.md} + ${cssVars.layoutHeights.bottomNav} + var(--schedule-action-bar-h, 0px) + env(safe-area-inset-bottom, 0px))`
  : `calc(${cssVars.spacing.md} + env(safe-area-inset-bottom, 0px))`);
