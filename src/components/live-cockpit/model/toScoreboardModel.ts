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
import type { ScoreboardModel, ScoreboardSeite, ScoreboardUhr } from '../../ui/molecules/Scoreboard';
import { zeitBalkenLaufend, zeitBalkenPause } from '../../../core/view/zeitBalken';
import { matchBadgeModel, type MatchBadgeModel } from '../../../core/view/badge';
import { viewStatus } from '../../../core/view/status';
import type { ViewMatchStatus } from '../../../core/view/types';
import type { Side, Uebersetzer } from './cockpitTypes';
import { scoreboardVor, type ScoreboardVorInput } from './scoreboardVor';
import { liveMatchFinalScore } from '../../../utils/matchScore';
import type { CockpitKasten } from '../typesFarben';

/** Was die Tafel vom Spiel liest (der Cockpit-`LiveMatch` und der Kern-`LiveMatch` erfüllen es beide). */
export type ScoreboardMatch = Pick<LiveMatch, 'id' | 'number' | 'scheduledKickoff' | 'homeTeam' | 'awayTeam' | 'homeScore' | 'awayScore' | 'overtimeScoreA' | 'overtimeScoreB' | 'penaltyScoreA' | 'penaltyScoreB'>;

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
  /** Jetzt in ms (für „überfällig N Min“ (@OB-068)); kommt aus einem Takt, nie aus `Date.now()` im Render. */
  jetztMs: number;
  /** Kästen je Seite des Spiels (`home`/`away`, @SL-176); die Anzeigeseite (`links`/`rechts`) legt der Aufrufer darüber. Fehlen sie, bleibt der Kasten neutral. */
  kasten?: CockpitKasten;
  fieldName?: string;
  tournamentName?: string;
  /** Vor dem Anpfiff, zwischen den Spielen und nach der Übernahme (Aufgabe 2.5). */
  vor?: ScoreboardVorInput;
  /** @FU-115: wer das Spiel im Spielplan beendet hat (Name aus dem Protokoll); `null`/fehlt = ohne Namen. */
  eingetragenVon?: string | null;
}

