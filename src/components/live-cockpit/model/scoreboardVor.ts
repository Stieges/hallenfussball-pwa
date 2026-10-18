/**
 * Tafel vor dem Anpfiff, zwischen den Spielen und nach der Übernahme (Aufgabe 2.5; Spec § 6 „Vor Anpfiff“, „wartet“,
 * „kein Spiel“, „Nach Übernahme“). Rein, ohne React. Liefert die Teile, die `toScoreboardModel` zu den Teilen der
 * laufenden Zustände hinzufügt; Hinweise sperren nichts.
 */
import type { SperrHinweis } from '../../../core/match';
import type { ScoreboardModel, ScoreboardUhr } from '../../ui/molecules/Scoreboard';
import type { CockpitPhase, LeerGrund } from './cockpitPhase';
import type { MindestpauseHinweis, Uebersetzer } from './cockpitTypes';

export interface ScoreboardVorInput {
  /** Anstoßzeit des Spiels als `HH:MM` (Ortszeit). */
  anstoss: string;
  mindestpause: MindestpauseHinweis | null;
  sperrHinweise: readonly SperrHinweis[];
  leer: LeerGrund | null;
  /** Name des Geräts, von dem das Spiel übernommen wurde (@SL-015). */
  uebernahmeVon: string | null;
}

interface VorMatch {
  number: number;
  scheduledKickoff: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

export interface ScoreboardVorErgebnis {
  uhr: ScoreboardUhr | null;
  kopfText: string | null;
  hinweise: string[];
  leerAnzeige: ScoreboardModel['leerAnzeige'];
}

interface VorEingang {
  match: VorMatch | null;
  phase: CockpitPhase;
  jetztMs: number;
  fieldName?: string;
  tournamentName?: string;
  vor?: ScoreboardVorInput;
}

/** Minuten seit der angesetzten Anstoßzeit, ganz; `0`, wenn sie nicht lesbar ist oder noch bevorsteht. */
function ueberfaelligMinuten(kickoff: string, jetztMs: number): number {
  const angesetzt = Date.parse(kickoff);
  return Number.isFinite(angesetzt) ? Math.max(0, Math.floor((jetztMs - angesetzt) / 60000)) : 0;
}

export function scoreboardVor(input: VorEingang, t: Uebersetzer): ScoreboardVorErgebnis {
  const { match, phase, vor } = input;
  const leer: ScoreboardVorErgebnis = { uhr: null, kopfText: null, hinweise: [], leerAnzeige: null };
  if (!vor) { return leer; }
  const hinweise: string[] = [];
  const kopfText = input.tournamentName ?? null;
  let uhr: ScoreboardUhr | null = null;
  let leerAnzeige: ScoreboardVorErgebnis['leerAnzeige'] = null;

  if (phase.zustand === 'vorAnpfiff' && match) {
    uhr = {
      rest: vor.anstoss, gespielt: null, schlussphase: false, steht: false, hervorgehoben: false, ton: 'gedaempft',
      label: t('tafel.uhr.anstoss'), unterzeile: t('tafel.vor.spielFeld', { nummer: match.number, feld: input.fieldName ?? '' }),
    };
    if (vor.mindestpause) { hinweise.push(t('tafel.vor.mindestpause', { ...vor.mindestpause })); }
    const minuten = ueberfaelligMinuten(match.scheduledKickoff, input.jetztMs);
    if (minuten >= 1) { hinweise.push(t('tafel.vor.ueberfaellig', { minuten })); }
    for (const sperre of vor.sperrHinweise) {
      const team = [match.homeTeam, match.awayTeam].find((kandidat) => kandidat.id === sperre.teamId);
      if (team) { hinweise.push(t('tafel.vor.gesperrt', { nummer: sperre.playerNumber, team: team.name })); }
    }
  }
  const grund = vor.leer;
  if (phase.zustand === 'wartetAufHerkunft' && grund?.art === 'wartetAufHerkunft') {
    leerAnzeige = { titel: grund.paarung ?? t('tafel.zustand.wartet'), untertitel: grund.spielLabel ?? null };
    hinweise.push(...grund.gruende, t('tafel.vor.reihenfolgeNurLeitung'));
    if (grund.offline) { hinweise.push(t('tafel.vor.wartetOffline')); }
  }
  if (phase.zustand === 'keinSpiel' && grund?.art === 'keinSpiel') {
    leerAnzeige = { titel: t('tafel.keinWeiteresSpiel'), untertitel: grund.feldName };
    hinweise.push(t('tafel.vor.keinSpielMehr', { feld: grund.feldName }));
  }
  if (vor.uebernahmeVon !== null) { hinweise.push(t('tafel.uebernahmePruefen', { name: vor.uebernahmeVon })); }

  const istVorZustand = phase.zustand === 'vorAnpfiff' || phase.zustand === 'wartetAufHerkunft' || phase.zustand === 'keinSpiel';
  return { uhr, kopfText: istVorZustand ? kopfText : null, hinweise, leerAnzeige };
}
