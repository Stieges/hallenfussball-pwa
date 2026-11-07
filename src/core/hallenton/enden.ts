/**
 * Das Ende eines Felds aus dem Engine-Stand: vorhergesagt (Uhr läuft → Grenze aus `PhaseView.limitAt`, dieselbe Grenze, an
 * der das Cockpit den Abschnitt von selbst beendet) oder beobachtet (der Stand zeigt das Ende schon: von Hand, als
 * Nachricht, Golden-Goal-Tor). Rein, ohne React.
 *
 * Schlüssel je Ende (Regel 4): (Spiel, Phase, Abschnitt, Wiedereröffnungen) – egal ob von selbst oder von Hand. Die Tonart
 * folgt dem Zustand nach dem Ende: Pause (nächster Abschnitt oder Verlängerung) → Halbzeit-Ton; beendet, Strafstoßschießen
 * oder offene Entscheidung → Abpfiff-Ton; das Ende des Strafstoßschießens selbst → kein Ton (@HT-003, @HT-031).
 */
import { applyEvent, type EngineEvent, type MatchContext, type MatchState } from '../match';
import { phaseViewOf } from '../match/client/phaseView';
import type { HallTonArt } from './types';

export interface FeldEnde {
  schluessel: string;
  /** Serverzeit des Endes. */
  at: number;
  art: HallTonArt;
  /** `true`: aus dem laufenden Stand vorhergesagt (Ablauf); `false`: der Stand zeigt das Ende schon. */
  vorhergesagt: boolean;
}

export interface EndeKennung {
  matchId: string;
  phase: 'regular' | 'overtime';
  /** Abschnitt, der endet (1-basiert; Verlängerung = Zahl der regulären Abschnitte + 1). */
  section: number;
  reopenCount: number;
}

export function endeSchluessel(kennung: EndeKennung): string {
  return `${kennung.matchId}|${kennung.phase}|${kennung.section}|${kennung.reopenCount}`;
}

/** Tonart nach dem Zustand, in den das Ende führt. */
function artNachEnde(nachher: MatchState): HallTonArt {
  return nachher.status === 'section_break' ? 'halbzeit' : 'abpfiff';
}

/** Zeitpunkt des letzten wirksamen Abpfiffs (für Strafstoßschießen und offene Entscheidung, die keinen eigenen tragen). */
function letzterAbpfiffAt(state: MatchState): number | null {
  let at: number | null = null;
  for (const event of Object.values(state.accepted)) {
    if (event.type === 'MATCH_END' && !state.retracted.includes(event.id)) {
      at = event.at;
    }
  }
  return at;
}

function vorhergesagtesEnde(state: MatchState, ctx: MatchContext, serverNow: number): FeldEnde | null {
  const view = phaseViewOf(state, ctx, serverNow);
  if (view.limitAt === null || (state.phase !== 'regular' && state.phase !== 'overtime')) {
    return null;
  }
  // dieselbe Wahl wie das Ende von selbst im Cockpit (`useAutoSectionEnd`)
  const type = view.isLastRegularSection || state.phase === 'overtime' ? 'MATCH_END' : 'SECTION_END';
  const probe: EngineEvent = {
    id: 'hallenton-vorschau', type, actor: 'helper', at: view.limitAt, section: state.section, clockMs: view.limitClockMs,
    payload: {},
  };
  const result = applyEvent(state, probe, ctx);
  const art: HallTonArt = result.status === 'accepted' ? artNachEnde(result.state) : type === 'SECTION_END' ? 'halbzeit' : 'abpfiff';
  return {
    schluessel: endeSchluessel({ matchId: ctx.matchId, phase: state.phase, section: state.section, reopenCount: view.reopenCount }),
    at: view.limitAt, art, vorhergesagt: true,
  };
}

function beobachtetesEnde(state: MatchState, ctx: MatchContext, reopenCount: number): FeldEnde | null {
  const sections = state.rules?.sections ?? 1;
  const ende = (phase: EndeKennung['phase'], section: number, at: number | null, art: HallTonArt): FeldEnde | null =>
    at === null ? null : { schluessel: endeSchluessel({ matchId: ctx.matchId, phase, section, reopenCount }), at, art, vorhergesagt: false };
  switch (state.status) {
    case 'section_break':
      // vor der Verlängerung steht `section` schon auf sections + 1; beendet ist der letzte reguläre Abschnitt
      return state.phase === 'overtime'
        ? ende('regular', sections, state.breakStartedAt, 'halbzeit')
        : ende('regular', state.section, state.breakStartedAt, 'halbzeit');
    case 'decision_pending':
      return ende('regular', state.section, letzterAbpfiffAt(state), 'abpfiff');
    case 'shootout':
      return ende(state.section > sections ? 'overtime' : 'regular', state.section, letzterAbpfiffAt(state), 'abpfiff');
    case 'finished':
      // das Ende des Strafstoßschießens tönt nicht (@HT-031)
      return state.phase === 'shootout' ? null : ende(state.phase, state.section, state.finishedAt, 'abpfiff');
    default:
      return null;
  }
}

/** Das nächste bzw. gerade gemeldete Ende des Spiels; `null` ohne Anpfiff (Regeln fehlen), bei stehender Uhr und ohne Ende. */
export function feldEndeOf(state: MatchState, ctx: MatchContext, serverNow: number): FeldEnde | null {
  if (state.rules === null) {
    return null;
  }
  if (state.status === 'running') {
    return vorhergesagtesEnde(state, ctx, serverNow);
  }
  return beobachtetesEnde(state, ctx, phaseViewOf(state, ctx, serverNow).reopenCount);
}
