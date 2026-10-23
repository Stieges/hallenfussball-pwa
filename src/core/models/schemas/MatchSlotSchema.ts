/**
 * Spielseite als Slot (A-01, MVP-Bauplan Spur A; Vorlage V-TEAM-Plan V2/M4).
 *
 * Eine Spielseite ist entweder ein Team (Team-ID) oder „noch offen“ mit strukturierter Herkunft
 * (Gruppenrang oder Ergebnis eines echten Vorgängerspiels). Namen stehen nie im Spiel.
 * Die Regeln entsprechen der DB-Prüfung `match_engine.slot_source_valid` (UUID klein, Gruppe 1–40 Zeichen,
 * Rang 1–99), damit ein lokal gültiger Slot in der Cloud nicht scheitert.
 *
 * Anforderung: @TM-015 („Ein unbesetzter Platz zeigt seine Herkunft“).
 */
import { z } from 'zod';

/** UUID in Kleinschreibung – kanonische Form von `crypto.randomUUID()` und Postgres `uuid`. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Team-ID (UUID). Gebrandet: ein `TeamId` entsteht nur über `TeamIdSchema.parse` – ein Teamname
 * („FC Nord“) ist keine Team-ID und scheitert hier.
 */
export const TeamIdSchema = z.string().regex(UUID_PATTERN, 'Team-ID muss eine UUID sein').brand<'TeamId'>();
export type TeamId = z.infer<typeof TeamIdSchema>;

const GroupRankSourceSchema = z.strictObject({
  kind: z.literal('groupRank'),
  /** `TournamentGroup.id` bzw. `Team.group`, z. B. `'A'`. */
  group: z.string().min(1).max(40),
  rank: z.number().int().min(1).max(99),
});

const MatchResultSourceSchema = z.strictObject({
  kind: z.literal('matchResult'),
  /** Echte Spiel-ID (UUID) des Vorgängerspiels – nie eine Definitions-ID wie `'semi1'`. */
  matchId: z.string().regex(UUID_PATTERN, 'Spiel-ID muss eine UUID sein'),
  role: z.enum(['winner', 'loser']),
});

/** Herkunft einer offenen Spielseite. */
export const SlotSourceSchema = z.discriminatedUnion('kind', [GroupRankSourceSchema, MatchResultSourceSchema]);
export type SlotSource = z.infer<typeof SlotSourceSchema>;

const TeamSlotSchema = z.strictObject({
  kind: z.literal('team'),
  teamId: TeamIdSchema,
  /** Herkunft, aus der das Team aufgelöst wurde (bleibt nach der Auflösung erhalten). */
  resolvedFrom: SlotSourceSchema.optional(),
  /**
   * A-36b (M6/F1): wie die Leitung die Seite von Hand besetzt hat – „Neu besetzen“ (`reassigned`),
   * „Weiterkommen festlegen“ (`decided`) oder Ersatzteam @W5-010 (`replaced`). Rein lokal-fachlich (nicht in der
   * Cloud, der Delta-Sync prüft weiter nur `resolvedFrom`, K6). Die Ansicht zeigt die Herkunft klein unter dem Team
   * nur bei `decided`/`replaced` bzw. automatisch besetzt; fehlt das Merkmal, gilt `reassigned`.
   */
  assignedBy: z.enum(['reassigned', 'decided', 'replaced']).optional(),
});

const PendingSlotSchema = z.strictObject({
  kind: z.literal('pending'),
  source: SlotSourceSchema,
});

/** Spielseite: Team oder offen mit Herkunft. */
export const MatchSlotSchema = z.discriminatedUnion('kind', [TeamSlotSchema, PendingSlotSchema]);
export type MatchSlot = z.infer<typeof MatchSlotSchema>;
export type TeamSlot = z.infer<typeof TeamSlotSchema>;
export type PendingSlot = z.infer<typeof PendingSlotSchema>;
export type SlotAssignment = NonNullable<TeamSlot['assignedBy']>;
