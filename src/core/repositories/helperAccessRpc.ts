/**
 * A-16 (Plan GA5 v2.1 § 3.1/§ 3.2, Sicherheits-Review S-1–S-4): Client der Helfer-Beitritts-Funktionen aus
 * `supabase/migrations/20261110_008_helper_join.sql` und der Zugangs-Index `helper:access:v1` auf dem Gerät.
 * Muster `resetMatchResultsRpc.ts`: ruft nur `.rpc`, nie `.from`; jede Antwort per zod geprüft. Typen von Hand, bis der
 * Typen-PR nach dem DB-Fenster `src/types/supabase.ts` erneuert.
 *
 * Fehlerpolitik: Die Aufrufe werfen nicht, sie liefern `{ ok: false, error }` – Netz (kein Code, Transportfehler),
 * `noSession` (42501 `NOT_SIGNED_IN`: Helfer-Gerät ohne Sitzung), `notAuthorized` (sonst 42501), `invalidInput` (22023
 * mit festem Grund) oder `unexpected` (z. B. Funktion fehlt vor dem
 * Einspielen, PGRST202/42883, oder eine Antwort außerhalb des Schemas). Die Zuordnung zur Anzeige (§ 3.2) macht
 * `helperAccessView`; Texte und i18n-Schlüssel legen A-17b/A-18a fest.
 *
 * Szenarien: @HE-001 @HE-004 @HE-006 @HE-007 @HE-008 @HE-009 @HE-011 @HE-015 @HE-021 @HE-033 @HE-037 @HE-038 @HE-052
 * @HE-055 @HE-062 @HE-076 @HE-081 @HE-089 @HE-091 @HE-095 @HE-098 @HE-103 @HE-105 @HE-106 @LZ-044 @OB-053.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

// --- Zugangs-Index auf dem Gerät (A-17a schreibt ihn über safeLocalStorage) ------------------------------------------

export const HELPER_ACCESS_STORAGE_KEY = 'helper:access:v1';

const RelationSchema = z.enum(['none', 'leader', 'pending', 'declined', 'expired', 'accepted', 'viewer', 'revoked']);
export type HelperRelation = z.infer<typeof RelationSchema>;

const HelperAccessEntrySchema = z.object({
  tournamentId: z.string(),
  title: z.string(),
  date: z.string(),
  code: z.string(),
  field: z.number().int().nullable(),
  relation: z.enum(['pending', 'accepted', 'viewer', 'revoked', 'declined', 'expired']),
  closed: z.boolean(),
  checkNumber: z.number().int().nullable(),
  homeHintDismissed: z.boolean(),
  offlineReadyAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type HelperAccessEntry = z.infer<typeof HelperAccessEntrySchema>;

const HelperAccessIndexSchema = z.object({
  version: z.literal(1),
  deviceUserId: z.string(),
  entries: z.array(HelperAccessEntrySchema),
});
export type HelperAccessIndexV1 = z.infer<typeof HelperAccessIndexSchema>;

/**
 * Liest den gespeicherten Index. `null` heißt „verwerfen und online neu aufbauen“: fremde Version, kaputter Inhalt oder
 * ein Index einer anderen Gerätesitzung (`deviceUserId` passt nicht mehr zur Sitzung, z. B. nach Abmelden/Konto).
 */
export function parseHelperAccessIndex(raw: unknown, sessionUserId: string | null): HelperAccessIndexV1 | null {
  const parsed = HelperAccessIndexSchema.safeParse(raw);
  if (!parsed.success || sessionUserId === null || parsed.data.deviceUserId !== sessionUserId) {
    return null;
  }
  return parsed.data;
}

// --- Server-Antworten ---------------------------------------------------------------------------------------------

const CodeStateSchema = z.enum(['invalid', 'open', 'rotated', 'expired', 'closed']);