/** Sekunden als `m:ss` (Minuten ohne führende Null, nie negativ). */
export function formatUhr(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Rückfall-Status je Zustand der Tafel, nur ohne Engine-Ansicht (siehe `badgeOf`). `scheduled` heißt: kein Abzeichen
 * mit Wort, nur die Anstoßzeit oder nichts (@OB-065, @OB-066).
 */
const STATUS_OHNE_ANSICHT: Record<CockpitZustand, ViewMatchStatus> = {
  vorAnpfiff: 'scheduled', laeuft: 'running', pausiert: 'paused', halbzeitpause: 'paused', pauseVorVerlaengerung: 'paused',
  entscheidung: 'paused', strafstoss: 'running', abgepfiffen: 'finished', wartetAufHerkunft: 'scheduled', keinSpiel: 'scheduled',
};

/**
 * Das Zustands-Abzeichen der Tafel: das Wort des Feinstatus, ohne Uhr. Vor dem Anpfiff bleibt der Platz leer; die
 * Anstoßzeit steht bei der Uhr und „überfällig“ im selben Platz (@OB-068). Liegt eine Engine-Ansicht vor, gilt
 * `viewStatus` wie auf der Spielkarte (ausgefallen bleibt ausgefallen); `STATUS_OHNE_ANSICHT` ist nur der Rückfall.
 */
function badgeOf(input: ScoreboardInput): MatchBadgeModel {
  const { phase, view } = input;
  const status = view ? viewStatus({}, view.status) : STATUS_OHNE_ANSICHT[phase.zustand];
  if (status === 'scheduled') { return { kind: 'none' }; }
  const engine = view ? { status: view.status, phase: view.phase, section: view.section, sections: view.sections } : undefined;
  return matchBadgeModel({ status, engine });
}

/** Nach dem Ende (@SL-169): statt des Abschnitts, wie das Spiel endete – regulär nichts, sonst „nach Verlängerung“ bzw. „nach Strafstoßschießen“. */
function nachEndeTextOf(view: PhaseView | null, t: Uebersetzer): string | null {
  if (view?.phase === 'shootout') { return t('tafel.nachEnde.strafstoss'); }
  return view?.phase === 'overtime' ? t('tafel.nachEnde.verlaengerung') : null;
}

/** @FU-112, @FU-115: im Spielplan beendet -- „Ende – eingetragen im Spielplan“ (mit Namen: „… von Olli“) statt einer Zeit. */
function eingetragenTextOf(view: PhaseView | null, von: string | null | undefined, t: Uebersetzer): string | null {
  if (!view?.eingetragenImSpielplan) { return null; }
  return von ? t('tafel.nachEnde.eingetragenVon', { name: von }) : t('tafel.nachEnde.eingetragen');
}

function abschnittTextOf(phase: CockpitPhase, view: PhaseView | null, von: string | null | undefined, t: Uebersetzer): string | null {
  if (phase.zustand === 'abgepfiffen') { return eingetragenTextOf(view, von, t) ?? nachEndeTextOf(view, t); }
  if (phase.zustand !== 'laeuft' && phase.zustand !== 'pausiert') { return null; }
  if (phase.abschnittArt === 'goldenGoal') { return t('tafel.abschnitt.goldenGoal'); }
  if (phase.abschnittArt === 'verlaengerung') { return t('tafel.abschnitt.verlaengerung'); }
  if (phase.abschnitte === 2) { return t('tafel.abschnitt.halbzeit', { nummer: phase.abschnitt }); }
  return phase.abschnitte > 2 ? t('tafel.abschnitt.vonN', { nummer: phase.abschnitt, gesamt: phase.abschnitte }) : null; // @FU-072
}

/**
 * Farbe des Zeitbalkens in der Schlussphase: eine Quelle mit dem Hallenmonitor (`core/view/zeitBalken`, @ZM-166).
 */
export { BALKEN_TON_SCHLUSSPHASE } from '../../../core/view/zeitBalken';

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
    const abgelaufen = anzeige.phase === 'abgelaufen'; // @ZM-166: „Zeit abgelaufen“ über der Uhr, keine Zeile darunter
    if (anzeige.hinweisUhrHaelt && !schlussphase) { hinweise.push(t('tafel.uhrHaelt')); }
    return {
      hinweise,
      uhr: {
        rest: formatUhr(anzeige.restSekunden), gespielt, schlussphase, steht, hervorgehoben: anzeige.hervorhebung || steht,
        balken: zeitBalkenLaufend(anzeige.restSekunden * 1000, view.sectionLimitMs, steht, schlussphase),
        label: t(abgelaufen ? 'tafel.uhr.zeitAbgelaufen' : steht ? 'tafel.uhr.steht' : 'tafel.uhr.restzeit'),
        unterzeile: abgelaufen ? '' : t('tafel.unterzeile.spielzeit', { zeit: gespielt }), // '' statt null: sonst setzt die Handy-Tafel die gespielte Zeit darunter
      },
    };
  }
  if (phase.zustand === 'halbzeitpause' || phase.zustand === 'pauseVorVerlaengerung') {
    const rest = (view.breakRemainingMs ?? 0) / 1000;
    const vorbei = rest === 0;
    const vorVerlaengerung = phase.zustand === 'pauseVorVerlaengerung';
    return {
      hinweise,
      uhr: {
        rest: formatUhr(rest), gespielt: null, schlussphase: false, steht: false, hervorgehoben: vorbei, ton: vorbei ? 'ok' : 'gedaempft',
        balken: zeitBalkenPause(rest * 1000, view.breakTotalMs ?? undefined),
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
  if (phase.zustand === 'entscheidung') {
    hinweise.push(t('tafel.entscheidungOffen'));
    return { hinweise, uhr: { rest: abgelaufenRest, gespielt: null, schlussphase: false, steht: false, hervorgehoben: false, ton: 'gedaempft', label: t('tafel.uhr.endstand'), unterzeile: null } };
  }
  if (phase.zustand === 'abgepfiffen') {
    // B2: nie eine Restzeit unter „Ende“ – nach dem Strafstoßschießen dessen Ergebnis, sonst die gespielte Zeit
    const strafstoss = match && view.phase === 'shootout' ? liveMatchFinalScore(match)?.penalty : undefined; // nur, wenn die Phase es hergibt
    if (strafstoss) {
      const seite = (anzeige: Side): number => (anzeige === 'home' ? strafstoss.a : strafstoss.b);
      return {
        hinweise,
        uhr: { rest: `${seite(input.links)}:${seite(input.rechts)}`, gespielt: null, schlussphase: false, steht: false, hervorgehoben: false, ton: 'gedaempft', label: t('tafel.uhr.strafstoss'), unterzeile: null },
      };
    }
    if (view.status === 'skipped') { return { uhr: null, hinweise }; } // ausgefallen: nichts gespielt, keine Zeit
    if (view.eingetragenImSpielplan) { return { uhr: null, hinweise }; } // @FU-112: im Spielplan beendet, keine gespielte Zeit
    // @SL-169: die ganze gespielte Zeit aller Abschnitte; „von 14:00“ nur bei vorzeitigem Abpfiff der regulären Spielzeit
    const gespielt = Math.min(view.playedMs, view.plannedMs);
    const vorzeitig = view.phase === 'regular' && gespielt < view.plannedMs;
    return {
      hinweise,
      uhr: {
        rest: formatUhr(gespielt / 1000), gespielt: null, schlussphase: false, steht: false, hervorgehoben: false, ton: 'gedaempft',
        label: t('tafel.uhr.gespielt'), unterzeile: vorzeitig ? t('tafel.unterzeile.vonGeplant', { zeit: formatUhr(view.plannedMs / 1000) }) : null,
      },
    };
  }
  return { uhr: null, hinweise };
}

/** Quittung nach dem Abpfiff (@SL-152): „Abgepfiffen · 2:1 gespeichert“, nur in den 30 Sekunden danach und nur für ein beendetes Spiel. */
function quittungTextOf(input: ScoreboardInput, links: ScoreboardSeite, rechts: ScoreboardSeite, t: Uebersetzer): string | null {
  const { view, match } = input;
  // @FU-112: nach dem Beenden im Spielplan kein „Abgepfiffen“ -- die Tafel nennt den Weg
  if (!match || view?.status !== 'finished' || (view.quittungRestMs ?? 0) <= 0 || view.eingetragenImSpielplan) { return null; }
  return t('tafel.quittung', { links: links.tore, rechts: rechts.tore });
}

function ariaStandOf(input: ScoreboardInput, links: ScoreboardSeite, rechts: ScoreboardSeite, strafstoss: { a: number; b: number } | undefined, t: Uebersetzer): string {
  const basis = { links: links.name, linksTore: links.tore, rechts: rechts.name, rechtsTore: rechts.tore };
  if (input.phase.zustand !== 'abgepfiffen' || !strafstoss) { return t('tafel.ariaStand', basis); }
  const seite = (anzeige: Side): number => (anzeige === 'home' ? strafstoss.a : strafstoss.b);
  return t('tafel.ariaStandStrafstoss', { ...basis, linksStrafstoss: seite(input.links), rechtsStrafstoss: seite(input.rechts) });
}

export function toScoreboardModel(input: ScoreboardInput, t: Uebersetzer): ScoreboardModel {
  const { match, phase } = input;
  const endstand = match ? liveMatchFinalScore(match) : null; // Tore = regulär + Verlängerung, ohne Strafstoßschießen (A-36b)
  const stand = endstand ? { home: endstand.a, away: endstand.b } : { home: 0, away: 0 };
  const seite = (anzeige: 'links' | 'rechts'): ScoreboardSeite => {
    const s = input[anzeige];
    return { name: match ? (s === 'home' ? match.homeTeam.name : match.awayTeam.name) : '', tore: s === 'home' ? stand.home : stand.away, label: t(s === 'home' ? 'spalte.heim' : 'spalte.gast'), ...(input.kasten ? { kasten: input.kasten[s] } : {}) };
  };
  const links = seite('links');
  const rechts = seite('rechts');
  const { uhr, hinweise } = uhrOf(input, t);
  const vor = scoreboardVor(input, t);
  const abschnittText = abschnittTextOf(phase, input.view, input.eingetragenVon, t) ?? vor.kopfText;
  const laeuft = phase.zustand === 'laeuft' || phase.zustand === 'pausiert';
  const kopfText = [
    match ? t('tafel.kopf.spiel', { nummer: match.number }) : null, input.fieldName ?? null, abschnittText,
    laeuft && uhr?.gespielt ? t('tafel.kopf.gespielt', { zeit: uhr.gespielt }) : null,
  ].filter((teil): teil is string => Boolean(teil)).join(' · ');
  return {
    kopfText: kopfText || null,
    badge: badgeOf(input), links, rechts,
    uhr: uhr ?? vor.uhr, abschnittText: abschnittTextOf(phase, input.view, input.eingetragenVon, t) ?? vor.kopfText, hinweise: [...hinweise, ...vor.hinweise], leerAnzeige: vor.leerAnzeige,
    ueberfaelligText: vor.ueberfaelligText, quittungText: quittungTextOf(input, links, rechts, t),
    eintraegeWartenText: input.eintraegeWarten > 0 ? t('tafel.eintraegeWarten', { count: input.eintraegeWarten }) : null,
    eintraegeWartenKurz: input.eintraegeWarten > 0 ? String(input.eintraegeWarten) : null,
    helferAnfragenText: input.helferAnfragen > 0 ? t('tafel.helferAnfragen', { count: input.helferAnfragen }) : null,
    ariaStand: ariaStandOf(input, links, rechts, input.view?.phase === 'shootout' ? endstand?.penalty : undefined, t),
  };
}
