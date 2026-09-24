/**
 * assertLocalSupabaseTarget.ts — Produktions-Sperre für `scripts/e2e-seed.ts`.
 *
 * Task T2 (.superpowers/sdd/2026-09-24-testumgebung/task-T2-brief.md), Abschnitt "Dateien":
 * "Das Skript bricht sofort ab, wenn die URL nicht mit http://127.0.0.1 oder http://localhost
 * beginnt oder der Key nicht der lokale ist."
 *
 * Die lokale Supabase-CLI vergibt für JEDEN Stack ohne eigenes `auth.jwt_secret` (so auch
 * dieses Projekt, siehe `supabase/config.toml`) denselben, öffentlich in der Supabase-CLI-
 * Dokumentation stehenden Demo-Key mit dem JWT-Claim `iss: "supabase-demo"` — kein Geheimnis,
 * kein Wert, der je in der Produktion vorkommt (dort ist `iss` die Projekt-Referenz). Diese
 * Prüfung nutzt genau diesen Claim, um "ist das wirklich der lokale Key" zu beantworten, ohne
 * je einen echten Produktions-Key zu lesen oder zu kennen.
 */

const LOCAL_URL_PREFIXES = ['http://127.0.0.1', 'http://localhost'];
const LOCAL_JWT_ISSUER = 'supabase-demo';

export class NotLocalSupabaseTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotLocalSupabaseTargetError';
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new NotLocalSupabaseTargetError(
      'Produktions-Sperre: Key ist kein gültiges JWT (erwartet 3 Teile, getrennt durch ".").'
    );
  }
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(payloadJson);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('JWT-Payload ist kein Objekt.');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new NotLocalSupabaseTargetError('Produktions-Sperre: JWT-Payload konnte nicht gelesen werden.');
  }
}

/**
 * Wirft `NotLocalSupabaseTargetError`, wenn `url` und `key` nicht eindeutig den lokalen
 * Supabase-CLI-Stack identifizieren. Muss VOR jedem Schreibzugriff von `scripts/e2e-seed.ts`
 * aufgerufen werden.
 */
export function assertLocalSupabaseTarget(url: string, key: string): void {
  if (!LOCAL_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    throw new NotLocalSupabaseTargetError(
      `Produktions-Sperre: URL "${url}" beginnt nicht mit http://127.0.0.1 oder http://localhost. ` +
        'Abbruch, um die Produktion nie versehentlich zu berühren.'
    );
  }

  const payload = decodeJwtPayload(key);
  if (payload.iss !== LOCAL_JWT_ISSUER) {
    throw new NotLocalSupabaseTargetError(
      `Produktions-Sperre: Key stammt nicht vom lokalen Supabase-CLI-Standard ` +
        `(iss="${String(payload.iss)}" statt "${LOCAL_JWT_ISSUER}"). Abbruch.`
    );
  }
}
