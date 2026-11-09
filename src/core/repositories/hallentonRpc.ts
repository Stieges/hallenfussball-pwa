/**
 * Client der Hallenton-Funktionen (`supabase/migrations/20261121_001_hallenton.sql`, Torhymne
 * `20261123_001_hallenton_torhymne.sql`, Record `docs/anforderungen/2026-10-15_hallenton.md`). Muster `fieldControlRpc.ts`: nur `.rpc`, Zeitlimit
 * `withCloudReadTimeout`, jede `Json`-Antwort per zod genau nach der Antwortform der SQL-Funktion geprüft.
 *
 * Fehlerbild als Ergebnisart, nie ein Wurf:
 * - 42501 → `kein_recht` (auch „Turnier gibt es nicht“, der Server unterscheidet das bewusst nicht, @HT-044)
 * - 22023 → `ungueltig`
 * - 55000 → `turnier_beendet` (ändernde Wege und seit 20261123_001 das Lebenszeichen nach dem Turnierende, @HT-046)
 * - Zeitlimit, Netz, fehlender Client → `netz`
 * - Antwort passt nicht zum Vertrag oder unbekannter Server-Fehler → `antwort_unbekannt` (kein Ton nach geratener Antwort)
 *
 * Alle Zeitangaben (`serverNow`, `ageMs`, `requestedAt` …) sind Serverzeit in ms; die Uhr des Geräts zählt nie (@HT-042).
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { isTransientMutationError } from '../errors';
import { isCloudReadTimeout, withCloudReadTimeout } from './cloudAdoption';

type Client = SupabaseClient<Database> | null;
type Functions = Database['public']['Functions'];
type HallFunktion =
  | 'hall_speaker_assign' | 'hall_speaker_release' | 'hall_speaker_heartbeat' | 'hall_field_lead_heartbeat'
  | 'hall_test_tone_request' | 'hall_test_tone_ack' | 'hall_output_heard' | 'hall_sound_settings_set' | 'hall_sound_status'
  | 'hall_goal_anthems_set';
export type HallArgs<F extends HallFunktion> = Functions[F]['Args'];

export type HallFehlerGrund = 'kein_recht' | 'ungueltig' | 'turnier_beendet' | 'netz' | 'antwort_unbekannt';
export interface HallFehler { ok: false; grund: HallFehlerGrund }
export type HallErgebnis<T> = ({ ok: true } & T) | HallFehler;

/** Zustand eines Lautsprechers aus fester Liste (CHECK `hall_speakers_state_check`); `null` = noch kein Lebenszeichen. */
export const HALL_SPEAKER_STATES = ['ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero'] as const;
export type HallSpeakerState = (typeof HALL_SPEAKER_STATES)[number];
/**
 * Gelesener Zustand: ein Wert, den dieser App-Stand nicht kennt (der Server kann die Liste später erweitern, z. B. um
 * `output_lost`), wird `'zustandUnbekannt'`. Nur ein Lesewert – gesendet wird weiter nur `HallSpeakerState`, darum steht er nicht in
 * `HALL_SPEAKER_STATES`. `'zustandUnbekannt'` ist nicht bereit und kein „Status unbekannt“ der Verwaltung (@HT-039, @HT-041).
 */
export type HallSpeakerStateGelesen = HallSpeakerState | 'zustandUnbekannt';

function istBekannterZustand(roh: string): roh is HallSpeakerState {
  return (HALL_SPEAKER_STATES as readonly string[]).includes(roh);
}

export function lautsprecherZustandLesen(roh: string): HallSpeakerStateGelesen {
  return istBekannterZustand(roh) ? roh : 'zustandUnbekannt';
}

/** Nur ein Text wird lockerer gelesen; eine Zahl, ein Objekt o. Ä. macht die Antwort weiter unlesbar. */
const StateSchema = z.string().transform(lautsprecherZustandLesen);

const ms = z.number();
const FeldGeraetSchema = z.object({ field: z.number().int(), deviceName: z.string() });

const AssignSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('assigned'), fields: z.array(z.number().int()), replaced: z.array(FeldGeraetSchema) }),
  z.object({ status: z.literal('occupied'), fields: z.array(FeldGeraetSchema) }),
]);
const ReleaseSchema = z.object({ status: z.literal('released'), fields: z.array(z.number().int()) });

const HeartbeatSchema = z.object({
  status: z.literal('ok'),
  serverNow: ms,
  fields: z.array(z.object({
    field: z.number().int(),
    status: z.enum(['ok', 'superseded', 'unassigned']),
    test: z.object({ testId: z.string(), ageMs: ms }).nullable(),
    lead: z.object({ ageMs: ms }).nullable(),
  })),
});

const LeadHeartbeatSchema = z.object({
  status: z.enum(['ok', 'not_controller']),
  serverNow: ms,
  speaker: z.object({ state: StateSchema.nullable(), ageMs: ms.nullable(), outputHint: z.boolean() }).nullable(),
});

const TestRequestSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('requested'), testId: z.string(), requestedAt: ms, serverNow: ms }),
  z.object({ status: z.literal('too_soon'), serverNow: ms, retryInMs: ms }),
  z.object({ status: z.literal('no_speaker'), serverNow: ms }),
]);
const TestAckSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('acked'), playedAt: ms }),
  z.object({ status: z.literal('unknown_test') }),
  z.object({ status: z.literal('superseded') }),
]);
const HeardSchema = z.object({ status: z.enum(['heard', 'no_speaker']) });
const SettingsSetSchema = z.object({ status: z.literal('saved') });

const VollerLautsprecherSchema = z.object({
  field: z.number().int(),
  deviceName: z.string(),
  isThisDevice: z.boolean(),
  state: StateSchema.nullable(),
  assignedAt: ms,
  outputHint: z.boolean(),
  hintAt: ms.nullable(),
  lastSeen: ms.nullable(),
  ageMs: ms.nullable(),
  test: z.object({ testId: z.string(), requestedAt: ms, playedAt: ms.nullable() }).nullable(),
});
const VolleSichtSchema = z.object({
  serverNow: ms,
  closed: z.boolean(),
  speakers: z.array(VollerLautsprecherSchema),
  leads: z.array(z.object({ field: z.number().int(), ageMs: ms })),
  settings: z.object({
    halftimeSound: z.enum(['horn-1', 'horn-2', 'horn-3', 'custom']),
    halftimeCustomPath: z.string().nullable(),
    endCustomPath: z.string().nullable(),
    goalToneFields: z.array(z.number().int()),
    /** Torhymnen in ihrer Reihenfolge (@HT-024, seit 20261123_001); fehlt das Feld in einer alten Antwort, gilt `[]`. */
    goalAnthemPaths: z.array(z.string()).default([]),
  }),
});
const SchmaleSichtSchema = z.object({
  serverNow: ms,
  speakers: z.array(z.object({ field: z.number().int(), state: StateSchema.nullable(), ageMs: ms.nullable(), outputHint: z.boolean() })),
}).strict();

export type HallAssignAntwort = z.infer<typeof AssignSchema>;
export type HallReleaseAntwort = z.infer<typeof ReleaseSchema>;
export type HallHeartbeatAntwort = z.infer<typeof HeartbeatSchema>;
export type HallLeadHeartbeatAntwort = z.infer<typeof LeadHeartbeatSchema>;
export type HallTestRequestAntwort = z.infer<typeof TestRequestSchema>;
export type HallTestAckAntwort = z.infer<typeof TestAckSchema>;
export type HallHeardAntwort = z.infer<typeof HeardSchema>;
export type HallSettingsSetAntwort = z.infer<typeof SettingsSetSchema>;
/** Turnierleitung und Co-Admin (`manageScreens`). */
export type HallStatusVoll = { sicht: 'voll' } & z.infer<typeof VolleSichtSchema>;
/** Nur `writeMatchData` (Helfer im Cockpit, @HT-040/@HT-050): ohne Gerätename, Testton und Tonwahl. */
export type HallStatusSchmal = { sicht: 'schmal' } & z.infer<typeof SchmaleSichtSchema>;
export type HallStatusAntwort = HallStatusVoll | HallStatusSchmal;

const FEHLER_JE_CODE: Record<string, HallFehlerGrund> = { '42501': 'kein_recht', '22023': 'ungueltig', '55000': 'turnier_beendet' };

function fehler(grund: HallFehlerGrund): HallFehler {
  return { ok: false, grund };
}

function grundFuer(error: unknown): HallFehlerGrund {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && Object.hasOwn(FEHLER_JE_CODE, code)) {
    return FEHLER_JE_CODE[code] ?? 'antwort_unbekannt';
  }
  return isCloudReadTimeout(error) || isTransientMutationError(error) ? 'netz' : 'antwort_unbekannt';
}

async function rufe<F extends HallFunktion, T>(client: Client, fn: F, args: HallArgs<F>, pruefe: (data: unknown) => T | null): Promise<HallErgebnis<T>> {
  if (!client) {
    return fehler('netz');
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(client.rpc(fn, args)));
    if (response.error) {
      return fehler(grundFuer(response.error));
    }
    const geprueft = pruefe(response.data);
    return geprueft === null ? fehler('antwort_unbekannt') : { ok: true, ...geprueft };
  } catch (error) {
    return fehler(grundFuer(error));
  }
}

function mit<T>(schema: z.ZodType<T>): (data: unknown) => T | null {
  return (data) => {
    const parsed = schema.safeParse(data);
    return parsed.success ? parsed.data : null;
  };
}

