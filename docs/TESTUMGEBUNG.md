# Lokale Testumgebung (Supabase)

Eine vollständige lokale Kopie der Cloud — Postgres, Auth (GoTrue), PostgREST, Realtime,
Mail-Postfach (Mailpit) und Edge Functions — mit **exakt unserem Schema**. Die Produktion wird
dabei nie berührt (kein `supabase link`, kein `db push`, kein Supabase-MCP).

Task T1 aus `docs/superpowers/plans/2026-09-24-testumgebung.md`. Hintergrund zur Migrationsliste:
`supabase/migrations/README.md`.

## Voraussetzungen

- Docker Desktop läuft (mind. ~4 GB RAM frei für den Stack).
- Supabase CLI installiert (`supabase --version`; getestet mit 2.67.1).
- `jq` installiert (`brew install jq`).

## Befehle

```bash
npm run test:env:up      # Stack starten + Schema einspielen (Baseline + neuere Migrationen)
npm run test:env:status  # URL, DB-URL, Functions-URL, Anon-/Publishable-Key anzeigen
npm run test:env:seed    # Testnutzer + Testturniere idempotent (neu) anlegen
npm run test:env:reset   # Datenbank leeren + Schema neu einspielen + test:env:seed
npm run test:env:down    # Stack stoppen
```

