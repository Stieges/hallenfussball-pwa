/**
 * Restzeit für Zuschauer (Aufgabe 5.1a Spielanzeige, @ZM-162, @ZM-139, @ZM-040, @OB-066, @OB-067).
 *
 * Eine reine Funktion: aus der gespielten Zeit und dem Feinstatus wird die Restzeit im Abschnitt (herunterzählend, nie
 * negativ, nie die gespielte Zeit), der Abschnitt und der Zustand „Spielzeit abgelaufen“. In der Pause zwischen zwei
 * Abschnitten, vor der Verlängerung und vor dem Strafstoßschießen steht die Pausen-Restzeit; fehlen die Pausen-Daten,
 * gibt es keine Uhr (nie „abgelaufen“ zwischen zwei Abschnitten). Kein React. Weiterzählen zwischen Abrufen, Server-Zeitbezug
 * und „unsicher“ ohne Netz bleiben B-15; hier gilt: `nowMs - engine.asOfMs` zählt eine laufende Uhr seit dem Abruf weiter.
 */
import { getClockDisplay, type ClockMode } from '../match/clockDisplay';
import type { MatchBadgeEngineDetail } from './badge';
import type { MatchView } from './types';

export interface SpectatorClockInput {
  /** Gespielte Zeit seit Anpfiff ohne Pausen (Zwischenspeicher-Felder bzw. Engine); ohne Feinstatus die einzige Quelle */
  totalElapsedSec: number;
  /** Länge eines regulären Abschnitts */
  sectionSec: number;
  sections: number;
  /** Länge der Verlängerung; fehlt sie (und der Feinstatus), gibt es dort keine Uhr */
  overtimeSec?: number;
  /** Die Uhr steht (Spiel unterbrochen) */
  stopped: boolean;
  clockMode?: ClockMode;
  /** Feinstatus mit Vorrang (Verwaltung: Engine; Monitor/Zuschauer: live_state) */
  engine?: MatchBadgeEngineDetail;
  /** Jetzt (Geräteuhr, ms): zählt eine laufende Uhr seit `engine.asOfMs` weiter */
  nowMs?: number;
}

export type SpectatorSectionKey =
  | 'firstHalf' | 'secondHalf' | 'sectionOfN' | 'overtime' | 'breakBeforeOvertime' | 'breakBeforeShootout' | 'halftimeBreak' | 'sectionBreak';

