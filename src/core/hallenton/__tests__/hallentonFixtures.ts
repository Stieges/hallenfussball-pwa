/**
 * Testlagen für den Hallen-Lautsprecher (Record `docs/anforderungen/2026-10-15_hallenton.md`).
 *
 * Spiel 11 auf Feld 1 und Spiel 12 auf Feld 2: 2 Abschnitte à 6 Minuten, 1 Minute Pause, Gruppenspiel. Halbfinale 1 auf
 * Feld 1: K.-o.-Spiel 2 × 5 Minuten, Verlängerung 3 Minuten. Echte Engine (`reduceMatch`), nichts nachgebaut.
 * `lauf` spielt den späteren Einbau nach: in festem Takt planen und fällige Töne spielen.
 */
import { reduceMatch, type EngineEvent, type MatchContext, type MatchRules, type MatchState, type TiebreakMode } from '../../match';
import {
  LEERES_GEDAECHTNIS,
  hallTonGespielt,
  planeHallToene,
  type FeldStand,
  type HallTonArt,
  type TonGedaechtnis,
} from '..';

export const T0 = 1_790_000_000_000;
export const ABSCHNITT_MS = 360_000;
export const PAUSE_MS = 60_000;

export const CTX_11: MatchContext = { matchId: 'spiel-11', teamAId: 'sv-sued', teamBId: 'fc-nord' };
export const CTX_12: MatchContext = { matchId: 'spiel-12', teamAId: 'tsv-ost', teamBId: 'djk-west' };
export const CTX_HF: MatchContext = { matchId: 'halbfinale-1', teamAId: 'fc-nord', teamBId: 'djk-berg' };

export function gruppenRegeln(sections: 2 | 3 = 2): MatchRules {
  return {
    sections, sectionSeconds: ABSCHNITT_MS / 1000, breakSeconds: PAUSE_MS / 1000, knockout: false, tiebreak: null,
    overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 6, penaltySeconds: 120,
  };
}

export function koRegeln(tiebreak: TiebreakMode): MatchRules {
  return {
    sections: 2, sectionSeconds: 300, breakSeconds: 60, knockout: true, tiebreak, overtimeSeconds: 180,
    shootersPerTeam: 5, suddenDeathAfter: 6, penaltySeconds: 120,
  };
}

let laufendeNummer = 0;

export function ev(
  type: EngineEvent['type'],
  at: number,
  section: number,
  clockMs: number | null,
  extra: Partial<EngineEvent> = {},
): EngineEvent {
  laufendeNummer += 1;
  return {
    id: `00000000-0000-4000-8000-${String(laufendeNummer).padStart(12, '0')}`,
    type, actor: 'helper', at, section, clockMs, payload: {}, ...extra,
  };
}

export function stateAus(log: readonly EngineEvent[], ctx: MatchContext = CTX_11): MatchState {
  const result = reduceMatch(log, ctx);
  const abgelehnt = result.results.filter((r) => r.status === 'rejected');
  if (abgelehnt.length > 0) {
    throw new Error(`Testlage ungültig: ${JSON.stringify(abgelehnt)}`);
  }
  return result.state;
}

/** Anpfiff von Spiel 11 (bzw. `ctx`) um `start`. */
export function anpfiff(start = T0, rules: MatchRules = gruppenRegeln()): EngineEvent[] {
  return [ev('MATCH_START', start, 1, null, { payload: { rules } })];
}

/** Spiel läuft im zweiten Abschnitt: erster Abschnitt endete bei Ablauf, Wiederanpfiff nach der Pause. */
export function zweiterAbschnitt(start = T0): EngineEvent[] {
  return [
    ...anpfiff(start),
    ev('SECTION_END', start + ABSCHNITT_MS, 1, ABSCHNITT_MS),
    ev('SECTION_START', start + ABSCHNITT_MS + PAUSE_MS, 2, null),
  ];
}

