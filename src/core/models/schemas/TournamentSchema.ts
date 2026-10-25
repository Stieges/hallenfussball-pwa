import { z } from 'zod';
import { TeamTrainerSchema, TournamentGroupSchema, TournamentFieldSchema, RuntimeMatchEventSchema } from './CommonSchemas';
import { RULEBOOK_MAX_LENGTH } from '../../../constants/rulebook';
import { MatchSlotSchema, SlotSourceSchema } from './MatchSlotSchema';
import { CLOCK_MODES, FINAL_PHASE_MINUTES_MAX, FINAL_PHASE_MINUTES_MIN } from '../../match/clockDisplay';
import { MatchKitSchema } from '../kit';
import { OPENING_MODES } from '../../../types/tournament';
import { parseStandingDecisions, StandingDecisionSchema } from './StandingDecisionSchema';
import { PlacementsToPlayOutSchema } from '../../standings/playOutPlaces';
import { FORFEIT_ABSENT_VALUES, ForfeitScoreSchema } from '../forfeit';

const TeamLogoSchema = z.object({
    type: z.enum(['url', 'base64', 'initials']),
    value: z.string(),
    backgroundColor: z.string().optional(),
    uploadedAt: z.string().optional(),
    uploadedBy: z.enum(['organizer', 'trainer']).optional(),
});

const TeamColorsSchema = z.object({
    primary: z.string(),
    secondary: z.string().optional(),
});

export const TeamSchema = z.object({
    id: z.string(),
    name: z.string(),
    group: z.string().optional(),
    isRemoved: z.boolean().optional(),
    removedAt: z.string().optional(),
    logo: TeamLogoSchema.optional(),
    colors: TeamColorsSchema.optional(),
    trainers: z.array(TeamTrainerSchema).optional(),
});

/** Eintrag der Korrekturhistorie eines Spiels (`CorrectionEntry`); `reasonType` bleibt Text wie `matchStatus` (alte Einträge). */
const CorrectionEntrySchema = z.looseObject({
    timestamp: z.string(),
    previousScoreA: z.number(),
    previousScoreB: z.number(),
    newScoreA: z.number(),
    newScoreB: z.number(),
    reasonType: z.string().optional(),
    reason: z.string().optional(),
    note: z.string().optional(),
    userName: z.string().optional(),
});

export const MatchSchema = z.object({
    id: z.string(),
    round: z.number(),
    field: z.number(),
    slot: z.number().optional(),
    // Spielseiten nur als Slot (@TM-015); das Übergangsfeld teamA/teamB ist seit A-36a gelöscht.
    slotA: MatchSlotSchema,
    slotB: MatchSlotSchema,
    // A-36a: Herkunft des Platzes (unveränderlich), nur Finalrunde.
    originA: SlotSourceSchema.optional(),
    originB: SlotSourceSchema.optional(),
    scoreA: z.number().min(0).optional(),
    scoreB: z.number().min(0).optional(),
    group: z.string().optional(),
    isFinal: z.boolean().optional(),
    // finalType kommt aus einer nullable DB-Spalte (final_type) – null wird wie "nicht gesetzt" behandelt (C-ZOD-DEC).
    finalType: z.string().nullable().optional().transform((v) => v ?? undefined),
    label: z.string().optional(),
    scheduledTime: z.preprocess(
      (arg) => {
        if (arg instanceof Date) {
          return arg;
        }
        if (typeof arg === 'string' && arg.length > 0) {
          return new Date(arg);
        }
        return arg;
      },
      z.date().optional()
    ),
    // B-26: ursprüngliche Uhrzeit (matches.original_start), wie scheduledTime als Date oder ISO-Text
    originalStart: z.preprocess(
      (arg) => (typeof arg === 'string' && arg.length > 0 ? new Date(arg) : arg),
      z.date().optional()
    ),
    // C-SCHEMA-VERWIRFT-FELDER: ohne diese drei Felder ging beim lokalen Laden die Spielnummer verloren
    // (aus „Spiel 11“ wurde „Spiel 1“) und ein Komplett-Speichern schrieb `match_number = NULL` in die Cloud.
    matchNumber: z.number().optional(),
    // auch A-25a (C-PHASE-LOKAL-VERLOREN): ohne phase galt ein K.-o.-Spiel lokal als Gruppenspiel.
    phase: z.string().optional(),
    correctionHistory: z.array(CorrectionEntrySchema).optional(),
    referee: z.number().optional(),
    matchStatus: z.string().optional(), // 'scheduled' | ...
    finishedAt: z.string().optional(),
    timerStartTime: z.string().optional(),
    timerPausedAt: z.string().optional(),
    timerElapsedSeconds: z.number().optional(),
    overtimeScoreA: z.number().min(0).optional(),
    overtimeScoreB: z.number().min(0).optional(),
    penaltyScoreA: z.number().min(0).optional(),
    penaltyScoreB: z.number().min(0).optional(),
    // decidedBy kommt aus einer nullable DB-Spalte (decided_by) – null wird wie "nicht gesetzt" behandelt (C-ZOD-DEC).
    decidedBy: z.string().nullable().optional().transform((v) => v ?? undefined),
    // A-25c: wer bei einer Wertung fehlte (nur gelesen); ein unbekannter Wert fällt weg, das Spiel bleibt gültig.
    forfeitAbsent: z.enum(FORFEIT_ABSENT_VALUES).optional().catch(undefined),
    skippedReason: z.string().optional(),
    skippedAt: z.string().optional(),
    liveState: z.unknown().optional(), // matches.live_state (Feinstatus für das Abzeichen, R-SA8); die Form prüft `badgeDetailFromLiveState`
    events: z.array(RuntimeMatchEventSchema).optional(),
    kit: MatchKitSchema.optional(), // A-30a: getragene Farben beim Anpfiff (@W3-028), übersteht das lokale Laden
});