export interface SpectatorClock {
  /** „1:50“ (m:ss), nie negativ; `null` = keine Uhr (Pause ohne Pausen-Daten, Entscheidung offen, Strafstoßschießen) */
  remaining: string | null;
  sectionKey: SpectatorSectionKey | null;
  section: number;
  sections: number;
  stopped: boolean;
  /** „Spielzeit abgelaufen – Ergebnis folgt“: nur der Übergang bis zum Abpfiff (Autofinish) */
  expired: boolean;
}

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / SECONDS_PER_MINUTE))}:${String(total % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

const NO_CLOCK = (section: number, sections: number, sectionKey: SpectatorSectionKey | null, stopped: boolean): SpectatorClock =>
  ({ remaining: null, sectionKey, section, sections, stopped, expired: false });

function regularKey(section: number, sections: number): SpectatorSectionKey | null {
  if (sections <= 1) { return null; }
  if (sections === 2) { return section <= 1 ? 'firstHalf' : 'secondHalf'; }
  return 'sectionOfN';
}

function breakKey(engine: MatchBadgeEngineDetail): SpectatorSectionKey {
  if (engine.phase === 'overtime') { return 'breakBeforeOvertime'; }
  if (engine.phase === 'shootout') { return 'breakBeforeShootout'; }
  return engine.sections === 2 && engine.section === 1 ? 'halftimeBreak' : 'sectionBreak';
}

/** Sekunden, die seit dem Abruf vergangen sind, solange die Uhr läuft bzw. die Pause tickt. */
function sinceFetch(engine: MatchBadgeEngineDetail, nowMs: number | undefined): number {
  return nowMs === undefined || engine.asOfMs === undefined ? 0 : Math.max(0, Math.floor((nowMs - engine.asOfMs) / MS_PER_SECOND));
}

function fromEngine(input: SpectatorClockInput, engine: MatchBadgeEngineDetail): SpectatorClock {
  const { stopped } = input;
  const sections = engine.sections;
  switch (engine.status) {
    case 'section_break': {
      const left = engine.breakRemainingSec;
      const remaining = left === undefined ? null : formatRemaining(left - sinceFetch(engine, input.nowMs));
      return { ...NO_CLOCK(engine.section, sections, breakKey(engine), false), remaining };
    }
    case 'running':
    case 'paused': {
      if (engine.phase === 'shootout') { return NO_CLOCK(engine.section, sections, null, stopped); }
      const overtime = engine.phase === 'overtime';
      const length = overtime ? engine.overtimeSeconds ?? input.overtimeSec : engine.sectionSeconds ?? input.sectionSec;
      const key = overtime ? 'overtime' : regularKey(engine.section, sections);
      if (length === undefined || length <= 0) { return NO_CLOCK(engine.section, sections, key, stopped); }
      const base = engine.sectionElapsedSec ?? Math.max(0, input.totalElapsedSec - (overtime ? sections * input.sectionSec : (engine.section - 1) * input.sectionSec));
      const played = base + (engine.running === true && !stopped ? sinceFetch(engine, input.nowMs) : 0);
      const display = getClockDisplay({
        gespielt: played, abschnittSekunden: length, uhrArt: input.clockMode, angehalten: stopped,
        abschnitt: engine.section, abschnitteGesamt: sections, verlaengerung: overtime,
      });
      const lastSection = overtime || engine.section >= sections;
      return {
        remaining: formatRemaining(display.restSekunden), sectionKey: key, section: engine.section, sections, stopped,
        expired: display.phase === 'abgelaufen' && lastSection && !stopped,
      };
    }
    default:
      return NO_CLOCK(engine.section, sections, null, stopped);
  }
}

function fromCache(input: SpectatorClockInput): SpectatorClock {
  const { sectionSec, sections, stopped } = input;
  if (sectionSec <= 0 || sections < 1) { return NO_CLOCK(1, Math.max(1, sections), null, stopped); }
  const total = Math.max(0, Math.floor(input.totalElapsedSec));
  const regular = sections * sectionSec;
  if (total > regular) {
    // Verlängerung: der Zwischenspeicher kennt die Phase nicht – ohne Feinstatus keine Uhr
    return NO_CLOCK(sections, sections, 'overtime', stopped);
  }
  if (total > 0 && total < regular && total % sectionSec === 0) {
    // Abschnittsende ohne Pausen-Daten: keine Uhr, nie „abgelaufen“ (@OB-066)
    const section = total / sectionSec;
    return NO_CLOCK(section, sections, sections === 2 ? 'halftimeBreak' : 'sectionBreak', stopped);
  }
  const section = Math.min(sections, Math.floor(Math.max(0, total - 1) / sectionSec) + 1);
  const display = getClockDisplay({
    gespielt: total - (section - 1) * sectionSec, abschnittSekunden: sectionSec, uhrArt: input.clockMode, angehalten: stopped,
    abschnitt: section, abschnitteGesamt: sections,
  });
  return {
    remaining: formatRemaining(display.restSekunden), sectionKey: regularKey(section, sections), section, sections, stopped,
    expired: display.phase === 'abgelaufen' && section >= sections && !stopped,
  };
}

export function spectatorClockOf(input: SpectatorClockInput): SpectatorClock {
  return input.engine === undefined ? fromCache(input) : fromEngine(input, input.engine);
}

/**
 * Die Uhr eines Spiels der Ansicht: nur für laufende oder unterbrochene Spiele. Ohne Feinstatus und ohne gespielte Zeit
 * gibt es keine Uhr (`null`), nie eine volle Restzeit aus fehlenden Daten.
 */
export function spectatorClockForMatch(match: MatchView, totalElapsedSec: number | undefined, nowMs: number): SpectatorClock | null {
  const rules = match.clockRules;
  if (!match.isLive || rules === undefined || (match.engine === undefined && totalElapsedSec === undefined)) {
    return null;
  }
  return spectatorClockOf({
    totalElapsedSec: totalElapsedSec ?? 0, sectionSec: rules.sectionSeconds, sections: rules.sections, overtimeSec: rules.overtimeSeconds,
    stopped: match.status === 'paused', clockMode: rules.clockMode, engine: match.engine, nowMs,
  });
}