/** `join_code_info`: ohne Beziehung bei nicht offenem Code nur `{ state }` – kein Turniername (@HE-004, @HE-076, @HE-103). */
const JoinCodeInfoSchema = z.object({
  state: CodeStateSchema,
  relation: RelationSchema.optional(),
  tournament: z.object({ id: z.string(), title: z.string(), date: z.string() }).optional(),
  shareCode: z.string().nullable().optional(),
  field: z.number().int().nullable().optional(),
  checkNumber: z.number().int().nullable().optional(),
});
export type JoinCodeInfo = z.infer<typeof JoinCodeInfoSchema>;

const RequestResultSchema = JoinCodeInfoSchema.partial({ state: true }).extend({
  result: z.enum(['ACCOUNT_SESSION', 'INVALID', 'ROTATED', 'EXPIRED', 'CLOSED', 'BUSY', 'EXISTING', 'PENDING']),
});
export type RequestHelperAccessResult = z.infer<typeof RequestResultSchema>;

/** `helper_access_status`: `{ relation: 'none' }` oder Code-Info mit `closed` (Turnier abgeschlossen, @HE-098 Z.2). */
const AccessStatusSchema = JoinCodeInfoSchema.partial({ state: true }).extend({ closed: z.boolean().optional() });
export type HelperAccessStatus = z.infer<typeof AccessStatusSchema>;

const CodeResultSchema = z.discriminatedUnion('result', [
  z.object({
    result: z.literal('OK'),
    code: z.string(),
    validUntil: z.string(),
    openRequests: z.number().int(),
    declined: z.number().int().optional(),
  }),
  z.object({ result: z.literal('CLOSED'), declined: z.number().int().optional() }),
]);
export type HelperCodeResult = z.infer<typeof CodeResultSchema>;

const HelperAccessListSchema = z.object({
  requests: z.array(z.object({
    id: z.string(),
    name: z.string(),
    deviceLabel: z.string().nullable(),
    checkNumber: z.number().int(),
    createdAt: z.string(),
    /** S-2/@HE-106: offene Anfragen (inkl. dieser) + Zugänge + per Tipp abgelehnte Anfragen gleichen Namens. */
    sameName: z.number().int(),
    /** @HE-021: nur die offenen Anfragen gleichen Namens (inkl. dieser) – „2 Anfragen mit dem Namen Tom“. */
    sameNamePending: z.number().int(),
    /** @HE-106 Z.1: jüngster bestehender Zugang gleichen Namens – „Tom ist schon zugelassen (Handy …)“. */
    sameNameMember: z.object({ deviceLabel: z.string().nullable(), acceptedAt: z.string().nullable() }).nullable(),
    /** @HE-106 Z.2: Zeitpunkt der letzten Ablehnung per Tipp gleichen Namens – „Name um 12:03 abgelehnt“. */
    sameNameDeclinedAt: z.string().nullable(),
  })),
  members: z.array(z.object({
    memberId: z.string(),
    name: z.string().nullable(),
    deviceLabel: z.string().nullable(),
    field: z.number().int().nullable(),
    mode: z.string(),
    revokedAt: z.string().nullable(),
    acceptedAt: z.string().nullable(),
    lastSeenAt: z.string().nullable(),
    controls: z.array(z.number().int()),
  })),
});
export type HelperAccessList = z.infer<typeof HelperAccessListSchema>;

const DecideResultSchema = z.discriminatedUnion('result', [
  z.object({ result: z.literal('OK'), memberId: z.string().nullable() }),
  z.object({ result: z.literal('ALREADY_DECIDED'), status: z.string(), decidedBy: z.string().nullable() }),
  z.object({ result: z.literal('EXPIRED') }),
  /** S-1/@HE-105: Zulassen nur mit der Prüfzahl des Handys; bei falscher Zahl ändert der Server nichts. */
  z.object({ result: z.literal('CHECK_MISMATCH') }),
]);
export type DecideJoinRequestResult = z.infer<typeof DecideResultSchema>;

const OkResultSchema = z.object({ result: z.literal('OK') });
const AuthorDevicesSchema = z.array(z.object({ event_id: z.string(), device_label: z.string().nullable() }));

