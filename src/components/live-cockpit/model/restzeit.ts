/**
 * restzeitSpielMs / restzeitText – Restzeit des ganzen Spiels für die Rückfrage beim Abpfiff von Hand (Plan LT-1).
 * Regulär: Rest des laufenden Abschnitts plus alle noch folgenden regulären Abschnitte (@SL-133: im ersten von zwei
 * Abschnitten à 6 Minuten bei 4:00 noch 8:00); in der Verlängerung nur deren Rest (@SL-010). Rein, ohne React.
 */
import type { PhaseView } from '../engine/phaseView';

export function restzeitSpielMs(view: Pick<PhaseView, 'phase' | 'section' | 'sections' | 'sectionElapsedMs' | 'sectionLimitMs'>): number {
  const restImAbschnitt = Math.max(0, view.sectionLimitMs - view.sectionElapsedMs);
  if (view.phase !== 'regular') { return restImAbschnitt; }
  const folgende = Math.max(0, view.sections - view.section);
  return restImAbschnitt + folgende * view.sectionLimitMs;
}

/** „3:12“: Minuten und Sekunden, Sekunden aufgerundet wie die Restzeit der Tafel. */
export function restzeitText(ms: number): string {
  const sekunden = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;
}
