/**
 * A1b Monitore der Veranstaltung (Record `docs/anforderungen/2026-11-06_veranstaltung-mehrere-turniere.md`, Funktionalität G):
 * Lese-Seite der Server-Funktionen aus `supabase/migrations/20261122_001_gathering_screens.sql` – nur Prüfen und Übersetzen
 * der Antworten, kein Aufruf und nie ein Schreibweg (Bildschirme, Ort und das Turnier in der Halle schreibt nur der Server
 * über seine Funktionen; die App ruft sie in A7 über `.rpc`).
 *
 * Verträge:
 *   gathering_screen_display(key, since) -> {state:'invalid'} | {state:'unchanged', version, server_now} |
 *     {state:'gathering', version, server_now, gathering, screen, sponsors, tournaments} |
 *     {state:'tournament', version, server_now, on_screen, [gathering, screen, sponsors,] payload}
 *     (`payload` = Antwort von public_payload in der Monitor-Fassung ohne eigene version/server_now).
 *   gathering_screen_status(tournament_id) -> {in_gathering, has_screens, eligible, reason, on_screen_self, on_screen,
 *     handed_over_monitor_ids}
 *   public_gathering(code).on_screen -> {share_code, title, live_matches:[{match_number, field, status, score_a?, score_b?}]}
 * Unbekannte Felder fallen beim Prüfen weg; eine Antwort außerhalb des Vertrags wirft (der Aufrufer macht daraus
 * `UnreadableResponseError`, @ME-032). Rein, ohne React.
 *
 * Szenarien: @VA-034 bis @VA-047, @ZM-180 (monotone `version` über einen Wechsel des Turniers hinweg).
 */
import { z } from 'zod';
import { parsePublicPayload, type PublicReply } from './publicPayload';

const VersionSchema = z.number().int().nonnegative();
const optionalNullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

/** Gründe, aus denen ein Turnier nicht auf die Bildschirme der Veranstaltung darf (`gathering_screen_reason`). */
export const SCREEN_REASONS = [
  'not_found',
  'not_in_gathering',
  'trashed',
  'cancelled',
  'draft',
  'no_screens',
  'no_location',
  'other_location',
] as const;
export type ScreenReason = (typeof SCREEN_REASONS)[number];

const SlideSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
  duration: optionalNullable(z.number()),
  order: optionalNullable(z.number()),
});

/** Folien-Konfiguration des Bildschirms (Positivliste des Servers, Form wie `TournamentMonitor` ohne Zeitstempel). */
const ScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultSlideDuration: z.number().optional(),
  transition: z.string().optional(),
  transitionDuration: z.number().optional(),
  theme: z.string().optional(),
  performanceMode: z.string().optional(),
  overscanPercent: z.number().optional(),
  slides: z.array(SlideSchema),
});
export type GatheringScreenConfig = z.infer<typeof ScreenSchema>;

const SponsorSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  logoUrl: z.string().optional(),
  logoBase64: z.string().optional(),
  websiteUrl: z.string().optional(),
  tier: z.string().optional(),
});
export type GatheringScreenSponsor = z.infer<typeof SponsorSchema>;

const GatheringHeadSchema = z.object({ name: z.string(), share_code: z.string() });

const TournamentStateSchema = z.enum(['planned', 'live', 'finished', 'cancelled']);
const IdleTournamentSchema = z.object({
  title: z.string(),
  date: z.string(),
  begin: z.string().optional(),
  state: TournamentStateSchema,
  last_match_started: z.boolean(),
});

const OnScreenRefSchema = z.object({ tournament_id: z.string(), since: optionalNullable(z.string()) });

const DisplaySchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('invalid') }),
  z.object({ state: z.literal('unchanged'), version: VersionSchema, server_now: z.number() }),
  z.object({
    state: z.literal('gathering'),
    version: VersionSchema,
    server_now: z.number(),
    gathering: GatheringHeadSchema,
    screen: ScreenSchema,
    sponsors: z.array(SponsorSchema),
    tournaments: z.array(IdleTournamentSchema),
  }),
  z.object({
    state: z.literal('tournament'),
    version: VersionSchema,
    server_now: z.number(),
    on_screen: OnScreenRefSchema,
    gathering: GatheringHeadSchema.optional(),
    screen: ScreenSchema.optional(),
    sponsors: z.array(SponsorSchema).optional(),
    payload: z.record(z.string(), z.unknown()),
  }),
]);

export type IdleTournament = {
  title: string;
  date: string;
  begin: string | null;
  state: z.infer<typeof TournamentStateSchema>;
  lastMatchStarted: boolean;
};

/** Folien und Sponsoren kommen nur mit einer vollen Antwort (Wechsel, geänderte Folien, erster Abruf). */
export type ScreenSetup = { gatheringName: string; gatheringCode: string; screen: GatheringScreenConfig; sponsors: GatheringScreenSponsor[] };

export type GatheringScreenReply =
  | { kind: 'invalid' }
  | { kind: 'unchanged'; version: number; serverNowMs: number }
  | { kind: 'gathering'; version: number; serverNowMs: number; setup: ScreenSetup; tournaments: IdleTournament[] }
  | {
    kind: 'tournament';
    version: number;
    serverNowMs: number;
    tournamentId: string;
    onScreenSince: string | null;
    setup: ScreenSetup | null;
    /** Antwort des Turniers in der Halle; ihre `version` ist die des Bildschirms (monoton über Wechsel, @ZM-180). */
    payload: Exclude<PublicReply, { kind: 'not-found' }>;
  };

function setupOf(
  gathering: z.infer<typeof GatheringHeadSchema> | undefined,
  screen: GatheringScreenConfig | undefined,
  sponsors: GatheringScreenSponsor[] | undefined,
): ScreenSetup | null {
  if (gathering === undefined || screen === undefined || sponsors === undefined) {
    return null;
  }
  return { gatheringName: gathering.name, gatheringCode: gathering.share_code, screen, sponsors };
}

/** Antwort von `gathering_screen_display` prüfen und übersetzen; wirft bei einer Antwort außerhalb des Vertrags. */
export function parseGatheringScreenDisplay(raw: unknown): GatheringScreenReply {
  const reply = DisplaySchema.parse(raw);
  switch (reply.state) {
    case 'invalid':
      return { kind: 'invalid' };
    case 'unchanged':
      return { kind: 'unchanged', version: reply.version, serverNowMs: reply.server_now };
    case 'gathering':
      return {
        kind: 'gathering',
        version: reply.version,
        serverNowMs: reply.server_now,
        setup: { gatheringName: reply.gathering.name, gatheringCode: reply.gathering.share_code, screen: reply.screen, sponsors: reply.sponsors },
        tournaments: reply.tournaments.map((t) => ({
          title: t.title,
          date: t.date,
          begin: t.begin ?? null,
          state: t.state,
          lastMatchStarted: t.last_match_started,
        })),
      };
    case 'tournament': {
      const payload = parsePublicPayload({ ...reply.payload, version: reply.version, server_now: reply.server_now });
      if (payload.kind === 'not-found') {
        throw new Error('gathering_screen_display: Turnier in der Halle ohne Antwort');
      }
      const setup = setupOf(reply.gathering, reply.screen, reply.sponsors);
      if (payload.kind === 'full' && setup === null) {
        throw new Error('gathering_screen_display: volle Antwort ohne Folien des Bildschirms');
      }
      return {
        kind: 'tournament',
        version: reply.version,
        serverNowMs: reply.server_now,
        tournamentId: reply.on_screen.tournament_id,
        onScreenSince: reply.on_screen.since ?? null,
        setup,
        payload,
      };
    }
  }
}

