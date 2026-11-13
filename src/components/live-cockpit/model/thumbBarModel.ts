/**
 * leisteFuer – welche Plätze die Daumenleiste je Zustand hat (Cockpit-Spec § 6; Plan PR 3, Aufgabe 3.6).
 *
 * Rein, ohne React. Das Layout (`daumen` unter 1024 px, `breit` ab 1024 px) hat eine Quelle: das `data-layout` der Hülle.
 * Entscheidung A2: unter 1024 px ist „Abpfiff halten“ der fünfte Platz (Rückgängig · Hauptaktion · Ereignisse · Abpfiff
 * halten · Mehr); in der Halbzeitpause gibt es keinen Abpfiff (`matchTransitions.json` kennt dort kein MATCH_END).
 * Ob die Leiste überhaupt bedient werden darf (`kannSteuern`), entscheidet `ThumbBarArea` (Nur-Lesen-Zeile statt Leiste).
 */
import type { CockpitPhase } from './cockpitPhase';

export type LeistenAktion =
  | 'anpfiff' | 'pause' | 'weiter' | 'wiederanpfiff' | 'anpfiffVerlaengerung' | 'entscheidung'
  | 'abpfiffHalten' | 'rueckgaengig' | 'ereignisse' | 'weiterNaechstes' | 'fortsetzen' | 'korrigieren' | 'mehr';

export interface LeisteKontext {
  layout: 'daumen' | 'breit';
  /** Turnierleitung (`leadMatches`): nur sie bekommt „Korrigieren“ (@SL-159); der Helfer den Hinweis (@SL-045). */
  istLeitung: boolean;
  /** „Spiel fortsetzen“ ist noch möglich (30 Sekunden nach dem Abpfiff, LT-6). */
  fortsetzenMoeglich: boolean;
  /** „Korrigieren“ ist verdrahtet und möglich (B-24 / LT-5). */
  korrigierenMoeglich: boolean;
}

export interface LeisteModell {
  layout: 'daumen' | 'breit';
  /** Zeile über der Leiste: „Spiel ist beendet – Korrektur über die Turnierleitung“ (@SL-045, @HE-043). */
  hinweis: 'beendetHelfer' | null;
  aktionen: LeistenAktion[];
}

type Plaetze = Record<LeisteKontext['layout'], LeistenAktion[]>;

const FESTE: Record<Exclude<CockpitPhase['zustand'], 'abgepfiffen'>, Plaetze> = {
  vorAnpfiff: { daumen: ['anpfiff', 'mehr'], breit: ['anpfiff', 'mehr'] },
  laeuft: {
    daumen: ['rueckgaengig', 'pause', 'ereignisse', 'abpfiffHalten', 'mehr'],
    breit: ['pause', 'abpfiffHalten', 'rueckgaengig', 'mehr'],
  },
  pausiert: {
    daumen: ['rueckgaengig', 'weiter', 'ereignisse', 'abpfiffHalten', 'mehr'],
    breit: ['weiter', 'abpfiffHalten', 'rueckgaengig', 'mehr'],
  },
  halbzeitpause: { daumen: ['rueckgaengig', 'wiederanpfiff', 'ereignisse', 'mehr'], breit: ['wiederanpfiff', 'rueckgaengig', 'mehr'] },
  pauseVorVerlaengerung: {
    daumen: ['rueckgaengig', 'anpfiffVerlaengerung', 'ereignisse', 'mehr'],
    breit: ['anpfiffVerlaengerung', 'rueckgaengig', 'mehr'],
  },
  entscheidung: { daumen: ['entscheidung', 'mehr'], breit: ['entscheidung', 'mehr'] },
  strafstoss: { daumen: ['rueckgaengig', 'ereignisse', 'mehr'], breit: ['rueckgaengig', 'mehr'] },
  wartetAufHerkunft: { daumen: ['mehr'], breit: ['mehr'] },
  keinSpiel: { daumen: [], breit: [] },
};

function nachAbpfiff(k: LeisteKontext): LeistenAktion[] {
  const fortsetzen: LeistenAktion[] = k.fortsetzenMoeglich ? ['fortsetzen'] : [];
  const korrigieren: LeistenAktion[] = k.istLeitung && k.korrigierenMoeglich ? ['korrigieren'] : [];
  return k.layout === 'daumen'
    ? [...fortsetzen, 'weiterNaechstes', 'ereignisse', ...korrigieren, 'mehr']
    : ['weiterNaechstes', ...fortsetzen, ...korrigieren, 'mehr'];
}

export function leisteFuer(phase: CockpitPhase, k: LeisteKontext): LeisteModell {
  if (phase.zustand === 'abgepfiffen') {
    return { layout: k.layout, hinweis: k.istLeitung ? null : 'beendetHelfer', aktionen: nachAbpfiff(k) };
  }
  return { layout: k.layout, hinweis: null, aktionen: [...FESTE[phase.zustand][k.layout]] };
}
