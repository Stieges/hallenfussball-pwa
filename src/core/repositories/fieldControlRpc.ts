/**
 * Client der Steuer je Feld (B-49) für die Server-Funktionen aus `20261110_003_field_control.sql` (A-34):
 * - `field_control_state(p_tournament_id, p_device_id)`: Stand aller Felder aus Sicht DIESES Geräts (`isMine`), @HE-049.
 * - `take_field_control(...)`: „Spielleitung übernehmen“, nur mit Netz und bekannter Epoche (@FU-027, @FU-028).
 * Muster `eventAuthorNamesRpc.ts`: nur `.rpc`, Antwort per zod geprüft.
 *
 * Die Geräte-ID ist Pflicht (`getDeviceId()`): ohne sie meldet der Server nie `isMine`, das steuernde Gerät sähe sich selbst
 * als fremden Halter (Hinweis an Variante A, `readForeignFieldHolder`).
 *
 * Fehlerpolitik: Lesen → `null` bei fehlendem Client, Netz, Zeitlimit, Recht oder unerwarteter Antwort (der letzte bekannte
 * Stand bleibt beim Aufrufer). Übernehmen → Ergebnisart, nie ein Wurf: Netz/Zeitlimit = `offline` („Übernehmen geht nur mit
 * Netz“), veraltete Epoche = `changed`, fehlendes Recht = `forbidden`, abgeschlossenes Turnier = `tournamentFinished` (R3-2a).
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { isTournamentFinishedRejection, isTransientMutationError } from '../errors';
import { isCloudReadTimeout, withCloudReadTimeout } from './cloudAdoption';

/** Stand eines Feldes aus Sicht eines Geräts (`public.field_control_info`). */
export const FieldControlInfoSchema = z.object({
  field: z.number().int(),
  epoch: z.number().int(),
  holderName: z.string().nullable(),
  holderRole: z.string().nullable(),
  holderDeviceLabel: z.string().nullable(),
  isMine: z.boolean(),
  claimedAt: z.number().nullable(),
});
export type FieldControlInfo = z.infer<typeof FieldControlInfoSchema>;

const FieldControlListSchema = z.array(FieldControlInfoSchema);

const TakeResponseSchema = z.object({
  status: z.enum(['taken', 'unchanged', 'rejected']),
  code: z.string().optional(),
  control: FieldControlInfoSchema.optional(),
  previous: FieldControlInfoSchema.nullable().optional(),
  serverTime: z.number(),
});

type Client = SupabaseClient<Database> | null;

/** Stand aller Felder des Turniers aus Sicht dieses Geräts; `null`, wenn er gerade nicht lesbar ist. */
export async function readFieldControlState(client: Client, tournamentId: string, deviceId: string): Promise<FieldControlInfo[] | null> {
  if (!client) {
    return null;
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(client.rpc('field_control_state', {
      p_tournament_id: tournamentId,
      p_device_id: deviceId,
    })));
    if (response.error) {
      return null;
    }
    const parsed = FieldControlListSchema.safeParse(response.data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface TakeFieldControlArgs {
  tournamentId: string;
  field: number;
  deviceId: string;
  /** Sprachneutraler Schlüssel (`phone` | `tablet` | `computer`, `deviceLabel`), höchstens 40 Zeichen. */
  deviceLabel: string | null;
  /** Epoche, die das Gerät zuletzt gesehen hat (freies, nie gesteuertes Feld = 0). */
  expectedEpoch: number;
}

export type TakeFieldControlResult =
  | { kind: 'taken'; control: FieldControlInfo; previous: FieldControlInfo | null }
  | { kind: 'unchanged'; control: FieldControlInfo }
  | { kind: 'changed'; control: FieldControlInfo | null }
  | { kind: 'forbidden' }
  /** R3-2a (Plan H-9): Turnier abgeschlossen (55000 TOURNAMENT_FINISHED) – nicht wiederholen. */
  | { kind: 'tournamentFinished' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

/** „Spielleitung übernehmen“ (`take_field_control`); wirft nie. */
export async function takeFieldControl(client: Client, args: TakeFieldControlArgs): Promise<TakeFieldControlResult> {
  if (!client) {
    return { kind: 'offline' };
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(client.rpc('take_field_control', {
      p_tournament_id: args.tournamentId,
      p_field: args.field,
      p_device_id: args.deviceId,
      p_expected_epoch: args.expectedEpoch,
      ...(args.deviceLabel !== null ? { p_device_label: args.deviceLabel } : {}),
    })));
    if (response.error) {
      if (isTournamentFinishedRejection(response.error)) {
        return { kind: 'tournamentFinished' };
      }
      return isTransientMutationError(response.error) ? { kind: 'offline' } : { kind: 'error', message: response.error.message };
    }
    const parsed = TakeResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      return { kind: 'error', message: 'Unerwartete Antwort von take_field_control' };
    }
    const { status, code, control, previous } = parsed.data;
    if (status === 'taken' && control) {
      return { kind: 'taken', control, previous: previous ?? null };
    }
    if (status === 'unchanged' && control) {
      return { kind: 'unchanged', control };
    }
    if (code === 'CONTROL_CHANGED') {
      return { kind: 'changed', control: control ?? null };
    }
    if (code === 'FORBIDDEN_ACTOR') {
      return { kind: 'forbidden' };
    }
    return { kind: 'error', message: code ?? status };
  } catch (error) {
    return isCloudReadTimeout(error) || isTransientMutationError(error) ? { kind: 'offline' } : { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