// --- Aufrufe -------------------------------------------------------------------------------------------------------

export type HelperRpcError =
  | { kind: 'network' }
  /** 42501 `NOT_SIGNED_IN` aus `request_helper_access`: das Helfer-Gerät hat keine Sitzung (Review A-16 L-3). */
  | { kind: 'noSession' }
  | { kind: 'notAuthorized' }
  | { kind: 'invalidInput'; reason: 'INVALID_NAME' | 'INVALID_FIELD' | 'INVALID_OPTION' | 'INVALID_ACTION' }
  | { kind: 'unexpected'; message: string };

export type HelperRpcResult<T> = { ok: true; data: T } | { ok: false; error: HelperRpcError };

type RpcError = { code?: string; message: string };
type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
type Client = SupabaseClient<Database> | null;

const INPUT_REASONS = ['INVALID_NAME', 'INVALID_FIELD', 'INVALID_OPTION', 'INVALID_ACTION'] as const;

/** Server-Fehler → Art. Ohne Code = Netz/Transport (§ 3.2 „Netz/Zeitüberschreitung“). */
export function classifyHelperRpcError(error: RpcError): HelperRpcError {
  if (!error.code) {
    return { kind: 'network' };
  }
  if (error.code === '42501') {
    return error.message === 'NOT_SIGNED_IN' ? { kind: 'noSession' } : { kind: 'notAuthorized' };
  }
  const reason = INPUT_REASONS.find((r) => r === error.message);
  if (error.code === '22023' && reason) {
    return { kind: 'invalidInput', reason };
  }
  return { kind: 'unexpected', message: `${error.code} ${error.message}` };
}

async function call<T>(client: Client, fn: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<HelperRpcResult<T>> {
  if (!client) {
    return { ok: false, error: { kind: 'unexpected', message: 'Supabase ist nicht konfiguriert' } };
  }
  const rpc = client.rpc.bind(client) as unknown as UntypedRpc;
  let response: Awaited<ReturnType<UntypedRpc>>;
  try {
    response = await rpc(fn, args);
  } catch (error) {
    return error instanceof TypeError
      ? { ok: false, error: { kind: 'network' } }
      : { ok: false, error: { kind: 'unexpected', message: error instanceof Error ? error.message : String(error) } };
  }
  if (response.error) {
    return { ok: false, error: classifyHelperRpcError(response.error) };
  }
  const parsed = schema.safeParse(response.data);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, error: { kind: 'unexpected', message: `Unerwartete Antwort von ${fn}` } };
}

/** Scan (auch ohne Sitzung, Rolle anon). */
export const callJoinCodeInfo = (client: Client, code: string) =>
  call(client, 'join_code_info', { p_code: code }, JoinCodeInfoSchema);

/** Anfrage der Gerätesitzung (S-5: Sitzung erst beim Absenden des Namens anlegen, nie beim Scannen). */
export const callRequestHelperAccess = (client: Client, code: string, displayName: string, deviceLabel: string | null) =>
  call(client, 'request_helper_access', { p_code: code, p_display_name: displayName, p_device_label: deviceLabel }, RequestResultSchema);

/** Zugangsstatus (Polling 2 s, nur sichtbare Seite). */
export const callHelperAccessStatus = (client: Client, tournamentId: string) =>
  call(client, 'helper_access_status', { p_tournament_id: tournamentId }, AccessStatusSchema);

export const callEnsureHelperCode = (client: Client, tournamentId: string) =>
  call(client, 'ensure_helper_code', { p_tournament_id: tournamentId }, CodeResultSchema);

export const callRotateHelperCode = (client: Client, tournamentId: string, openRequests: 'keep' | 'decline') =>
  call(client, 'rotate_helper_code', { p_tournament_id: tournamentId, p_open_requests: openRequests }, CodeResultSchema);

export const callListHelperAccess = (client: Client, tournamentId: string) =>
  call(client, 'list_helper_access', { p_tournament_id: tournamentId }, HelperAccessListSchema);

