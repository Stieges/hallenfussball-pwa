import { describe, expect, it } from 'vitest';
import { assertLocalSupabaseTarget, NotLocalSupabaseTargetError } from '../assertLocalSupabaseTarget';

/**
 * Task T2, Nachweis 4 (.superpowers/sdd/2026-09-24-testumgebung/task-T2-brief.md):
 * "Die Produktions-Sperre greift, Test ROT und dann GRÜN." Dieser Test wurde vor der
 * Implementierung von `assertLocalSupabaseTarget.ts` angelegt und ROT gesehen
 * (Modul existierte nicht), siehe task-T2-report.md für den Nachweis.
 */

// Gültiger lokaler Standard-Key der Supabase-CLI (iss: "supabase-demo", der öffentlich
// dokumentierte, feste Wert für JEDEN lokalen Stack ohne eigenes `auth.jwt_secret" — kein
// Geheimnis, kein Produktionswert). Payload/Signatur hier frei erfunden, nur der iss-Claim zählt.
const LOCAL_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Gleiche Struktur, aber iss ist NICHT "supabase-demo" (simuliert einen Cloud-/Produktions-Key).
const PRODUCTION_LIKE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhbXRscWljb3NzY3Nqbm50aHZ6bSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJleHAiOjE5ODM4MTI5OTZ9.aWdub3JlZC1zaWduYXR1cmU';

describe('assertLocalSupabaseTarget', () => {
  it('akzeptiert 127.0.0.1 mit dem lokalen Standard-Key', () => {
    expect(() => assertLocalSupabaseTarget('http://127.0.0.1:54321', LOCAL_JWT)).not.toThrow();
  });

  it('akzeptiert localhost mit dem lokalen Standard-Key', () => {
    expect(() => assertLocalSupabaseTarget('http://localhost:54321', LOCAL_JWT)).not.toThrow();
  });

  it('bricht ab, wenn die URL nicht lokal ist', () => {
    expect(() =>
      assertLocalSupabaseTarget('https://amtlqicosscsjnnthvzm.supabase.co', LOCAL_JWT)
    ).toThrow(NotLocalSupabaseTargetError);
  });

  it('bricht ab, wenn der Key nicht der lokale Standard-Key ist (falscher iss-Claim)', () => {
    expect(() =>
      assertLocalSupabaseTarget('http://127.0.0.1:54321', PRODUCTION_LIKE_JWT)
    ).toThrow(NotLocalSupabaseTargetError);
  });

  it('bricht ab, wenn der Key kein gültiges JWT ist', () => {
    expect(() => assertLocalSupabaseTarget('http://127.0.0.1:54321', 'nicht-ein-jwt')).toThrow(
      NotLocalSupabaseTargetError
    );
  });

  it('bricht ab, wenn URL UND Key nicht lokal sind', () => {
    expect(() =>
      assertLocalSupabaseTarget('https://amtlqicosscsjnnthvzm.supabase.co', PRODUCTION_LIKE_JWT)
    ).toThrow(NotLocalSupabaseTargetError);
  });
});
