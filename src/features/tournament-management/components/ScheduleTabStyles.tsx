/**
 * Responsive Regeln des Spielplan-Reiters (Seitenrand, Karte, Filter am Handy) – ganz auf Tokens (`cssVars`, `mediaQueries`).
 */
import type { ReactElement } from 'react';
import { cssVars, mediaQueries } from '../../../design-tokens';

export function ScheduleTabStyles(): ReactElement {
  return (
    <style>{`
        ${mediaQueries.tabletDown} {
          .schedule-tab-container {
            padding: ${cssVars.spacing.md} ${cssVars.spacing.sm} !important;
          }
        }

        ${mediaQueries.tabletBand} {
          .schedule-tab-container {
            padding: ${cssVars.spacing.md} !important;
          }
        }

        ${mediaQueries.tabletDown} {
          /* Die Regel galt bisher einer Klasse „.card“, die es nie gab: die Karte behielt 32 px Innenrand und der Spielplan am Handy war nur 280 px breit (@ZP-109, Mockup Runde 4: Karte fast randlos) */
          .schedule-tab-container .schedule-tab-card {
            border-radius: ${cssVars.borderRadius.md};
            padding: ${cssVars.spacing.sm} !important;
          }

          /* @OB-074: backdrop-filter würde die Karte zum Bezug von position: fixed machen, die Leiste klebte dann am Kartenende
             statt am Fensterrand. Am Handy ist der Filter aus; den Platz unter der letzten Zeile reserviert (seit Usability F) die Fußzeile (Footer: Leistenhöhe + --schedule-action-bar-h + Safe-Area), damit weder die letzte Zeile noch Impressum/Datenschutz unter der Leiste liegen */
          .schedule-tab-card {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }
    `}</style>
  );
}