export const callHelperRequestCount = (client: Client, tournamentId: string) =>
  call(client, 'helper_request_count', { p_tournament_id: tournamentId }, z.number().int());

/** Zulassen braucht die Prüfzahl, die das Handy zeigt (S-1/@HE-105); Ablehnen nicht. */
export const callDecideJoinRequest = (
  client: Client,
  requestId: string,
  decision: { accept: true; checkNumber: number; field: number | null } | { accept: false },
) => call(client, 'decide_join_request', decision.accept
  ? { p_request_id: requestId, p_accept: true, p_field: decision.field, p_check_number: decision.checkNumber }
  : { p_request_id: requestId, p_accept: false }, DecideResultSchema);

export const callChangeHelperAccess = (client: Client, memberId: string, action: 'revoke' | 'watch_only') =>
  call(client, 'change_helper_access', { p_member_id: memberId, p_action: action }, OkResultSchema);

export const callMatchEventAuthorDevices = (client: Client, matchId: string) =>
  call(client, 'match_event_author_devices', { p_match_id: matchId }, AuthorDevicesSchema);

// --- Zuordnung Server-Ergebnis → Anzeige (§ 3.2, verbindlich für A-17a/b/c, A-18a) ------------------------------------

export type HelperAccessView =
  | { view: 'invalidCode' } // „Dieser Code ist nicht gültig“ @HE-103
  | { view: 'codeRotated' } // „Dieser Code ist nicht mehr gültig“ @HE-007 @HE-076
  | { view: 'codeExpired' } // „Dieser Code ist abgelaufen“ @HE-009 @HE-010
  | { view: 'tournamentClosed' } // „Das Turnier ist abgeschlossen – ein Beitritt ist nicht mehr möglich“ @HE-038 @LZ-044
  | { view: 'joinForm'; shareCode: string | null } // Info + Name (+ Zuschauer-Weg) @HE-033 @HE-004
  | { view: 'accountScan' } // Konto: Einträge warten / ohne Netz / Rückfrage (A-17a) @HE-089 @HE-092 @HE-093
  | { view: 'leader'; tournamentId: string } // „Du leitest dieses Turnier bereits“ @HE-091
  | { view: 'waiting'; checkNumber: number | null } // „Wartet auf Freigabe durch die Turnierleitung“ @HE-001 @OB-053
  | { view: 'declined' } // „Anfrage abgelehnt“ @HE-004 @HE-008 @HE-102
  | { view: 'requestExpired' } // „Anfrage verfallen“ @HE-011
  | { view: 'openField'; tournamentId: string; field: number } // Feld öffnen (ohne Feld: 1) @HE-095 @HE-037 @HE-098 Z.3
  | { view: 'finalStandings'; tournamentId: string } // Endstand, kein Eintrag @HE-098 Z.2
  | { view: 'watchOnly'; tournamentId: string } // „Du kannst nur noch zusehen“ @HE-055 Z.2
  | { view: 'noAccess' } // „Du hast keinen Zugriff mehr“ @HE-098 Z.1 @HE-055 @HE-056
  | { view: 'noRequest' } // Zugangsstatus `{relation:'none'}`: keine Anfrage dieses Geräts (Review A-16 L-2)
  | { view: 'busy' } // „Zu viele offene Anfragen – bitte an die Turnierleitung wenden“
  | { view: 'retryScan' } // ACCOUNT_SESSION / NOT_SIGNED_IN = Client-Fehler: Sentry + „Bitte noch einmal scannen“
  | { view: 'decided' } // Leitung: Entscheidung gespeichert
  | { view: 'checkMismatch' } // „Prüfzahl passt nicht“ @HE-105
  | { view: 'alreadyDecided'; decidedBy: string | null } // „bereits von Olli entschieden“ @HE-006
  | { view: 'leaderOnly' } // 42501: „Nur die Turnierleitung kann Helfer verwalten“ @HE-062
  | { view: 'invalidName' } // 22023 INVALID_NAME: Feldprüfung im Formular
  | { view: 'offline' } // „Für den Einstieg brauchst du Netz“ / „Geht nur mit Netz“ @HE-015 @HE-047 @HE-093
  | { view: 'authRateLimited' } // Auth 429: „… bitte in 2 Minuten noch einmal oder mobile Daten nutzen“ (S-6)
  | { view: 'unexpected' };

