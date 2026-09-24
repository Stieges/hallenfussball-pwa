/**
 * scripts/lib/localSupabaseStatus.ts — EINZIGE Quelle, um URL/Anon-Key/Service-Role-Key/
 * JWT-Secret des LOKALEN Supabase-Stacks per `supabase status -o json` zu lesen.
 *
 * Task T3 (.superpowers/sdd/2026-09-24-testumgebung/task-T3-brief.md): vorher stand diese Logik
 * nur in `scripts/e2e-seed.ts` (dort extrahiert, keine Verhaltensänderung). `playwright.config.ts`
 * nutzt jetzt dieselbe Funktion für den `cloud`-Webserver-Eintrag ("dieselbe Quelle wie das
 * Seed-Skript", Brief Abschnitt 1) — keine hartkodierten URLs/Keys im Playwright-Config.
 *
 * Liest NIE `.env.local` und schreibt nichts — reiner `supabase status`-Aufruf gegen den
 * lokalen Docker-Stack dieses Repos.
 */

import { execSync } from 'node:child_process';

export interface LocalSupabaseStatus {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
  jwtSecret: string;
}

/**
 * Liest den Status des lokalen Supabase-Stacks. Wirft, wenn der Stack nicht läuft oder
 * `supabase status -o json` nicht die erwarteten Felder liefert — kein stillschweigender
 * Fallback auf geratene Werte.
 */
export function getLocalSupabaseStatus(): LocalSupabaseStatus {
  const raw = execSync('supabase status -o json', { encoding: 'utf8' });
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('`supabase status -o json` lieferte kein Objekt.');
  }
  const status = parsed as Record<string, unknown>;
  const url = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  const anonKey = status.ANON_KEY;
  const jwtSecret = status.JWT_SECRET;
  if (
    typeof url !== 'string' ||
    typeof serviceRoleKey !== 'string' ||
    typeof anonKey !== 'string' ||
    typeof jwtSecret !== 'string'
  ) {
    throw new Error(
      '`supabase status -o json` enthält nicht alle erwarteten Felder (API_URL/SERVICE_ROLE_KEY/ANON_KEY/JWT_SECRET).'
    );
  }
  return { url, serviceRoleKey, anonKey, jwtSecret };
}