/** Wanduhr des Ablaufs von Abschnitt 1 bzw. 2 ohne Unterbrechung. */
export const ENDE_A1 = T0 + ABSCHNITT_MS;
export const ENDE_A2 = T0 + 2 * ABSCHNITT_MS + PAUSE_MS;

export function stand(
  state: MatchState,
  ctx: MatchContext,
  antwortAlterMs: number,
  bekanntSeit: number,
  feldId = 'feld-1',
): FeldStand {
  return { feldId, ctx, state, antwortAlterMs, bekanntSeit };
}

/** Stand am Server mit dem Alter der letzten Antwort (Regel 2: es gibt keine andere Quelle). */
export function server(antwortAlterMs = 0): number {
  return antwortAlterMs;
}

export interface GespielterTon {
  at: number;
  art: HallTonArt;
  schluessel: readonly string[];
  felder: readonly string[];
}

/**
 * Spielt den Einbau nach: von `von` bis `bis` alle `taktMs` planen (`felderZu(jetzt)` liefert den Stand je Feld),
 * fällige Töne spielen und merken. Ergebnis: alle gespielten Töne.
 */
export function lauf(
  felderZu: (jetzt: number) => FeldStand[],
  von: number,
  bis: number,
  taktMs = 50,
  start: TonGedaechtnis = LEERES_GEDAECHTNIS,
): { gespielt: GespielterTon[]; gedaechtnis: TonGedaechtnis } {
  let gedaechtnis = start;
  const gespielt: GespielterTon[] = [];
  for (let jetzt = von; jetzt <= bis; jetzt += taktMs) {
    const plan = planeHallToene({ felder: felderZu(jetzt), serverNow: jetzt }, gedaechtnis);
    gedaechtnis = plan.gedaechtnis;
    for (const ton of plan.toene) {
      if (ton.at <= jetzt) {
        gespielt.push({ at: jetzt, art: ton.art, schluessel: ton.schluessel, felder: ton.felder });
        gedaechtnis = hallTonGespielt(gedaechtnis, ton, jetzt);
      }
    }
  }
  return { gespielt, gedaechtnis };
}

/**
 * Takt-Nachbau nach dem Einbau-Vertrag (H3b): geplant wird nur alle `taktMs` (erster Plan bei `von + versatzMs`), ein
 * geplanter Ton erklingt genau zu seinem `at` (Wecker), ein neuer Plan ersetzt die noch nicht gespielten Töne.
 * Zeitraster 10 ms.
 */
export function laufImTakt(
  felderZu: (jetzt: number) => FeldStand[],
  von: number,
  bis: number,
  { taktMs = 1000, versatzMs = 0 }: { taktMs?: number; versatzMs?: number } = {},
): GespielterTon[] {
  let gedaechtnis = LEERES_GEDAECHTNIS;
  let eingeplant: ReturnType<typeof planeHallToene>['toene'] = [];
  const gespielt: GespielterTon[] = [];
  let naechsterPlan = von + versatzMs;
  for (let jetzt = von; jetzt <= bis; jetzt += 10) {
    if (jetzt >= naechsterPlan) {
      const plan = planeHallToene({ felder: felderZu(jetzt), serverNow: jetzt }, gedaechtnis);
      gedaechtnis = plan.gedaechtnis;
      eingeplant = plan.toene;
      naechsterPlan += taktMs;
    }
    const faellig = eingeplant.filter((ton) => ton.at <= jetzt);
    eingeplant = eingeplant.filter((ton) => ton.at > jetzt);
    for (const ton of faellig) {
      gespielt.push({ at: jetzt, art: ton.art, schluessel: ton.schluessel, felder: ton.felder });
      gedaechtnis = hallTonGespielt(gedaechtnis, ton, jetzt);
    }
  }
  return gespielt;
}

/** Versätze des 1-s-Takts gegen das Ende, mit denen die Takt-Tests laufen. */
export const TAKT_VERSAETZE = [50, 300, 950] as const;