`test:env:seed` legt die in [Testnutzer](#testnutzer-und-testdaten) beschriebenen Nutzer,
Turniere und Einladungen an (`scripts/e2e-seed.ts`, `npx tsx`). Es ist idempotent — ein zweiter
Lauf ergibt denselben Stand (Zählung und IDs identisch). `test:env:reset` ruft es automatisch
nach dem Schema-Einspielen auf.

`test:env:up` und `test:env:reset` spielen **nicht** die Migrationsdateien in
`supabase/migrations/` der Reihe nach ein (das würde an drei bekannten Policy-Kollisionen
scheitern, siehe `supabase/migrations/README.md`). Stattdessen: Baseline
(`00000000000000_baseline_live_schema.sql`) + alle Dateien, die neuer sind als ihr
`baseline-includes-through`-Marker — über `scripts/local-db-apply.sh`, das dieselbe Logik nutzt
wie `scripts/db-drift-check.sh` und `scripts/rls-role-matrix.sh`
(`scripts/lib/migrations-since-baseline.sh`, einzige Quelle für diese Liste).

Deshalb ist in `supabase/config.toml` `[db.migrations] enabled = false` gesetzt — sonst würde
`supabase start`/`db reset` das automatische (scheiternde) Einspielen selbst versuchen.

## Testnutzer und Testdaten

Einzige Quelle: `tests/e2e/cloud/testData.ts` (E-Mails, Passwort, Turnier-IDs, Rollen). Acht
Testnutzer mit Konto (`owner`, `coadmin`, `helper`, `trainer`, `viewer`, `revoked`, `stranger`,
`google` — ohne Passwort, OAuth-Marker) plus `logouttest` und `logouttestMobile` (je ein eigener
Nutzer für den Anmelden/Abmelden-Test, einer je Playwright-Projekt, s. u.), alle mit Passwort
`E2E_TEST_PASSWORD` außer `google`.

Fünf Testturniere (Task T2 + Fixrunde 2, N3/Ruling AA):

| Turnier | Status | `config.publishedAt` | `is_public` | Mitglieder (über owner hinaus) |
|---|---|---|---|---|
| Live-Cup | published | **nicht gesetzt** (¹) | `false` | coadmin, helper, trainer, viewer, revoked (widerrufen) |
| Public-Cup | published | gesetzt | `true`, Share-Code `E2EPUB` | — |
| Entwurf-Cup | draft | nicht gesetzt | `false` | — |
| Freigabe-Cup | published | gesetzt | `false` | coadmin (Co-Admin) |
| Fremd-Cup | draft | nicht gesetzt | `false` | Eigentümer: `stranger` |

(¹) Fixrunde 3 (N15, korrigiert): der Seed setzt `config.publishedAt` NUR beim Public-Cup und beim
Freigabe-Cup explizit (`e2e-seed.ts`, Backstop, s. u.). Beim Live-Cup fehlt der Wert in der
gespeicherten `config` — die App leitet ihn beim LESEN lediglich aus `status='published'` ab
(`supabaseMappers.ts:545-547`, reines Anzeige-Backfill, nicht persistiert). Für den DB-Trigger
`enforce_release_before_public` (HF001), der `config->>'publishedAt'` direkt prüft, zählt nur der
gespeicherte Wert — der Live-Cup dürfte deshalb nicht ohne Weiteres auf `is_public=true`
umgestellt werden, obwohl die Oberfläche ihn als veröffentlicht anzeigt.

Der Entwurf-Cup bleibt bewusst ein reiner Entwurf (kein `publishedAt`) — das prüft, dass ein noch
nie freigegebenes Turnier per Direktlink nicht erreichbar ist (`public-view.cloud.spec.ts`; eine
gesonderte Prüfung über die Veröffentlichen-RPC/`make_tournament_public` existiert dafür NICHT,
nur der Direktlink-Weg ist getestet).
Der Freigabe-Cup ist das Gegenstück dafür, wo eine Freigabe schon stattgefunden hat
(`publishedAt` gesetzt), das Turnier aber noch nicht öffentlich geteilt ist (`is_public=false`)
— genau der Zustand, den `publish-coadmin.cloud.spec.ts` braucht, um die
Co-Admin-Veröffentlichung zu prüfen, ohne den Entwurf-Cup dafür zweckzuentfremden. Er trägt
außerdem einen Sponsor und einen Monitor mit `sponsor`-Slide (`E2E_RELEASE_CUP_*`-Konstanten),
damit "Sponsor und Monitor folgen" nach einer (gewollten) Freigabe konkret geprüft werden kann.

`logouttest`/`logouttestMobile` haben bewusst KEINE Turnier-Mitgliedschaft und werden von keinem
anderen Spec über `asRole()` verwendet — `supabase.auth.signOut()` läuft ohne `scope`-Option
(Supabase-JS-Standard `scope: 'global'`) und würde sonst jede andere Session desselben Kontos mit
beenden. Zwei getrennte Nutzer (Fixrunde 2, N9), weil `auth.cloud.spec.ts` denselben
Anmelden/Abmelden-Test `fullyParallel` gleichzeitig auf `cloud-desktop` UND `cloud-mobile`
ausführt — ein gemeinsamer Nutzer hätte dieselbe globale-signOut()-Kopplung zwischen den beiden
Projekten.

## Ports (aus `supabase/config.toml`)

| Dienst | Port | URL |
|---|---|---|
| API (Kong-Gateway, REST/Auth/Functions/Realtime) | 54321 | http://127.0.0.1:54321 |
| Postgres | 54322 | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio | 54323 | http://127.0.0.1:54323 |
| Mailpit (Mail-Postfach) | 54324 | http://127.0.0.1:54324 |
| Analytics | 54327 | – |

Auth ist ohne E-Mail-Bestätigung konfiguriert (`enable_confirmations = false`) — neu registrierte
Testnutzer sind sofort anmeldefähig. `site_url`/`additional_redirect_urls` zeigen auf Port 3100
(lokaler „cloud"-Playwright-Webserver, Task T3).

## Edge Function `validate-registration-code`

Braucht das Secret `REGISTRATION_CODE`. Lokal **kein** `supabase/functions/.env` (dieser Weg
wurde in Task T1 versucht und verworfen — Dateien nach dem Muster `.env`/`.env.*` sind in diesem
Repo aus gutem Grund vor automatisierten Schreibzugriffen geschützt, siehe
`.claude/hooks/check-sensitive-path.sh`, und das soll so bleiben).

Stattdessen (Task T2, Ruling O): `supabase/config.toml` setzt
`[edge_runtime.secrets] REGISTRATION_CODE = "env(E2E_REGISTRATION_CODE)"` — die Edge-Runtime
liest den Wert beim Start aus der Prozess-Variable `E2E_REGISTRATION_CODE`. `npm run
test:env:up`/`test:env:reset` sourcen dafür `scripts/lib/e2e-registration-code.sh` (einzige
Quelle des festen Testwerts `E2E-LOCAL-CODE-NICHT-PRODUKTIV`, Zwilling in
`tests/e2e/cloud/testData.ts`, Gleichlauf per Test geprüft). Kein manueller Schritt mehr nötig —
`npm run test:env:up` allein reicht.

**Dieser Wert darf nie in der Produktion gesetzt werden** — dort bleibt es beim echten,
in den Supabase-Secrets der Produktion verwalteten Wert. Fehlt `E2E_REGISTRATION_CODE` beim
Start (z. B. `supabase start` direkt statt über `npm run test:env:up`), antwortet die Function
mit `500 {"valid":false,"error":"Server configuration error"}` (geprüft) statt einem echten
Ergebnis — das ist das erwartete Verhalten, kein Bug.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
|---|---|---|
| `supabase start` hängt/bricht mit `Error status 502` beim edge-runtime ab | Erster Start lädt Deno-Abhängigkeiten der Edge Functions über das Netz nach — das kann länger dauern als der Health-Check-Timeout | Nochmal `supabase start` ausführen (Deno-Cache ist dann warm, i. d. R. sofort grün) |
| `Cannot connect to the Docker daemon` | Docker Desktop läuft nicht | Docker Desktop starten, dann erneut versuchen |
| `port ... already allocated` / Ports 54321–54327 belegt | Ein anderer lokaler Supabase-Stack oder ein Fremdprojekt belegt die Ports | Anderen Stack stoppen (`supabase stop` im jeweiligen Projekt) oder Ports in `supabase/config.toml` ändern |
| Signup liefert ein Token, aber `public.profiles` bleibt leer | `supabase/migrations/20260925_001_auth_user_created_trigger.sql` wurde nicht eingespielt (z. B. weil `local-db-apply.sh` übersprungen wurde) | `npm run test:env:reset` erneut ausführen |
| Edge Function antwortet mit „Server configuration error" | `E2E_REGISTRATION_CODE` war beim Container-Start nicht gesetzt (z. B. `supabase start` direkt statt `npm run test:env:up`) | `npm run test:env:up`/`test:env:reset` verwenden (setzt die Variable vor dem Start) |
| `test:env:status` meldet „Testumgebung läuft nicht" | Stack nicht gestartet | `npm run test:env:up` zuerst |

## Nie tun

- `supabase link` in diesem Repo ausführen.
- `supabase db push` — das Projekt verwaltet Migrationen bewusst nicht über `db push`
  (siehe `supabase/migrations/README.md`, Abschnitt „Namensraum-Konflikt").
- `.env.local` lesen oder in ein Skript dieser Testumgebung einbauen — die Testumgebung ist
  komplett unabhängig von der Produktionskonfiguration.
