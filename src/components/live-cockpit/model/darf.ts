/**
 * darfAktion – was der Zustand erlaubt (Cockpit-Spec § 6, Matrix) und was ohne Steuerung bleibt (§ 4.4).
 * Rein, ohne React. Szenarien: @SL-085 (angehalten), @SL-087 (Halbzeitpause), @SL-018 (ohne Steuer), @SL-113, @SL-041.
 * Rechte stehen nicht hier: `kannSteuern` kommt vom Aufrufer (A-11 / `useCan`).
 */
import type { CockpitPhase, CockpitZustand } from './cockpitPhase';

export type CockpitAktion =
  | 'anpfiff' | 'pauseWeiter' | 'wiederanpfiff' | 'tor' | 'foul' | 'karte' | 'zeitstrafe' | 'rueckgaengig'
  | 'halbzeit' | 'abpfiff' | 'uhrKorrigieren' | 'seitenTauschen' | 'einstellungenAendern'
  | 'eintragZuruecknehmen' | 'nummerAendern' | 'nummerNachtragen' | 'ergebnisBestaetigen'
  | 'entscheidung' | 'strafstoss' | 'spielFortsetzen';

/** Interner Aktionsschlüssel der Zeitstrafe (kein Anzeigetext); als Konstante, damit die Glossar-Regel nur hier ausgenommen ist. */
// eslint-disable-next-line local-rules/no-hardcoded-sport-terms-preferred -- interner Aktionsschlüssel, nicht sichtbar
export const AKTION_ZEITSTRAFE: CockpitAktion = 'zeitstrafe';

const IM_SPIEL: CockpitZustand[] = ['laeuft', 'pausiert'];
const PAUSEN: CockpitZustand[] = ['halbzeitpause', 'pauseVorVerlaengerung'];
const ERLAUBT: Record<CockpitAktion, readonly CockpitZustand[]> = {
  anpfiff: ['vorAnpfiff'], pauseWeiter: IM_SPIEL, wiederanpfiff: PAUSEN,
  tor: IM_SPIEL, foul: IM_SPIEL, karte: [...IM_SPIEL, ...PAUSEN], zeitstrafe: [...IM_SPIEL, ...PAUSEN],
  rueckgaengig: [...IM_SPIEL, ...PAUSEN, 'strafstoss'], // decision_pending kennt kein RETRACT (matchTransitions.json:42-43, S17)
  halbzeit: IM_SPIEL, abpfiff: IM_SPIEL, uhrKorrigieren: IM_SPIEL,
  seitenTauschen: ['vorAnpfiff', ...IM_SPIEL, ...PAUSEN, 'entscheidung', 'strafstoss', 'abgepfiffen'],
  einstellungenAendern: ['vorAnpfiff', ...IM_SPIEL, ...PAUSEN, 'entscheidung', 'strafstoss', 'abgepfiffen', 'wartetAufHerkunft', 'keinSpiel'],
  eintragZuruecknehmen: [...IM_SPIEL, ...PAUSEN, 'strafstoss'],
  nummerAendern: [...IM_SPIEL, ...PAUSEN, 'entscheidung', 'strafstoss'], nummerNachtragen: ['abgepfiffen'],
  ergebnisBestaetigen: ['abgepfiffen'], entscheidung: ['entscheidung'], strafstoss: ['strafstoss'], spielFortsetzen: ['abgepfiffen'],
};

export function darfAktion(phase: CockpitPhase, kannSteuern: boolean, aktion: CockpitAktion): boolean {
  if (!kannSteuern && aktion !== 'seitenTauschen') { return false; }
  return ERLAUBT[aktion].includes(phase.zustand);
}
