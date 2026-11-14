/**
 * Lage der schwebenden Taste „Zum laufenden Spiel“ (@ZP-109): Wert für `bottom`.
 *
 * Am Handy (unter Tablet-Breite) schweben unten die Navigationsleiste und die Leiste „Teilen · Als PDF“ (Höhe aus `--schedule-action-bar-h`,
 * wie in der Fußzeile): die Pille liegt darüber, nie auf ihnen. Ab Tablet-Breite gibt es die Navigationsleiste nicht.
 * Steht die Fußzeile im Bild, liegt die Pille über ihr (`footerLift` = so viele Bildpunkte vom unteren Fensterrand ragt die Fußzeile ins Bild):
 * sie verdeckt weder Impressum noch Datenschutz.
 */
import { cssVars } from '../../../design-tokens';

export const jumpButtonBottom = (phone: boolean, footerLift = 0): string => {
  const base = phone
    ? `calc(${cssVars.spacing.md} + ${cssVars.layoutHeights.bottomNav} + var(--schedule-action-bar-h, 0px) + env(safe-area-inset-bottom, 0px))`
    : `calc(${cssVars.spacing.md} + env(safe-area-inset-bottom, 0px))`;
  return footerLift > 0 ? `max(${base}, calc(${String(footerLift)}px + ${cssVars.spacing.sm}))` : base;
};

/** Wie weit die Fußzeile(n) der Seite vom unteren Fensterrand ins Bild ragen (Bildpunkte, 0 = keine im Bild) */
export function footerLiftOf(footers: Iterable<{ getBoundingClientRect: () => { top: number; bottom: number } }>, viewportHeight: number): number {
  let lift = 0;
  for (const footer of footers) {
    const rect = footer.getBoundingClientRect();
    if (rect.top < viewportHeight && rect.bottom > 0) {
      lift = Math.max(lift, viewportHeight - rect.top);
    }
  }
  return lift;
}
