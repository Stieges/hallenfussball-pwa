/**
 * Responsive und Druck-Regeln des Spielplans (`ScheduleDisplay`) – ganz auf Tokens (`cssVars`, `mediaQueries`; Handy und Tablet bis 768 Bildpunkte wie bisher).
 */
import type { ReactElement } from 'react';
import { cssVars, mediaQueries } from '../design-tokens';

/** 20 / 12 Bildpunkte, aus Tokens gerechnet */
const LEGACY_Y = `calc(${cssVars.spacing.md} + ${cssVars.spacing.xs})`;
const LEGACY_X = `calc(${cssVars.spacing.sm} + ${cssVars.spacing.xs})`;

export function ScheduleDisplayStyles(): ReactElement {
  return (
    <style>{`
        /* Wie die Utility „hidden ab Tablet“: ab 769 Bildpunkten ausblenden */
        ${mediaQueries.desktop} {
          .md\\:hidden {
            display: none !important;
          }
        }

        /* Zuschauer-Seite, Vorschau im Assistenten: Innenabstand wie vor @ZP-113 (20 / 12 Bildpunkte, aus Tokens gerechnet) */
        ${mediaQueries.mobile} {
          .schedule-display:not(.schedule-display--kopf) {
            padding: ${LEGACY_Y} ${LEGACY_X} !important;
          }
        }

        ${mediaQueries.tablet} {
          .schedule-display:not(.schedule-display--kopf) {
            padding: ${LEGACY_Y} ${LEGACY_X} !important;
          }
        }

        /* Kopf der Verwaltung (@ZP-113): nur hier der engere Innenabstand, ohne !important (der Kopf setzt keinen eigenen Abstand inline) */
        .schedule-display--kopf {
          padding: ${cssVars.spacing.xl} ${cssVars.spacing.md};
        }

        ${mediaQueries.mobile} {
          .schedule-display--kopf {
            padding: ${cssVars.spacing.lg} ${cssVars.spacing.sm};
          }
        }

        ${mediaQueries.tablet} {
          .schedule-display--kopf {
            padding: ${cssVars.spacing.lg} ${cssVars.spacing.sm};
          }
        }

        ${mediaQueries.print} {
          .schedule-display {
            padding: ${cssVars.spacing.lg};
            max-width: 100%;
          }

          @page {
            size: A4;
            margin: 15mm;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
  );
}