export type HelperAccessViewInput =
  | { source: 'info'; info: HelperAccessStatus; session: 'none' | 'device' | 'account' }
  | { source: 'request'; result: RequestHelperAccessResult }
  | { source: 'decide'; result: DecideJoinRequestResult }
  | { source: 'error'; error: HelperRpcError }
  | { source: 'authRateLimited' };

const STATE_VIEWS = {
  invalid: { view: 'invalidCode' },
  rotated: { view: 'codeRotated' },
  expired: { view: 'codeExpired' },
  closed: { view: 'tournamentClosed' },
} as const satisfies Record<string, HelperAccessView>;

const RESULT_VIEWS = {
  INVALID: STATE_VIEWS.invalid,
  ROTATED: STATE_VIEWS.rotated,
  EXPIRED: STATE_VIEWS.expired,
  CLOSED: STATE_VIEWS.closed,
  BUSY: { view: 'busy' },
  ACCOUNT_SESSION: { view: 'retryScan' },
} as const satisfies Record<string, HelperAccessView>;

function viewForInfo(info: HelperAccessStatus, session: 'none' | 'device' | 'account'): HelperAccessView {
  const id = info.tournament?.id ?? '';
  switch (info.relation) {
    case 'leader':
      return { view: 'leader', tournamentId: id };
    case 'pending':
      return { view: 'waiting', checkNumber: info.checkNumber ?? null };
    case 'declined':
      return { view: 'declined' };
    case 'expired':
      return { view: 'requestExpired' };
    case 'accepted':
      return info.closed === true
        ? { view: 'finalStandings', tournamentId: id }
        : { view: 'openField', tournamentId: id, field: info.field ?? 1 };
    case 'viewer':
      return { view: 'watchOnly', tournamentId: id };
    case 'revoked':
      return { view: 'noAccess' };
    default:
      break;
  }
  if (info.state === 'open') {
    return session === 'account' ? { view: 'accountScan' } : { view: 'joinForm', shareCode: info.shareCode ?? null };
  }
  if (info.state === undefined) {
    // helper_access_status ohne Anfrage dieses Geräts im Turnier (veralteter Index-Eintrag, Konto-Sitzung): eigene Art.
    return info.relation === 'none' ? { view: 'noRequest' } : { view: 'unexpected' };
  }
  return STATE_VIEWS[info.state];
}

export function helperAccessView(input: HelperAccessViewInput): HelperAccessView {
  switch (input.source) {
    case 'info':
      return viewForInfo(input.info, input.session);
    case 'request': {
      const r = input.result;
      if (r.result === 'PENDING' || r.result === 'EXISTING') {
        return viewForInfo(r, 'device');
      }
      return RESULT_VIEWS[r.result];
    }
    case 'decide': {
      const r = input.result;
      switch (r.result) {
        case 'OK':
          return { view: 'decided' };
        case 'ALREADY_DECIDED':
          return { view: 'alreadyDecided', decidedBy: r.decidedBy };
        case 'EXPIRED':
          return { view: 'requestExpired' };
        case 'CHECK_MISMATCH':
          return { view: 'checkMismatch' };
      }
      break;
    }
    case 'error':
      switch (input.error.kind) {
        case 'network':
          return { view: 'offline' };
        case 'noSession':
          return { view: 'retryScan' };
        case 'notAuthorized':
          return { view: 'leaderOnly' };
        case 'invalidInput':
          return input.error.reason === 'INVALID_NAME' ? { view: 'invalidName' } : { view: 'unexpected' };
        case 'unexpected':
          return { view: 'unexpected' };
      }
      break;
    case 'authRateLimited':
      return { view: 'authRateLimited' };
  }
  return { view: 'unexpected' };
}