/** „Dieses Gerät ist Hallen-Lautsprecher für Feld …“ (@HT-001); `p_replace` löst ein anderes Gerät ab (@HT-015). */
export function hallSpeakerAssign(client: Client, args: HallArgs<'hall_speaker_assign'>): Promise<HallErgebnis<HallAssignAntwort>> {
  return rufe(client, 'hall_speaker_assign', args, mit(AssignSchema));
}

/** Schalter aus auf diesem Gerät (@HT-038): nur die eigenen Felder entfallen. */
export function hallSpeakerRelease(client: Client, args: HallArgs<'hall_speaker_release'>): Promise<HallErgebnis<HallReleaseAntwort>> {
  return rufe(client, 'hall_speaker_release', args, mit(ReleaseSchema));
}

/** Lebenszeichen des Lautsprechers mit Zustand und Anzeichen `p_output_changed` (@HT-047); Antwort mit Testton und Leitung. */
export function hallSpeakerHeartbeat(client: Client, args: HallArgs<'hall_speaker_heartbeat'>): Promise<HallErgebnis<HallHeartbeatAntwort>> {
  return rufe(client, 'hall_speaker_heartbeat', args, mit(HeartbeatSchema));
}

/** Lebenszeichen des Geräts, das das Feld leitet (@HT-034/@HT-035); Antwort mit dem Stand des Lautsprechers (@HT-040). */
export function hallFieldLeadHeartbeat(client: Client, args: HallArgs<'hall_field_lead_heartbeat'>): Promise<HallErgebnis<HallLeadHeartbeatAntwort>> {
  return rufe(client, 'hall_field_lead_heartbeat', args, mit(LeadHeartbeatSchema));
}

/** „Testton in der Halle“ anfordern (@HT-017); höchstens einmal je 3 s und Feld. */
export function hallTestToneRequest(client: Client, args: HallArgs<'hall_test_tone_request'>): Promise<HallErgebnis<HallTestRequestAntwort>> {
  return rufe(client, 'hall_test_tone_request', args, mit(TestRequestSchema));
}

/** Quittung des Lautsprechers nach dem Abspielen des Testtons (@HT-017). */
export function hallTestToneAck(client: Client, args: HallArgs<'hall_test_tone_ack'>): Promise<HallErgebnis<HallTestAckAntwort>> {
  return rufe(client, 'hall_test_tone_ack', args, mit(TestAckSchema));
}

/** „✓ Gehört“ (@HT-049): nimmt den Hinweis „Prüfen“ für das Feld weg. */
export function hallOutputHeard(client: Client, args: HallArgs<'hall_output_heard'>): Promise<HallErgebnis<HallHeardAntwort>> {
  return rufe(client, 'hall_output_heard', args, mit(HeardSchema));
}

/** Eingabe der Tonwahl: die Pfade eigener Töne sind ohne eigenen Ton `null` (der erzeugte Typ kennt nur `string`). */
export type HallSoundSettingsArgs = Omit<HallArgs<'hall_sound_settings_set'>, 'p_halftime_custom_path' | 'p_end_custom_path'> & {
  p_halftime_custom_path: string | null;
  p_end_custom_path: string | null;
};

/** Tonwahl je Turnier (@HT-025, @HT-027). */
export function hallSoundSettingsSet(client: Client, args: HallSoundSettingsArgs): Promise<HallErgebnis<HallSettingsSetAntwort>> {
  // Der erzeugte Typ führt jedes Argument als Pflicht-Text; die Server-Funktion nimmt NULL für „kein eigener Ton“ an
  // (Muster `deviceOutboxReportRpc.ts`).
  return rufe(client, 'hall_sound_settings_set', args as unknown as HallArgs<'hall_sound_settings_set'>, mit(SettingsSetSchema));
}

/** Torhymnen des Turniers setzen (@HT-024): die ganze Liste in ihrer Reihenfolge, höchstens 5, `[]` leert sie. */
export function hallGoalAnthemsSet(client: Client, args: HallArgs<'hall_goal_anthems_set'>): Promise<HallErgebnis<HallSettingsSetAntwort>> {
  return rufe(client, 'hall_goal_anthems_set', args, mit(SettingsSetSchema));
}

/** Stand lesen: volle Sicht mit `manageScreens`, schmale Sicht mit nur `writeMatchData` (@HT-039, @HT-040, @HT-041). */
export function hallSoundStatus(client: Client, args: HallArgs<'hall_sound_status'>): Promise<HallErgebnis<HallStatusAntwort>> {
  return rufe(client, 'hall_sound_status', args, (data): HallStatusAntwort | null => {
    const voll = VolleSichtSchema.safeParse(data);
    if (voll.success) {
      return { sicht: 'voll', ...voll.data };
    }
    const schmal = SchmaleSichtSchema.safeParse(data);
    return schmal.success ? { sicht: 'schmal', ...schmal.data } : null;
  });
}
