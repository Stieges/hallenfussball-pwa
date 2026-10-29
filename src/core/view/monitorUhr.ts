/**
 * Uhr des Hallenmonitors (R5 PR 2; @ZM-176, @ZM-084, @ZM-139, @ZM-145, @ZM-166, @ZM-137, @ZM-085, @ME-031).
 *
 * Eine reine Funktion: aus dem Spiel der Ansicht, seinem Feinstatus (`live_state`, in Serverzeit verankert) und „jetzt“ in
 * Serverzeit entstehen Restzeit des Abschnitts (bzw. der Pause), der Text über der Uhr, der Zeitbalken und der Zeitpunkt des
 * nächsten Sekundenwechsels. Kein React.
 *
 * - Nur laufende oder unterbrochene Spiele haben eine Uhr (`isLive`). Ein beendetes Spiel hat nie eine, auch wenn noch ein
 *   Anker eines laufenden Spiels mitkommt (@ZM-180).
 * - Strafstoßschießen und „Entscheidung offen“: keine Uhr, kein Balken, kein Zeit-Text (@ZM-166).
 * - Ohne Feinstatus rechnet sie mit den Zeitfeldern des Zwischenspeichers (gespielte Sekunden seit Anpfiff), wie die
 *   Zuschauer-Seite (`spectatorClock`); über die reguläre Spielzeit hinaus „Zeit abgelaufen“ wie bisher am Monitor (die
 *   Zeitfelder kennen keine Verlängerung).
 * - `monitorUhrMitSperre`: Innerhalb desselben Uhr-Ankers steigt die angezeigte Restzeit nie (@ZM-176 „springt nie zurück“).
 *   Ein neuer Anker (Pause, Weiter, Abschnitt, Zeitkorrektur) übernimmt den neuen Wert.
 */
import { getClockDisplay } from '../match/clockDisplay';
import { badgeDetailFromLiveState, liveStateAnchorKey, type MatchBadgeEngineDetail } from './badge';
import { zeitBalkenLaufend, zeitBalkenPause, type ZeitBalkenModell } from './zeitBalken';
import type { MatchView, SpectatorClockRules } from './types';

/** Text über der Uhr: „Restzeit“ | „angehalten“ | „Pause · Halbzeit“ | „Pause“ | „Verlängerung“ | „Zeit abgelaufen“ */
export type MonitorUhrText = 'restzeit' | 'angehalten' | 'pauseHalbzeit' | 'pause' | 'verlaengerung' | 'zeitAbgelaufen';

export interface MonitorUhrModell {
  /** Restzeit in ganzen Sekunden, nie negativ; `null` = keine Ziffern (Pause ohne Pausen-Daten) */
  restSekunden: number | null;
  text: MonitorUhrText;
  /** Zeitbalken; `null` = keiner */
  balken: ZeitBalkenModell | null;
  /** Angehaltene Schlussphase (@ZM-137): Uhr und Balken violett */
  schlussphase: boolean;
  /** Die Uhr steht (Tom hat sie angehalten) */
  steht: boolean;
  /** Uhr-Anker: gleich, solange die Uhr ohne Eingriff weiterläuft */
  anker: string;
  /** Millisekunden bis zum nächsten Wechsel der Anzeige; `null` = die Anzeige steht */
  msBisWechsel: number | null;
}

export interface MonitorUhrEingabe {
  match: Pick<MatchView, 'isLive' | 'clockRules'>;
  /** `matches.live_state` des Spiels (Serverzeit) */
  liveState?: unknown;
  /** Ohne Feinstatus: gespielte Sekunden seit Anpfiff aus den Zeitfeldern, zum Zeitpunkt `nowMs` */
  cacheElapsedSec?: number;
  /** Ohne Feinstatus: Anker der Zeitfelder (Start, Stand bei Start, Status) */
  cacheAnker?: string;
  /** Die Uhr steht laut Zeitfeldern (nur ohne Feinstatus) */
  cacheSteht?: boolean;
  /** Jetzt in Serverzeit (ms) */
  nowMs: number;
}

const MS_PER_SECOND = 1000;
/** Takt ohne Feinstatus: die Zeitfelder kennen den Sekundenwechsel nicht genau. */
const ZEITFELDER_TAKT_MS = 250;

interface Lauf {
  gespieltMs: number;
  laenge: number;
  steht: boolean;
  verlaengerung: boolean;
  abschnitt: number;
  abschnitte: number;
  anker: string;
  genau: boolean;
}

function laufend(rules: SpectatorClockRules, lauf: Lauf): MonitorUhrModell {
  const anzeige = getClockDisplay({
    gespielt: lauf.gespieltMs / MS_PER_SECOND, abschnittSekunden: lauf.laenge, uhrArt: rules.clockMode, angehalten: lauf.steht,
    schlussphaseMinuten: rules.finalPhaseMinutes, abschnitt: lauf.abschnitt, abschnitteGesamt: lauf.abschnitte,
    verlaengerung: lauf.verlaengerung,
  });
  const abgelaufen = anzeige.phase === 'abgelaufen';
  const schlussphase = anzeige.phase === 'schlussphaseAngehalten';
  const text: MonitorUhrText = abgelaufen ? 'zeitAbgelaufen' : lauf.steht ? 'angehalten' : lauf.verlaengerung ? 'verlaengerung' : 'restzeit';
  const tickt = !lauf.steht && !abgelaufen;
  return {
    restSekunden: anzeige.restSekunden, text, schlussphase, steht: lauf.steht, anker: lauf.anker,
    balken: zeitBalkenLaufend(anzeige.restSekunden, lauf.laenge, lauf.steht, schlussphase),
    msBisWechsel: !tickt ? null : lauf.genau ? MS_PER_SECOND - (lauf.gespieltMs % MS_PER_SECOND) : ZEITFELDER_TAKT_MS,
  };
}

