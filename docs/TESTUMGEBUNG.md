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

## CI

Task T6 (`.superpowers/sdd/2026-09-24-testumgebung/task-T6-brief.md`) bringt diese Testumgebung
und den Rechte-Harness als zwei eigene GitHub-Actions-Workflows in die CI. **Beide sind noch
KEIN Pflicht-Check** — die Branch-Protection ist unverändert. Sie werden eine Woche lang nur
beobachtet, bevor Daniel entscheidet, ob sie zur Pflicht werden (Ruling im Programm-Ledger,
`.superpowers/sdd/2026-09-24-testumgebung/progress.md`).

### `.github/workflows/e2e-cloud.yml`

- **Wann:** bei jedem Pull Request gegen `main` und bei jedem Push auf `main` — dieselben
  Trigger wie `ci.yml`.
- **Was:** startet einen echten lokalen Supabase-Stack im Runner (`supabase/setup-cli@v1`,
  Version 2.67.1 — dieselbe wie lokal, siehe „Voraussetzungen" oben), spielt Schema + Seed über
  denselben Befehl wie lokal ein (`npm run test:env:reset`) und lässt dann `npm run
  test:e2e:cloud` laufen (Playwright nur für `cloud-setup`/`cloud-desktop`/`cloud-mobile`, nur
  Chromium installiert). Keine Produktions-URL, keine Secrets — die Produktions-Sperre
  (`assertLocalSupabaseTarget`, `scripts/require-local-stack.sh`) bleibt wie lokal aktiv, weil
  der Job nirgends eine andere Ziel-URL setzt.
- **Zeitbudget:** `timeout-minutes: 12`. Lokal (warme Docker-Images, warmer `node_modules`-/
  Playwright-Cache) dauert die Kette `supabase start` (~25 s) + `test:env:reset` (~33 s) +
  `test:e2e:cloud` (~67 s) zusammen rund 2 Minuten — der CI-Runner braucht zusätzlich `npm ci`,
  die Chromium-Installation und einen kalten Image-Pull für den Supabase-Stack (Runner hat dafür
  kein Docker-Layer-Cache); ob 12 Minuten dafür reichen, zeigt erst der erste echte Lauf.
- **Roten Lauf lesen:** bei Fehlschlag lädt der Job zwei Artefakte hoch —
  `playwright-report-cloud` (HTML-Report, wie beim bestehenden `e2e-tests`-Job in `ci.yml`) und
  `supabase-logs-cloud` (`supabase status` + die letzten 100 Zeilen jedes
  `supabase_*`-Containers). Ein `test.fail()`-annotierter Cloud-Spec-Test, der wie erwartet
  fehlschlägt, zählt NICHT als roter Lauf (Playwright zählt ihn als „passed" — siehe
  `docs/superpowers/plans/2026-09-24-testumgebung.md`, Task T4).

### `.github/workflows/rls-role-matrix.yml`

- **Wann:** nur bei Pull Requests, die `supabase/migrations/**`, `scripts/rls-role-matrix.sh`
  oder `src/features/auth/permissions/rolePermissions.json` ändern (Pfad-Trigger, kein Push).
- **Was:** `bash scripts/rls-role-matrix.sh` im Default-Modus — das Skript startet seinen
  eigenen Wegwerf-Postgres-Container (`supabase/postgres:17.6.1.063`), braucht dafür keinen
  laufenden Supabase-Stack. Prüft `rolePermissions.json` gegen echtes RLS (207 geprüfte Zellen,
  Stand T1).
- **Zeitbudget:** `timeout-minutes: 10` (kein Vorgabewert aus dem Brief, eigene Einschätzung).
- **Roten Lauf lesen:** Exit ≠ 0 macht den Job automatisch rot, sobald eine Zelle von der
  Rechtetabelle abweicht — die Zusammenfassung mit der genauen Abweichungszahl steht direkt im
  Job-Log (kein separates Artefakt nötig). Lokale Gegenprobe (T6): eine bewusst falsche Zeile in
  `rolePermissions.json` (`collaborator` bekommt zusätzlich `manageMembers`) lässt das Skript mit
  4 Abweichungen und Exit 1 enden; nach dem Zurücksetzen wieder 0 Abweichungen, Exit 0.

### `.github/workflows/visual.yml`

- **Wann:** nur bei Pull Requests gegen `main` (kein Push-Trigger — Vorlagen ändern sich nicht
  von selbst).
- **Was:** siehe Abschnitt „Visual Regression (Bildvergleiche)" unten für das Gesamtbild. Der
  Job läuft im offiziellen Playwright-Container (`mcr.microsoft.com/playwright:v1.63.0-noble`,
  exakt passend zur gepinnten `@playwright/test`-Version) und vergleicht per Default
  (`--update-snapshots=none`) gegen die eingecheckten Vorlagen. Trägt der PR das Label
  `visual-update`, schreibt der Job stattdessen neue Vorlagen (`--update-snapshots=all`, Job wird
  grün) und lädt sie als Artefakt `visual-snapshots` hoch.
- **Zeitbudget:** `timeout-minutes: 15` (kein Vorgabewert aus dem Brief, eigene Einschätzung —
  Production-Build + drei Viewport-Projekte im Container ohne Docker-Layer-Cache).
- **Roten Lauf lesen:** bei einer Abweichung (ohne Label) lädt der Job zwei Artefakte hoch —
  `playwright-report-visual` (HTML-Report mit Differenzbildern) und `visual-diff-results`
  (`test-results/`, dieselben Differenzbilder als Rohdateien). Mit Label `visual-update` kann der
  Job nicht rot werden (es gibt nichts zum Vergleichen) — das Committen der neuen Vorlagen macht
  in jedem Fall der Controller, nicht der Workflow selbst.

## Visual Regression (Bildvergleiche)

Task T5 (`.superpowers/sdd/2026-09-24-testumgebung/task-T5-brief.md`). `toHaveScreenshot`-Tests
unter `tests/e2e/visual/*.visual.spec.ts` für acht Screens auf drei Breakpoints (Handy 390,
Tablet 768, Desktop 1280 — eigene Playwright-Projekte `visual-mobile`/`visual-tablet`/
`visual-desktop`, `playwright.config.ts`):

| Screen | Spec-Datei | Route |
|---|---|---|
| Dashboard | `dashboard.visual.spec.ts` | `/#/` |
| Wizard Schritt 1 (Stammdaten) | `wizard-step1.visual.spec.ts` | `/#/tournament/new` |
| Wizard Schritt 5 (Teams) | `wizard-step5.visual.spec.ts` | `/#/tournament/new?step=5` |
| Turnier-Admin (Dashboard-Kategorie) | `admin.visual.spec.ts` | `/#/tournament/:id/admin/dashboard` |
| Live-Cockpit (laufendes Spiel) | `cockpit-running.visual.spec.ts` | `/#/tournament/:id/live` |
| Monitor | `monitor.visual.spec.ts` | `/#/display/:id/:monitorId` |
| Public View | `public-view.visual.spec.ts` | `/#/public/:id` |
| Login | `login.visual.spec.ts` | `/#/login` |

Macht 8 × 3 = 24 Vorlagen, wie im Plan vorgegeben.

### Warum ein eigener Ordner, eigene Projekte

Die Visual-Specs laufen **nicht** in den bestehenden E2E-Projekten (`mobile-sm`, `desktop`, ...)
mit — dort gibt es keinen Playwright-Container, Schriften/Sub-Pixel-Rendering würden zwischen
macOS/Ubuntu-ohne-Container und dem Container abweichen. `playwright.config.ts` gibt den
`visual-*`-Projekten ein eigenes `testDir` (`tests/e2e/visual`) und schließt diesen Ordner bei
allen anderen Projekten per `testIgnore` aus.

### Immer im offiziellen Container

Lokale Docker-Läufe UND die CI (`.github/workflows/visual.yml`) verwenden exakt
`mcr.microsoft.com/playwright:v1.63.0-noble` — dieselbe Version wie das installierte
`@playwright/test` (`npx playwright --version`). Nur so ist ein lokal (im Container) erzeugter
Snapshot mit dem in der CI (im selben Container) erzeugten identisch.

**`npm run test:visual`** (Vergleichsmodus) und **`npm run test:visual:update`**
(`--update-snapshots=all`) starten dafür `docker run` mit dem Repo als Bind-Mount und `npm ci`
+ `npx playwright test` innerhalb des Containers. Bekannter Nebeneffekt: `npm ci` im Container
installiert Linux-native Abhängigkeiten in das (gemountete, also auch auf dem Host sichtbare)
`node_modules` — nach einem lokalen Docker-Lauf auf dem Mac einmal `npm ci` auf dem Host erneut
laufen lassen, um wieder Mac-native Binaries zu bekommen.

**In dieser Aufgabe (T5) lokal NICHT ausgeführt** — die lokale Docker-Platte hat nur ~1,8 GB
frei, das Playwright-Image passt dort nicht (Ruling Y im Task-Brief, „Nichts in Docker löschen").
Der erste echte CI-Lauf mit dem Label `visual-update` (Vorlagen erzeugen) läuft durch den
Controller, nicht durch diese Aufgabe.

### Was stattdessen lokal (ohne Container) geprüft wurde

Ohne Container liefert derselbe Test andere Pixel (macOS-Font-Rendering) — die dabei erzeugten
Bilder dürfen deshalb nie die eingecheckten Vorlagen werden. `playwright.config.ts` liest dafür
`VISUAL_SNAPSHOT_DIR`: gesetzt, zeigt der Snapshot-Pfad auf ein beliebiges (temporäres)
Verzeichnis statt auf `tests/e2e/visual/__screenshots__`. So lässt sich lokal mit echtem
Chromium beweisen, dass Selektoren, Fixtures, Masken und `page.clock` funktionieren, ohne
Mac-Bilder einzuchecken. Ergebnis und Laufzeiten: siehe
`.superpowers/sdd/2026-09-24-testumgebung/task-T5-report.md`.

### Uhrzeit einfrieren statt maskieren, wo möglich

`tests/e2e/visual/helpers.ts#freezeClock()` setzt `page.clock.setFixedTime()` auf ein festes
Datum, **bevor** die erste Navigation passiert. Das macht `Date.now()`/`new Date()` für die
gesamte Testdauer konstant — Spieluhr (`useMatchTimerExtended`, per `requestAnimationFrame`),
Monitor-Timer, Pixel-Shift-Schutz (`usePixelShift`, 60s-Intervall wird während des kurzen Tests
nie fällig) und „vor X Min."-Texte (`SyncStatusBar`) zeigen dadurch bei jedem Lauf denselben
Stand — ganz ohne die zusätzlichen, volleren Fake-Timer aus `page.clock.install()`, die hier ein
Hänge-Risiko hätten (siehe ausführliche Begründung im Datei-Kommentar von `helpers.ts`: ein
`setTimeout`-Retry beim Nachladen von Lazy-Chunks, `src/lib/lazyWithRetry.ts`, könnte sonst nie
feuern).

Zusätzlich, defensiv per `mask` (Playwright deckt den Bereich grau ab, matcht ein Screen das
Element nicht, wird es einfach ignoriert): Toast-Container, Sync-Status-Badge, QR-Code
(`commonMasks()` in `helpers.ts`) — auf den gewählten acht Screens kommen QR-/Share-Codes aktuell
nicht vor (die Maske ist ein Sicherheitsnetz für spätere Screens, nicht aktuell wirksam).

### Datenquelle: Offline-Fixtures statt Supabase

Alle acht Screens laufen offline (IndexedDB-Fixtures über `seedIndexedDB`, wie die bestehenden
`tests/e2e/flows/*.spec.ts`). Für „Public View" gibt es zwei Routen mit unterschiedlicher
Datenquelle (`src/core/routing/routeRegistry.ts`): `/live/:shareCode` braucht einen echten
Supabase-Stack, `/public/:tournamentId` rendert denselben Screen (`PublicTournamentViewScreen`)
komplett aus IndexedDB. Die Visual-Specs nutzen `/public/:tournamentId` — keine Lücke, kein
`test.fixme` nötig (Ruling Y, Punkt 2 im Task-Brief).

Das Live-Cockpit braucht zusätzlich einen Eintrag in der `liveMatches-<tournamentId>`-
localStorage-Quelle (`src/hooks/useLiveMatches.ts`, getrennt vom IndexedDB-Turnier-Blob) — dafür
gibt es `seedRunningLiveMatch()` in `helpers.ts`, mit einem `timerStartTime` exakt 320s vor der
eingefrorenen Uhr statt eines echten Start-Klicks (deterministisch statt klick-zeitpunkt-
abhängig).

## Nie tun

- `supabase link` in diesem Repo ausführen.
- `supabase db push` — das Projekt verwaltet Migrationen bewusst nicht über `db push`
  (siehe `supabase/migrations/README.md`, Abschnitt „Namensraum-Konflikt").
- `.env.local` lesen oder in ein Skript dieser Testumgebung einbauen — die Testumgebung ist
  komplett unabhängig von der Produktionskonfiguration.
