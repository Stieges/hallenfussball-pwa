/**
 * `serverRules` -- TS-Zwilling von `match_engine.server_rules` (supabase/migrations/
 * 20260928_003_append_match_events.sql, RC2/V6). Das Gerät rechnet damit beim Anpfiff offline die
 * Regeln, die der Server beim MATCH_START ohnehin selbst setzt (R4). Gleichlauf-Fixtures unter
 * `__fixtures__/rules/*.json`. ZA-3 (D1): Entscheidungsart je Runde mit Rückfall (20261028_001).
 *
 * Genauigkeit: SQL rechnet mit `numeric` (exakt dezimal). Damit z. B. `2.05 * 60` hier ebenfalls
 * 123 ergibt (Gleitkomma: 122.99…), rechnet diese Datei mit Dezimalbrüchen auf BigInt-Basis.
 * Eine JSON-Zahl wird über ihre kürzeste Dezimaldarstellung (`String(n)`) gelesen -- das ist genau
 * der Text, den `JSON.stringify` in die Datenbank schreibt.
 */
import type { MatchRules } from '../types';

export interface ServerRulesInput {
  /** `matches.duration_minutes` (lokal nicht abgebildet, V6: offline `null`). */
  durationMinutes: number | null;
  /** `matches.phase`; `null` zählt als Gruppenphase. */
  phase: string | null;
  /** `matches.final_type`; thirdPlace/fifthSixth/seventhEighth = Platzierungsspiel (@W2A-039). Fehlt = `null`. */
  finalType?: string | null;
  /** `tournaments.group_phase_duration` */
  groupPhaseDuration: number | null;
  /** `tournaments.final_round_duration` */
  finalRoundDuration: number | null;
  /** `tournaments.config` (jsonb) */
  config: unknown;
  /** `tournaments.finals_config` (jsonb) */
  finalsConfig: unknown;
}

const INT4_MAX = 2147483647n;
const TIEBREAK_VALUES = new Set(['shootout', 'overtime-then-shootout', 'goldenGoal']);
/** E1 / @SL-145: ohne gültige Einstellung gilt „Verlängerung, dann Strafstoßschießen“ (Vorbelegung W2a). */
export const TIEBREAK_FALLBACK = 'overtime-then-shootout' as const;
const ROUND_KEYS = new Set(['roundOf16', 'quarterfinal', 'semifinal', 'final']);
const PLACEMENT_FINAL_TYPES = new Set(['thirdPlace', 'fifthSixth', 'seventhEighth']);
/** M1 (@W2A-012): Schützen je Team 1 bis 5, Vorgabe 3. Zwilling: `20261118_002` (`shootersPerTeam`). */
export const SHOOTERS_MIN = 1n;
export const SHOOTERS_MAX = 5n;
export const SHOOTERS_DEFAULT = 3n;
/** M1 (@W2A-016, @W2A-029): Zeitstrafe aus der Einstellung, 60 bis 600 s, Vorgabe 120. Zwilling: `20261118_002` (`penaltySeconds`). */
export const PENALTY_SECONDS_MIN = 60n;
export const PENALTY_SECONDS_MAX = 600n;
export const PENALTY_SECONDS_DEFAULT = 120n;

/** Exakter Dezimalwert `n / d` (d > 0). */
interface Decimal {
  n: bigint;
  d: bigint;
}

const NUMBER_TEXT = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;
/** `cfg_num`: `^\s*-?[0-9]+(\.[0-9]+)?\s*$` -- `\s` hier bewusst nur ASCII-Leerraum wie numeric_in. */
const CONFIG_TEXT = /^[ \t\n\r\f\v]*-?[0-9]+(\.[0-9]+)?[ \t\n\r\f\v]*$/;

function parseDecimal(text: string): Decimal | null {
  const match = NUMBER_TEXT.exec(text);
  if (!match) {
    return null;
  }
  const [, sign, intPart, fracPart = '', expPart = '0'] = match;
  const digits = BigInt(`${sign}${intPart}${fracPart}`);
  const scale = fracPart.length - Number(expPart);
  if (scale <= 0) {
    return { n: digits * 10n ** BigInt(-scale), d: 1n };
  }
  return { n: digits, d: 10n ** BigInt(scale) };
}

function decimalFromNumber(value: number | null): Decimal | null {
  return value === null || !Number.isFinite(value) ? null : parseDecimal(String(value));
}

/** `match_engine.cfg_num`: jsonb-Zahl oder Zahl als Text, sonst null. */
function cfgNum(value: unknown): Decimal | null {
  if (typeof value === 'number') {
    return decimalFromNumber(value);
  }
  if (typeof value === 'string' && CONFIG_TEXT.test(value)) {
    return parseDecimal(value.trim());
  }
  return null;
}

