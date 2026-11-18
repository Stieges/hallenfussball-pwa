/**
 * Zuordnung `MonitorUhrModell` → Symbole des Uhr-Zustands (@ZM-215, Daniel 2026-11-19: Symbole statt Wörter); die Darstellung steht in `uhrZustand.tsx`.
 * Eine Quelle für die Live-Folie „Spielfeld (fern)“ (`MatchTimer`) und das Profil „Halle (sehr fern)“ (`HallBand`).
 */
import type { MonitorUhrModell } from '../../core/view';
import type { MonitorSymbolKind } from '../ui/atoms/MonitorSymbole';
import type { UhrTextKey } from './useMonitorUhr';

export interface UhrSymbolDef { kind: MonitorSymbolKind; key: UhrTextKey }

/** Symbole des Uhr-Zustands (leer im laufenden Spiel). */
export function uhrSymbole(modell: MonitorUhrModell): UhrSymbolDef[] {
  const plus: UhrSymbolDef = { kind: 'verlaengerung', key: 'overtime' };
  switch (modell.text) {
    case 'restzeit': return [];
    case 'verlaengerung': return [plus];
    case 'pauseHalbzeit': return [{ kind: 'halbzeit', key: 'pauseHalftime' }];
    case 'pause': return [{ kind: 'halbzeit', key: 'pause' }];
    case 'angehalten': return modell.verlaengerung === true ? [{ kind: 'pause', key: 'stopped' }, plus] : [{ kind: 'pause', key: 'stopped' }];
    case 'zeitAbgelaufen': return modell.verlaengerung === true ? [{ kind: 'pfeife', key: 'ended' }, plus] : [{ kind: 'pfeife', key: 'ended' }];
  }
}

/** Die Ziffern sind gedämpft, wenn die Uhr angehalten ist (nicht in der Schlussphase: dort gilt das Violett, @ZM-137). */
export const ziffernGedaempft = (modell: MonitorUhrModell | null): boolean => modell !== null && modell.text === 'angehalten' && !modell.schlussphase;

/** Laufender und Zahl der Abschnitte, wenn der Abschnitt angezeigt wird (sonst `null`). */
export function abschnittVon(modell: MonitorUhrModell | null): { current: number; total: number } | null {
  if (modell?.abschnitt === undefined || modell.abschnitte === undefined || modell.abschnitte <= 1) { return null; }
  const imAbschnitt = (modell.text === 'restzeit' || modell.text === 'angehalten' || modell.text === 'zeitAbgelaufen') && modell.verlaengerung !== true;
  return imAbschnitt ? { current: modell.abschnitt, total: modell.abschnitte } : null;
}
