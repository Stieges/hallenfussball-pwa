import type { PhaseView } from '../engine/phaseView';

export type CockpitZustand =
  | 'vorAnpfiff' | 'laeuft' | 'pausiert' | 'halbzeitpause' | 'pauseVorVerlaengerung'
  | 'entscheidung' | 'strafstoss' | 'abgepfiffen' | 'wartetAufHerkunft' | 'keinSpiel';
export type AbschnittArt = 'regulaer' | 'verlaengerung' | 'goldenGoal';
export type LeerGrund =
  | { art: 'wartetAufHerkunft'; gruende: string[] }
  | { art: 'keinSpiel'; feldName: string };
export interface CockpitPhase {
  zustand: CockpitZustand;
  abschnittArt: AbschnittArt;
  abschnitt: number;
  abschnitte: number;
  letzterAbschnitt: boolean;
}
export interface CockpitPhaseInput {
  view: PhaseView | null;
  matchStatus: 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED' | null;
  leer: LeerGrund | null;
}

const AUS_LIVEMATCH: Record<NonNullable<CockpitPhaseInput['matchStatus']>, CockpitZustand> = {
  NOT_STARTED: 'vorAnpfiff', RUNNING: 'laeuft', PAUSED: 'pausiert', FINISHED: 'abgepfiffen',
};

function zustandAusView(view: PhaseView): CockpitZustand {
  switch (view.status) {
    case 'scheduled': return 'vorAnpfiff';
    case 'running': return 'laeuft';
    case 'paused': return 'pausiert';
    case 'section_break': return view.phase === 'overtime' ? 'pauseVorVerlaengerung' : 'halbzeitpause';
    case 'decision_pending': return 'entscheidung';
    case 'shootout': return 'strafstoss';
    case 'finished':
    case 'skipped': return 'abgepfiffen';
  }
}

export function cockpitPhaseOf({ view, matchStatus, leer }: CockpitPhaseInput): CockpitPhase {
  if (leer) {
    return { zustand: leer.art, abschnittArt: 'regulaer', abschnitt: 0, abschnitte: 0, letzterAbschnitt: false };
  }
  if (!view) {
    return {
      zustand: matchStatus ? AUS_LIVEMATCH[matchStatus] : 'keinSpiel',
      abschnittArt: 'regulaer', abschnitt: 1, abschnitte: 1, letzterAbschnitt: true,
    };
  }
  const abschnittArt: AbschnittArt = view.phase === 'overtime'
    ? (view.tiebreakMode === 'goldenGoal' ? 'goldenGoal' : 'verlaengerung')
    : 'regulaer';
  return {
    zustand: zustandAusView(view),
    abschnittArt,
    abschnitt: view.section,
    abschnitte: view.sections,
    letzterAbschnitt: view.isLastRegularSection,
  };
}

const ANGEPFIFFEN: ReadonlySet<CockpitZustand> = new Set<CockpitZustand>([
  'laeuft', 'pausiert', 'halbzeitpause', 'pauseVorVerlaengerung', 'entscheidung', 'strafstoss',
]);

/** angepfiffen und nicht beendet (Spec § 8.4) */
export function istAngepfiffenUndNichtBeendet(zustand: CockpitZustand): boolean {
  return ANGEPFIFFEN.has(zustand);
}