/** floor(n / d) für d > 0 (BigInt-Division schneidet Richtung 0 ab). */
function floorDiv(n: bigint, d: bigint): bigint {
  const quotient = n / d;
  return n % d !== 0n && n < 0n ? quotient - 1n : quotient;
}

function clamp(value: bigint, min: bigint, max: bigint): number {
  return Number(value < min ? min : value > max ? max : value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** jsonb `->` auf einem Objekt; bei Nicht-Objekten oder fehlendem Schlüssel `undefined` (SQL NULL). */
function field(value: unknown, key: string): unknown {
  return isJsonObject(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}

/** floor(wert * 60), geklemmt auf 0..INT4_MAX. */
function minutesToSeconds(value: Decimal): number {
  return clamp(floorDiv(value.n * 60n, value.d), 0n, INT4_MAX);
}

/** floor(wert), geklemmt auf min..max (M1: Schützen, Zeitstrafe). */
function bounded(value: Decimal, min: bigint, max: bigint): number {
  return clamp(floorDiv(value.n, value.d), min, max);
}

/** floor(wert), geklemmt auf 0..INT4_MAX. */
function wholeNumber(value: Decimal): number {
  return clamp(floorDiv(value.n, value.d), 0n, INT4_MAX);
}

/**
 * D1 (E1, Befund C-KO-RUNDENREGEL-SERVER): Entscheidungsart je Spiel. Platzierungsspiel ->
 * `tiebreakerByRound.placement` -> `.final`; sonst `tiebreakerByRound[<Runde aus phase>]`; danach die
 * alte globale Regel `tiebreaker` (nur Altdaten); erste GÜLTIGE Stufe gilt, sonst der Rückfall.
 */
function tiebreakFor(finals: Record<string, unknown> | null, phase: string | null, finalType: string | null): NonNullable<MatchRules['tiebreak']> {
  const byRound = field(finals, 'tiebreakerByRound');
  const keys = finalType !== null && PLACEMENT_FINAL_TYPES.has(finalType)
    ? ['placement', 'final']
    : phase !== null && ROUND_KEYS.has(phase) ? [phase] : [];
  const found = [...keys.map((key) => field(byRound, key)), field(finals, 'tiebreaker')]
    .find((candidate) => typeof candidate === 'string' && TIEBREAK_VALUES.has(candidate));
  return typeof found === 'string' ? (found as NonNullable<MatchRules['tiebreak']>) : TIEBREAK_FALLBACK;
}

export function serverRules(input: ServerRulesInput): MatchRules {
  const isGroup = (input.phase ?? 'groupStage') === 'groupStage';
  const settings = field(input.config, 'matchCockpitSettings');
  const finals = isJsonObject(input.finalsConfig) ? input.finalsConfig : null;

  const periods = cfgNum(field(input.config, 'gamePeriods')) ?? { n: 1n, d: 1n };
  const sections = clamp(floorDiv(periods.n, periods.d), 1n, 4n) as MatchRules['sections'];

  const tournamentMinutes = isGroup ? input.groupPhaseDuration : (input.finalRoundDuration ?? input.groupPhaseDuration);
  const rawTotal = decimalFromNumber(input.durationMinutes) ?? decimalFromNumber(tournamentMinutes) ?? { n: 0n, d: 1n };
  const total = rawTotal.n < 0n ? { n: 0n, d: 1n } : rawTotal;


  return {
    sections,
    sectionSeconds: clamp(floorDiv(total.n * 60n, total.d * BigInt(sections)), 0n, INT4_MAX),
    breakSeconds: minutesToSeconds(cfgNum(field(input.config, 'halftimeBreak')) ?? { n: 1n, d: 1n }),
    knockout: !isGroup,
    tiebreak: tiebreakFor(finals, input.phase, typeof input.finalType === 'string' ? input.finalType : null),
    overtimeSeconds: minutesToSeconds(cfgNum(field(finals, 'tiebreakerDuration')) ?? { n: 5n, d: 1n }),
    shootersPerTeam: bounded(cfgNum(field(settings, 'penaltyShootersPerTeam')) ?? { n: SHOOTERS_DEFAULT, d: 1n }, SHOOTERS_MIN, SHOOTERS_MAX),
    suddenDeathAfter: wholeNumber(cfgNum(field(settings, 'penaltySuddenDeathAfter')) ?? { n: 6n, d: 1n }),
    penaltySeconds: bounded(cfgNum(field(settings, 'timePenaltyDurationSeconds')) ?? { n: PENALTY_SECONDS_DEFAULT, d: 1n }, PENALTY_SECONDS_MIN, PENALTY_SECONDS_MAX),
  };
}
