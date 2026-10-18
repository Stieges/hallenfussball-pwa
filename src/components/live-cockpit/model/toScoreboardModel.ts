/**
 * toScoreboardModel – eine Stelle, die Phase, Uhr und Spiel in das Modell der Tafel übersetzt (Aufgabe 2.4).
 *
 * Rein, ohne React. Die Restzeit kommt aus `getClockDisplay` (eine Funktion für Cockpit, Monitor und Zuschauer,
 * @ZM-139); der Stand ist der Endstand-Zwischenstand aus `getEffectiveScore` (regulär + Verlängerung, ohne
 * Strafstoßschießen). Texte laufen über den übergebenen Übersetzer, Zahlen und Teamnamen bleiben Zahlen und Namen.
 */
import { getClockDisplay, type ClockMode } from '../../../core/match/clockDisplay';
import type { LiveMatch } from '../types';
import type { PhaseView } from '../engine/phaseView';
import type { CockpitPhase, CockpitZustand } from './cockpitPhase';
import type { ScoreboardModel, ScoreboardSeite, ScoreboardTon, ScoreboardUhr } from '../../ui/molecules/Scoreboard';
import type { Side, Uebersetzer } from './cockpitTypes';
import { scoreboardVor, type ScoreboardVorInput } from './scoreboardVor';
import { getEffectiveScore } from '../../../utils/matchScore';

/** Was die Tafel vom Spiel liest (der Cockpit-`LiveMatch` und der Kern-`LiveMatch` erfüllen es beide). */
export type ScoreboardMatch = Pick<LiveMatch, 'id' | 'number' | 'scheduledKickoff' | 'homeTeam' | 'awayTeam' | 'homeScore' | 'awayScore' | 'overtimeScoreA' | 'overtimeScoreB'>;

export interface ScoreboardInput {
  /** `null`, solange kein Spiel dasteht („wartet auf Teams“, „kein Spiel mehr“). */
  match: ScoreboardMatch | null;
  phase: CockpitPhase;
  view: PhaseView | null;
  links: Side;
  rechts: Side;
  uhrArt: ClockMode;
  /** Länge der Schlussphase in Minuten (Turnierregel `finalPhaseMinutes`, @SL-136); fehlt sie, gilt die Vorgabe. */
  schlussphaseMinuten?: number;
  eintraegeWarten: number;
  helferAnfragen: number;
  /** Jetzt in ms (für „seit … Minuten überfällig“); kommt aus einem Takt, nie aus `Date.now()` im Render. */
  jetztMs: number;
  /** Trikotfarben der Stand-Kästen je Anzeigeseite (Aufgabe 2.6); fehlt sie, bleibt der Kasten neutral. */
  trikot?: Partial<Record<'links' | 'rechts', string | null>>;
  fieldName?: string;
  tournamentName?: string;
  /** Vor dem Anpfiff, zwischen den Spielen und nach der Übernahme (Aufgabe 2.5). */
  vor?: ScoreboardVorInput;
}

