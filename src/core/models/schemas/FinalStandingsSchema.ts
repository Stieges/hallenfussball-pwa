/**
 * Zod-Schema des gespeicherten Endstands (A-20a, Plan `plan-endstand-abschluss.md` § 3), strikt: unbekannte Felder werden
 * abgelehnt. Typen in `core/standings/finalStandings/types.ts`; beide müssen gleich bleiben (Prüfung unten, zur Übersetzungszeit).
 *
 * Gleichlauf: `core/standings/__fixtures__/final-standings-shapes.json` (gültig/ungültig mit Grund); dieselbe Datei prüft am
 * Server `match_engine.final_standings_shape_valid` (A-21a-S). Grenzen wie dort: Längen in Zeichen wie `char_length`.
 * Die Form verlangt jedes Team höchstens einmal (@ET-031); ob jedes Team ohne `is_removed` genau einmal vorkommt und ob die
 * Platzziffern stimmen, prüft der Abschluss gegen das Turnier (`placeNumbersValid`, R-EA-4).
 * Anforderungen: @ET-031 (Form), @ET-045 (Format mit App-Version).
 */
import { z } from 'zod';
import { TeamIdSchema } from './MatchSlotSchema';
import type { FinalStandingRow, FinalStandingsSnapshot, PlaceOrigin, ScorerRow } from '../../standings/finalStandings/types';

/** Länge in Zeichen wie Postgres `char_length` (Unicode-Zeichen, nicht UTF-16-Einheiten). */
const charLength = (value: string): number => [...value].length;

const textOfLength = (min: number, max: number) =>
  z.string().refine((value) => {
    const length = charLength(value);
    return length >= min && length <= max;
  }, `Text muss ${min}–${max} Zeichen lang sein`);

/** Platz, Rang, Rückennummer, Tore: ganze Zahlen in festen Grenzen (wie am Server). */
const place = z.number().int().min(1).max(999);
const goals = z.number().int().min(1).max(9999);
const teamName = textOfLength(1, 200);

const FinalTypeSchema = z.enum(['final', 'thirdPlace', 'fifthSixth', 'seventhEighth']);

export const PlaceOriginSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('placementGame'), finalType: FinalTypeSchema, role: z.enum(['winner', 'loser']) }),
  z.strictObject({ kind: z.literal('koRound'), round: z.enum(['semi', 'quarter', 'r16']) }),
  z.strictObject({ kind: z.literal('groupPlace'), group: textOfLength(0, 40), place }),
  z.strictObject({ kind: z.literal('open'), finalType: FinalTypeSchema.optional() }),
]);

const PerGameSchema = z.strictObject({
  points: z.number().min(0),
  goalDiff: z.number(),
  goals: z.number().min(0),
  games: z.number().int().min(1),
});

/** Summen aus der Gruppentabelle: Ganzzahlen, außer der Tordifferenz alle ab 0; Tordifferenz = Tore − Gegentore. */
const count = z.number().int().min(0);
const TableValuesSchema = z.strictObject({
  games: count,
  goalsFor: count,
  goalsAgainst: count,
  goalDiff: z.number().int(),
  points: count,
}).refine((values) => values.goalDiff === values.goalsFor - values.goalsAgainst, {
  message: 'Tordifferenz = Tore minus Gegentore',
  path: ['goalDiff'],
});

export const FinalStandingRowSchema = z.strictObject({
  place,
  teamId: TeamIdSchema,
  teamName,
  origin: PlaceOriginSchema,
  perGame: PerGameSchema.optional(),
  tableValues: TableValuesSchema.optional(),
});

export const ScorerRowSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('player'), rank: place, teamId: TeamIdSchema, teamName, number: z.number().int().min(0).max(999), goals,
  }),
  z.strictObject({ kind: z.enum(['noNumber', 'ownGoals']), rank: z.null(), teamId: TeamIdSchema, teamName, goals }),
]);

export const FinalStandingsSnapshotSchema = z.strictObject({
  format: z.literal(1),
  ranking: z.array(FinalStandingRowSchema).min(1),
  scorers: z.array(ScorerRowSchema),
  appVersion: textOfLength(1, 50),
  computedAt: z.iso.datetime({ offset: true }),
}).refine((snapshot) => new Set(snapshot.ranking.map((row) => row.teamId)).size === snapshot.ranking.length, {
  message: 'Jedes Team steht höchstens einmal im Endstand',
  path: ['ranking'],
});

/** Gespeicherter Endstand aus beliebigem JSON; ungültig → `undefined` (nie halb übernommen). */
export function parseFinalStandingsSnapshot(raw: unknown): FinalStandingsSnapshot | undefined {
  const parsed = FinalStandingsSnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

// Schema und Typen bleiben gleich: beide Richtungen müssen zuweisbar sein (Fehler zur Übersetzungszeit).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type FinalStandingsShapesInSync = [
  Assert<Same<z.infer<typeof PlaceOriginSchema>, PlaceOrigin>>,
  Assert<Same<z.infer<typeof FinalStandingRowSchema>, FinalStandingRow>>,
  Assert<Same<z.infer<typeof ScorerRowSchema>, ScorerRow>>,
  Assert<Same<z.infer<typeof FinalStandingsSnapshotSchema>, FinalStandingsSnapshot>>,
];
