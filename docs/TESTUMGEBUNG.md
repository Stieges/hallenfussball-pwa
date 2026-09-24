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
npm run test:env:reset   # Datenbank leeren + Schema neu einspielen (kein Neustart der Container)
npm run test:env:down    # Stack stoppen
```

`test:env:up` und `test:env:reset` spielen **nicht** die Migrationsdateien in
`supabase/migrations/` der Reihe nach ein (das würde an drei bekannten Policy-Kollisionen
scheitern, siehe `supabase/migrations/README.md`). Stattdessen: Baseline
(`00000000000000_baseline_live_schema.sql`) + alle Dateien, die neuer sind als ihr
`baseline-includes-through`-Marker — über `scripts/local-db-apply.sh`, das dieselbe Logik nutzt
wie `scripts/db-drift-check.sh` und `scripts/rls-role-matrix.sh`
(`scripts/lib/migrations-since-baseline.sh`, einzige Quelle für diese Liste).

Deshalb ist in `supabase/config.toml` `[db.migrations] enabled = false` gesetzt — sonst würde
`supabase start`/`db reset` das automatische (scheiternde) Einspielen selbst versuchen.

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

Braucht das lokale Secret `REGISTRATION_CODE` aus `supabase/functions/.env` (dotenv-Format, von
`supabase start`/`functions serve` automatisch gelesen). **Diese Datei existiert nicht im Repo**
und wird auch nicht automatisiert angelegt — Dateien nach dem Muster `.env`/`.env.*` sind in
diesem Repo aus gutem Grund vor automatisierten Schreibzugriffen geschützt (siehe
`.claude/hooks/check-sensitive-path.sh`). **Einmalig manuell anlegen:**

```bash
cat > supabase/functions/.env <<'EOF'
REGISTRATION_CODE=TEST-CODE-LOCAL-2026
EOF
```

Fester Testwert, kein echtes Geheimnis — die echten Werte liegen ausschließlich in den
Supabase-Secrets der Produktion. Ohne diese Datei antwortet die Function mit
`500 {"valid":false,"error":"Server configuration error"}` (geprüft) statt einem echten
Ergebnis — das ist das erwartete Verhalten, kein Bug.

## Typische Fehler

| Symptom | Ursache | Abhilfe |
|---|---|---|
| `supabase start` hängt/bricht mit `Error status 502` beim edge-runtime ab | Erster Start lädt Deno-Abhängigkeiten der Edge Functions über das Netz nach — das kann länger dauern als der Health-Check-Timeout | Nochmal `supabase start` ausführen (Deno-Cache ist dann warm, i. d. R. sofort grün) |
| `Cannot connect to the Docker daemon` | Docker Desktop läuft nicht | Docker Desktop starten, dann erneut versuchen |
| `port ... already allocated` / Ports 54321–54327 belegt | Ein anderer lokaler Supabase-Stack oder ein Fremdprojekt belegt die Ports | Anderen Stack stoppen (`supabase stop` im jeweiligen Projekt) oder Ports in `supabase/config.toml` ändern |
| Signup liefert ein Token, aber `public.profiles` bleibt leer | `supabase/migrations/20260925_001_auth_user_created_trigger.sql` wurde nicht eingespielt (z. B. weil `local-db-apply.sh` übersprungen wurde) | `npm run test:env:reset` erneut ausführen |
| Edge Function antwortet mit „Server configuration error" | `supabase/functions/.env` fehlt (siehe oben) | Datei wie oben beschrieben einmalig anlegen |
| `test:env:status` meldet „Testumgebung läuft nicht" | Stack nicht gestartet | `npm run test:env:up` zuerst |

## Nie tun

- `supabase link` in diesem Repo ausführen.
- `supabase db push` — das Projekt verwaltet Migrationen bewusst nicht über `db push`
  (siehe `supabase/migrations/README.md`, Abschnitt „Namensraum-Konflikt").
- `.env.local` lesen oder in ein Skript dieser Testumgebung einbauen — die Testumgebung ist
  komplett unabhängig von der Produktionskonfiguration.