/** Sekunden als `m:ss` (Minuten ohne führende Null, nie negativ). */
export function formatUhr(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const TON: Record<CockpitZustand, ScoreboardTon> = {
  vorAnpfiff: 'neutral', laeuft: 'live', pausiert: 'live', halbzeitpause: 'pause', pauseVorVerlaengerung: 'pause',
  entscheidung: 'info', strafstoss: 'info', abgepfiffen: 'ende', wartetAufHerkunft: 'neutral', keinSpiel: 'neutral',
};
const ZUSTAND_KEY: Record<CockpitZustand, string> = {
  vorAnpfiff: 'tafel.zustand.vorAnpfiff', laeuft: 'tafel.zustand.live', pausiert: 'tafel.zustand.live',
  halbzeitpause: 'tafel.zustand.halbzeit', pauseVorVerlaengerung: 'tafel.zustand.verlaengerungFolgt',
  entscheidung: 'tafel.zustand.entscheidung', strafstoss: 'tafel.zustand.strafstoss', abgepfiffen: 'tafel.zustand.abgepfiffen',
  wartetAufHerkunft: 'tafel.zustand.wartet', keinSpiel: 'tafel.zustand.keinSpiel',
};

function abschnittTextOf(phase: CockpitPhase, t: Uebersetzer): string | null {
  if (phase.zustand !== 'laeuft' && phase.zustand !== 'pausiert' && phase.zustand !== 'abgepfiffen') { return null; }
  if (phase.abschnittArt === 'goldenGoal') { return t('tafel.abschnitt.goldenGoal'); }
  if (phase.abschnittArt === 'verlaengerung') { return t('tafel.abschnitt.verlaengerung'); }
  if (phase.abschnitte === 2) { return t('tafel.abschnitt.halbzeit', { nummer: phase.abschnitt }); }
  return phase.abschnitte > 2 ? t('tafel.abschnitt.vonN', { nummer: phase.abschnitt, gesamt: phase.abschnitte }) : null; // @FU-072
}

interface UhrErgebnis { uhr: ScoreboardUhr | null; hinweise: string[] }

/** Uhr und stehende Zeilen der laufenden Zustände (läuft, pausiert, Pause, Entscheidung, Strafstoßschießen, abgepfiffen). */
function uhrOf(input: ScoreboardInput, t: Uebersetzer): UhrErgebnis {
  const { phase, view, match } = input;
  const hinweise: string[] = [];
  if (!view) { return { uhr: null, hinweise }; }
  const abgelaufenRest = formatUhr((view.sectionLimitMs - view.sectionElapsedMs) / 1000);

  if (phase.zustand === 'laeuft' || phase.zustand === 'pausiert') {
    const steht = phase.zustand === 'pausiert';
    const anzeige = getClockDisplay({
      gespielt: view.sectionElapsedMs / 1000, abschnittSekunden: view.sectionLimitMs / 1000, uhrArt: input.uhrArt,
      angehalten: steht, schlussphaseMinuten: input.schlussphaseMinuten, abschnitt: view.section, abschnitteGesamt: view.sections,
      verlaengerung: phase.abschnittArt !== 'regulaer',
    });
    // Schlussphase nur bei „durchlaufend, letzte Minute angehalten“ (Daniel 16.10.): dort die Farbe statt Text; der Text
    // „Uhr hält bei Unterbrechung“ bleibt für „immer angehalten“ (@SL-003).
    const schlussphase = anzeige.phase === 'schlussphaseAngehalten';
    const gespielt = formatUhr(view.sectionElapsedMs / 1000);
    if (anzeige.hinweisUhrHaelt && !schlussphase) { hinweise.push(t('tafel.uhrHaelt')); }
    if (steht) { hinweise.push(t('tafel.uhrSteht')); }
    return {
      hinweise,
      uhr: {
        rest: formatUhr(anzeige.restSekunden), gespielt, schlussphase, steht, hervorgehoben: anzeige.hervorhebung || steht,
        label: t(steht ? 'tafel.uhr.angehalten' : 'tafel.uhr.restzeit'), unterzeile: t('tafel.unterzeile.spielzeit', { zeit: gespielt }),
      },
    };
  }
  if (phase.zustand === 'halbzeitpause' || phase.zustand === 'pauseVorVerlaengerung') {
    const rest = (view.breakRemainingMs ?? 0) / 1000;
    const vorbei = rest === 0;
    const vorVerlaengerung = phase.zustand === 'pauseVorVerlaengerung';
    if (vorbei) { hinweise.push(t('tafel.wiederanpfiffJetzt')); }
    return {
      hinweise,
      uhr: {
        rest: formatUhr(rest), gespielt: null, schlussphase: false, steht: false, hervorgehoben: vorbei, ton: vorbei ? 'ok' : 'gedaempft',
        label: t(vorbei ? 'tafel.uhr.pauseVorbei' : 'tafel.uhr.pause'),
        unterzeile: t(vorbei ? (vorVerlaengerung ? 'tafel.unterzeile.anpfiffVerlaengerung' : 'tafel.unterzeile.wiederanpfiff') : (vorVerlaengerung ? 'tafel.unterzeile.bisVerlaengerung' : 'tafel.unterzeile.bisWiederanpfiff')),
      },
    };
  }
  if (phase.zustand === 'strafstoss' && match) {
    const tore = (seite: Side): number => view.shootout?.goals[seite === 'home' ? match.homeTeam.id : match.awayTeam.id] ?? 0;
    const amSchuss = view.shootout?.nextTeam;
    const teamName = amSchuss === match.homeTeam.id ? match.homeTeam.name : amSchuss === match.awayTeam.id ? match.awayTeam.name : null;
    return {
      hinweise,
      uhr: {
        rest: `${tore(input.links)}:${tore(input.rechts)}`, gespielt: null, schlussphase: false, steht: false, hervorgehoben: false,
        label: t('tafel.uhr.schuesse'), unterzeile: teamName ? t('tafel.unterzeile.amSchuss', { team: teamName }) : null,
      },
    };
  }
  if (phase.zustand === 'entscheidung' || phase.zustand === 'abgepfiffen') {
    if (phase.zustand === 'entscheidung') { hinweise.push(t('tafel.entscheidungOffen')); }
    return {
      hinweise,
      uhr: { rest: abgelaufenRest, gespielt: null, schlussphase: false, steht: false, hervorgehoben: false, ton: 'gedaempft', label: t('tafel.uhr.endstand'), unterzeile: null },
    };
  }
  return { uhr: null, hinweise };
}

export function toScoreboardModel(input: ScoreboardInput, t: Uebersetzer): ScoreboardModel {
  const { match, phase } = input;
  const stand = match ? getEffectiveScore(match) : { home: 0, away: 0 }; // Verlängerung/Golden Goal zählen mit
  const seite = (anzeige: 'links' | 'rechts'): ScoreboardSeite => {
    const s = input[anzeige];
    const trikot = input.trikot?.[anzeige];
    return { name: match ? (s === 'home' ? match.homeTeam.name : match.awayTeam.name) : '', tore: s === 'home' ? stand.home : stand.away, ...(trikot ? { trikot } : {}) };
  };
  const links = seite('links');
  const rechts = seite('rechts');
  const { uhr, hinweise } = uhrOf(input, t);
  const vor = scoreboardVor(input, t);
  return {
    zustandText: t(ZUSTAND_KEY[phase.zustand]), ton: TON[phase.zustand], links, rechts,
    uhr: uhr ?? vor.uhr, abschnittText: abschnittTextOf(phase, t) ?? vor.kopfText, hinweise: [...hinweise, ...vor.hinweise], leerAnzeige: vor.leerAnzeige,
    eintraegeWartenText: input.eintraegeWarten > 0 ? t('tafel.eintraegeWarten', { count: input.eintraegeWarten }) : null,
    helferAnfragenText: input.helferAnfragen > 0 ? t('tafel.helferAnfragen', { count: input.helferAnfragen }) : null,
    ariaStand: t('tafel.ariaStand', { links: links.name, linksTore: links.tore, rechts: rechts.name, rechtsTore: rechts.tore }),
  };
}