// scheduledTime uses z.preprocess to handle both Date objects and ISO strings from JSON/localStorage

/** Spielregeln „Spiel leiten“ (@SL-002, @SL-024, @SL-101, @W2A-013, @W2A-017, @W2A-035, @W2A-037, @W2A-040). */
const MatchCockpitRulesSchema = z.looseObject({
    clockMode: z.enum(CLOCK_MODES).optional(),
    foulLimit: z.number().int().min(1).nullable().optional(),
    enabledCards: z.looseObject({
        yellow: z.boolean().optional(),
        yellowRed: z.boolean().optional(),
        red: z.boolean().optional(),
        timePenalty: z.boolean().optional(),
    }).optional(),
    penaltyEndsOnGoal: z.boolean().optional(),
    shortHandedSeconds: z.number().int().min(0).optional(),
    // @W2A-040: Länge der angehaltenen Schlussphase, ganzzahlig 1–5 Minuten.
    finalPhaseMinutes: z.number().int().min(FINAL_PHASE_MINUTES_MIN).max(FINAL_PHASE_MINUTES_MAX).optional(),
});

export const TournamentSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['draft', 'published', 'finished', 'archived', 'cancelled']).optional().default('draft'),

    // Data
    teams: z.array(TeamSchema),
    matches: z.array(MatchSchema),
    groups: z.array(TournamentGroupSchema).optional(),
    fields: z.array(TournamentFieldSchema).optional(),

    // Config
    sport: z.string(),
    sportId: z.string(),
    tournamentType: z.string(),
    mode: z.string(),
    rulebook: z.string().max(RULEBOOK_MAX_LENGTH).optional(),
    matchCockpitSettings: MatchCockpitRulesSchema.nullish(),

    // Stats/Meta
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().optional(),
    cancelledAt: z.string().optional(),
    cancelledReason: z.string().optional(),
    lastVisitedStep: z.number().optional(),

    // Multi-User / Cloud Sync
    ownerId: z.string().optional(),
    version: z.number().optional(),
    serverVersion: z.number().optional(), // C-VERSION-MEHRDEUTIG: zuletzt vom Server bestätigte Version (nur lokal)
    ownUploadsFrom: z.number().optional(), // C-ZWEITES-SPEICHERN-EIGENE-VORVERSION: Kette eigener Uploads (nur lokal)
    changeRevision: z.number().optional(), // A-10: tournaments.change_revision (nur Cloud)
    /** Freigabe-Marker (ISO). Siehe Tournament.publishedAt — bewusst nicht `status`. */
    publishedAt: z.string().optional(),
    isPublic: z.boolean().optional(),
    shareCode: z.string().optional(),
    shareCodeCreatedAt: z.string().optional(),

    // Mannschaften des Veranstalters und Eröffnung (@W4-034, @W4-033). Ungültige Werte machen das Turnier
    // nicht ungültig, sie werden verworfen (Bestandsdaten ohne die Felder bleiben gültig).
    hostTeamIds: z.array(z.string()).optional().catch(undefined),
    openingMode: z.enum(OPENING_MODES).optional().catch(undefined),
    // Paket TB: Gleichstands-Entscheidungen (strikt je Entscheidung). Je Eintrag gefiltert (Review TB-A Auflage 9): ein
    // fehlerhafter Eintrag fällt weg, die gültigen bleiben – sonst verlöre ein späteres Voll-Speichern alle Entscheidungen.
    standingDecisions: z.preprocess(parseStandingDecisions, z.array(StandingDecisionSchema).optional()),
    // Paket TB-B (TB-3'): Plätze, die bei Gleichstand ausgespielt werden müssen; fehlend/unbrauchbar → nur Platz 1.
    placementsToPlayOut: PlacementsToPlayOutSchema,
    // A-25c (@W2A-025): Wertung bei Nichtantritt; unbrauchbar → weg (dann gilt 2:0), das Turnier bleibt gültig.
    forfeitScore: ForfeitScoreSchema.optional().catch(undefined),
    // A-12a (@TM-004): gewählte Platzierungsspiele. Nur `placements` wird geprüft, die übrigen Felder bleiben unverändert;
    // ein unbrauchbarer Wert fällt weg (dann belegt die Vorlage vor), statt das Turnier beim Laden ungültig zu machen.
    finalsConfig: z.looseObject({
        placements: z.array(z.number().int().min(1).max(99)).optional().catch(undefined),
    }).nullish(),
})
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- passthrough needed to prevent data loss of unmapped fields
  .passthrough();