/** Turnier in der Halle aus Sicht des Aufrufers: mit Titel nur, wer dort selbst umschalten darf. */
const CallerOnScreenSchema = z.union([
  z.object({ tournament_id: z.string(), title: z.string(), since: optionalNullable(z.string()) }),
  z.object({ other: z.literal(true), since: optionalNullable(z.string()) }),
]);
export type CallerOnScreen =
  | { kind: 'known'; tournamentId: string; title: string; since: string | null }
  | { kind: 'other'; since: string | null };

function callerOnScreen(raw: z.infer<typeof CallerOnScreenSchema> | null | undefined): CallerOnScreen | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if ('other' in raw) {
    return { kind: 'other', since: raw.since ?? null };
  }
  return { kind: 'known', tournamentId: raw.tournament_id, title: raw.title, since: raw.since ?? null };
}

const StatusSchema = z.object({
  in_gathering: z.boolean(),
  has_screens: z.boolean(),
  eligible: z.boolean(),
  reason: z.enum(SCREEN_REASONS).nullable(),
  on_screen_self: z.boolean(),
  on_screen: CallerOnScreenSchema.nullable(),
  handed_over_monitor_ids: z.array(z.string()),
});

export type GatheringScreenStatus = {
  inGathering: boolean;
  hasScreens: boolean;
  eligible: boolean;
  reason: ScreenReason | null;
  onScreenSelf: boolean;
  onScreen: CallerOnScreen | null;
  handedOverMonitorIds: string[];
};

/** Antwort von `gathering_screen_status` (Cockpit-Rückfrage @VA-039, Taste „Auf die Bildschirme“ @VA-037/@VA-041). */
export function parseGatheringScreenStatus(raw: unknown): GatheringScreenStatus {
  const s = StatusSchema.parse(raw);
  return {
    inGathering: s.in_gathering,
    hasScreens: s.has_screens,
    eligible: s.eligible,
    reason: s.reason,
    onScreenSelf: s.on_screen_self,
    onScreen: callerOnScreen(s.on_screen),
    handedOverMonitorIds: s.handed_over_monitor_ids,
  };
}

const SetOnScreenSchema = z.object({ on_screen: CallerOnScreenSchema.nullable() });

/** Antwort von `set_gathering_on_screen`: der Stand danach (beide Geräte zeigen dasselbe, @VA-038). */
export function parseSetGatheringOnScreen(raw: unknown): CallerOnScreen | null {
  return callerOnScreen(SetOnScreenSchema.parse(raw).on_screen);
}

const LiveMatchSchema = z.object({
  match_number: optionalNullable(z.number()),
  field: z.number(),
  status: z.enum(['running', 'paused']),
  score_a: z.number().optional(),
  score_b: z.number().optional(),
});
const PublicOnScreenSchema = z.object({
  share_code: z.string(),
  title: z.string(),
  live_matches: z.array(LiveMatchSchema),
});

export type PublicLiveMatch = { matchNumber: number | null; field: number; status: 'running' | 'paused'; score: { a: number; b: number } | null };
export type PublicOnScreen = { shareCode: string; title: string; liveMatches: PublicLiveMatch[] };

/**
 * `on_screen` aus der Antwort von `public_gathering` (@VA-045 bis @VA-047). Fehlt der Schlüssel, steht nichts (Öffentliches)
 * in der Halle -> `null`, dann gilt der Hinweis nach Uhrzeit (@VA-007). Ohne Stand (Kindermodus, Live-Stand aus) ist
 * `score` `null`.
 */
export function parsePublicGatheringOnScreen(raw: unknown): PublicOnScreen | null {
  const container = z.object({ on_screen: PublicOnScreenSchema.optional() }).parse(raw);
  if (container.on_screen === undefined) {
    return null;
  }
  return {
    shareCode: container.on_screen.share_code,
    title: container.on_screen.title,
    liveMatches: container.on_screen.live_matches.map((m) => ({
      matchNumber: m.match_number ?? null,
      field: m.field,
      status: m.status,
      score: m.score_a !== undefined && m.score_b !== undefined ? { a: m.score_a, b: m.score_b } : null,
    })),
  };
}
