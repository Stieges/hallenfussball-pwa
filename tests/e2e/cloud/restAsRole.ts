/**
 * tests/e2e/cloud/restAsRole.ts — direkte REST-Aufrufe (PostgREST) MIT dem Zugangsschlüssel einer
 * Rolle (A-08g). Gebraucht für die Umgehungs-Nachweise: ein Gerät, das an der App vorbei schreibt.
 * Nur gegen den lokalen Stack (`getLocalServiceRoleClient` sperrt gegen Produktion).
 */
import { getStoredAccessToken } from './engineHelpers';
import { getLocalServiceRoleClient } from './helpers';
import type { LoggedInRole } from './fixtures';

export interface RestResult {
  status: number;
  text: string;
  /** Geparster Rumpf oder null (leer / kein JSON). */
  json: unknown;
}

function toResult(status: number, text: string): RestResult {
  try {
    return { status, text, json: text === '' ? null : JSON.parse(text) };
  } catch {
    return { status, text, json: null };
  }
}

export async function restAsRole(role: LoggedInRole, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', pathAndQuery: string, body?: unknown): Promise<RestResult> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${getStoredAccessToken(role)}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return toResult(res.status, await res.text());
}

/** Service-Role-Zugriff (Prüfen, Vorbereiten wie eine Definer-Funktion, Aufräumen). */
export async function serviceRest(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', pathAndQuery: string, body?: unknown): Promise<RestResult> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return toResult(res.status, await res.text());
}

/** A-27: eine anonyme Gerätesitzung (wie `signInAnonymously`): Zugangsschlüssel, Nutzer-ID, Claim is_anonymous. */
export interface DeviceSession {
  accessToken: string;
  userId: string;
  isAnonymous: boolean;
}

export async function anonymousSession(): Promise<DeviceSession> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {} }),
  });
  const body = (await res.json()) as { access_token?: string; user?: { id?: string; is_anonymous?: boolean } };
  if (!res.ok || !body.access_token || !body.user?.id) {
    throw new Error(`anonymousSession: ${res.status} ${JSON.stringify(body)}`);
  }
  return { accessToken: body.access_token, userId: body.user.id, isAnonymous: body.user.is_anonymous === true };
}

/** PostgREST mit einem beliebigen Zugangsschlüssel (Gerätesitzung). */
export async function restWithToken(accessToken: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', pathAndQuery: string, body?: unknown): Promise<RestResult> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return toResult(res.status, await res.text());
}
