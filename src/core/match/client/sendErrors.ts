/**
 * Fehlerklassen fuer den Ausgang (C2a, RC9): Aus einem geworfenen Fehler des
 * Schreibwegs wird eine der sechs Sender-Klassen. SQLSTATE und PostgREST-Codes
 * kommen aus `RepositoryError.originalError` -- `appendMatchEventsRpc` extrahiert
 * sie nicht (dort wird nichts geaendert), hier wird nur gelesen.
 */
import { isTransientMutationError } from '../../errors';

export interface SendFailure {
  kind: 'transient' | 'auth' | 'notReady' | 'matchFull' | 'matchGone' | 'permanent';
  /** SQLSTATE bzw. PostgREST-Code, falls im Fehler enthalten. */
  sqlState?: string;
  message: string;
}

/** PostgREST-Codes fuer fehlenden/abgelaufenen JWT (kein SQLSTATE). */
const AUTH_POSTGREST_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function codeOf(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const code = value.code;
  return typeof code === 'string' && code.length > 0 ? code : undefined;
}

/** SQLSTATE (oder PostgREST-Code) aus dem Fehler -- auch durch Wrapperebenen (originalError). */
export function sqlStateOf(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  return codeOf(error) ?? sqlStateOf(error.originalError);
}

function httpStatusOf(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const status = error.status ?? error.statusCode;
  if (typeof status === 'number') {
    return status;
  }
  return httpStatusOf(error.originalError);
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

/**
 * Ordnet einen Fehler genau einer Klasse zu (RC9). Reihenfolge: SQLSTATE/HTTP
 * vor `isTransientMutationError` -- `auth` gewinnt also immer gegen `transient`.
 */
export function classifySendFailure(error: unknown): SendFailure {
  const sqlState = sqlStateOf(error);
  const message = messageOf(error);
  const status = httpStatusOf(error);
  const failure = (kind: SendFailure['kind']): SendFailure => ({
    kind,
    ...(sqlState !== undefined ? { sqlState } : {}),
    message,
  });

  if (sqlState === '42501' || (sqlState !== undefined && AUTH_POSTGREST_CODES.has(sqlState)) || status === 401) {
    return failure('auth');
  }
  if (sqlState === '22023') {
    // V8: Spiel noch nicht bereit (z. B. Teams offen) -- auch Stapelfehler stecken hier.
    return failure('notReady');
  }
  if (sqlState === '54000') {
    return failure('matchFull');
  }
  if (sqlState === '55000') {
    return failure('matchGone');
  }
  if (isTransientMutationError(error)) {
    return failure('transient');
  }
  return failure('permanent');
}