function pauseText(phase: MatchBadgeEngineDetail['phase'], section: number, sections: number): MonitorUhrText {
  return phase === 'regular' && sections === 2 && section === 1 ? 'pauseHalbzeit' : 'pause';
}

function ausFeinstatus(rules: SpectatorClockRules, d: MatchBadgeEngineDetail, anker: string): MonitorUhrModell | null {
  if (d.status === 'section_break') {
    const lang = d.breakSeconds;
    const vergangen = d.breakElapsedMs ?? 0;
    const rest = lang === undefined ? null : Math.max(0, lang - Math.floor(vergangen / MS_PER_SECOND));
    return {
      restSekunden: rest, text: pauseText(d.phase, d.section, d.sections), schlussphase: false, steht: false, anker,
      balken: rest === null ? null : zeitBalkenPause(rest, lang),
      msBisWechsel: rest === null || rest === 0 ? null : MS_PER_SECOND - (vergangen % MS_PER_SECOND),
    };
  }
  if ((d.status !== 'running' && d.status !== 'paused') || d.phase === 'shootout') {
    return null;
  }
  const verlaengerung = d.phase === 'overtime';
  const laenge = verlaengerung ? d.overtimeSeconds ?? rules.overtimeSeconds : d.sectionSeconds ?? rules.sectionSeconds;
  if (!(laenge > 0)) {
    return null;
  }
  return laufend(rules, {
    gespieltMs: d.sectionElapsedMs ?? (d.sectionElapsedSec ?? 0) * MS_PER_SECOND, laenge, verlaengerung,
    steht: d.status === 'paused' || d.running !== true, abschnitt: d.section, abschnitte: d.sections, anker, genau: true,
  });
}

function ausZeitfeldern(rules: SpectatorClockRules, gesamt: number, steht: boolean, anker: string): MonitorUhrModell | null {
  const { sectionSeconds: abschnittSek, sections } = rules;
  const regulaer = sections * abschnittSek;
  const total = Math.min(regulaer, Math.max(0, Math.floor(gesamt)));
  if (abschnittSek <= 0 || sections < 1) {
    return null;
  }
  if (total > 0 && total < regulaer && total % abschnittSek === 0) {
    // Abschnittsende ohne Pausen-Daten: keine Ziffern, nie „abgelaufen“ (@OB-066)
    const nach = total / abschnittSek;
    return {
      restSekunden: null, text: pauseText('regular', nach, sections), balken: null, schlussphase: false, steht: false, anker,
      msBisWechsel: null,
    };
  }
  const abschnitt = Math.min(sections, Math.floor(Math.max(0, total - 1) / abschnittSek) + 1);
  return laufend(rules, {
    gespieltMs: (total - (abschnitt - 1) * abschnittSek) * MS_PER_SECOND, laenge: abschnittSek, verlaengerung: false, steht,
    abschnitt, abschnitte: sections, anker, genau: false,
  });
}

/** Die Uhr des Monitors für ein Spiel zum Zeitpunkt `nowMs` (Serverzeit); `null` = keine Uhr, kein Balken, kein Zeit-Text. */
export function monitorUhrOf(eingabe: MonitorUhrEingabe): MonitorUhrModell | null {
  const rules = eingabe.match.clockRules;
  if (!eingabe.match.isLive || rules === undefined) {
    return null;
  }
  const detail = badgeDetailFromLiveState(eingabe.liveState, eingabe.nowMs);
  const anker = liveStateAnchorKey(eingabe.liveState);
  if (detail !== undefined && anker !== null) {
    return ausFeinstatus(rules, detail, anker);
  }
  if (eingabe.cacheElapsedSec === undefined) {
    return null;
  }
  return ausZeitfeldern(rules, eingabe.cacheElapsedSec, eingabe.cacheSteht === true, `zeitfelder|${eingabe.cacheAnker ?? ''}`);
}

/**
 * Sperre gegen Rückwärts (@ZM-176): Bleibt der Anker gleich, steigt die angezeigte Restzeit nie – auch wenn die gemessene
 * Serverzeit zwischen zwei Antworten schwankt. Dann bleibt die vorige Anzeige (Ziffern, Text, Balken) stehen.
 */
export function monitorUhrMitSperre(jetzt: MonitorUhrModell | null, vorher: MonitorUhrModell | null): MonitorUhrModell | null {
  if (jetzt === null || jetzt.anker !== vorher?.anker) {
    return jetzt;
  }
  if (jetzt.restSekunden === null || vorher.restSekunden === null || jetzt.restSekunden <= vorher.restSekunden) {
    return jetzt;
  }
  return { ...jetzt, restSekunden: vorher.restSekunden, text: vorher.text, balken: vorher.balken, schlussphase: vorher.schlussphase };
}
