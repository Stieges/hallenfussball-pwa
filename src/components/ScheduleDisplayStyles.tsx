/**
 * Responsive und Druck-Regeln des Spielplans (`ScheduleDisplay`) – ganz auf Tokens (`cssVars`, `mediaQueries`, `breakpoints`).
 */
import type { ReactElement } from 'react';
import { breakpoints, cssVars, mediaQueries } from '../design-tokens';

export function ScheduleDisplayStyles(): ReactElement {
  return (
    <style>{`
        /* Wie die Utility „hidden ab Tablet“: ab 769 Bildpunkten ausblenden */
        ${mediaQueries.desktop} {
          .md\\:hidden {
            display: none !important;
          }
        }

        @media (max-width: ${breakpoints.tablet}) {
          .schedule-display {
            padding: ${cssVars.spacing.lg} ${cssVars.spacing.sm} !important;
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
