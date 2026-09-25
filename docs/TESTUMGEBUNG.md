# Lokale Testumgebung (Supabase)

Eine vollständige lokale Kopie der Cloud — Postgres, Auth (GoTrue), PostgREST, Realtime,
Mail-Postfach (Mailpit) und Edge Functions — mit **exakt unserem Schema**. Die Produktion wird
dabei nie berührt (kein `supabase link`, kein `db push`, kein Supabase-MCP).

Task T1 aus `docs/superpowers/plans/2026-09-24-testumgebung.md`. Hintergrund zur Migrationsliste:
`supabase/migrations/README.md`.

## Voraussetzungen

- Docker Desktop läuft (mind. ~4 GB RAM frei für den Stack).
- Supabase CLI installiert (`supabase --version`; getestet mit 2.117.0).
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

**Abschluss-Fixrunde (final-fix-brief.md, I2/Ruling AG):** Der Public-Cup bekommt zusätzlich EIN
Spiel, das der Seed direkt per Service-Role auf `matchStatus: 'running'` setzt — analog zum
bereits bestehenden laufenden Live-Cup-Spiel, NIE über `MatchExecutionService.initializeMatch()`
(das würde bei einem noch nie zuvor geladenen Spiel an C-NSTART scheitern, siehe
`tests/e2e/cloud/testData.ts#E2E_PUBLIC_CUP_RUNNING_MATCH_SEED_SCORE`). Ohne diesen Bypass konnte
der Monitor-Nachweis (`two-devices.cloud.spec.ts`) nie über C-NSTART hinauskommen — seit der
Fixrunde läuft er wirklich. **Nach-Review (final-rereview.md, I-N1):** Dieser Test beweist "ohne
Reload" per 5s-Polling, NICHT "in Echtzeit" — der Monitor liest den Spielstand ausschließlich per
`setInterval` (`MonitorDisplayPage.tsx:1116-1121`), keine Realtime-Subscription; das
Fundament-Ziel ≤3s ist damit für den Monitor-Spielstand nicht erreicht (Befund C-MONPOLL). Die
übrigen, unangetasteten Public-Cup-Spiele bleiben bewusst
`scheduled` (nie initialisiert) — das braucht der eigene C-NSTART-Test in derselben Datei.

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

### Playwright-Webserver (offline/cloud) — Produktions-Sperre lokal (C1)

| Webserver | Port | Zeigt auf | `reuseExistingServer` |
|---|---|---|---|
| `offline` | 3000 (bzw. 4173 mit `CI_E2E_USE_PREVIEW`) | NIE Supabase (`VITE_SUPABASE_*` explizit leer) | `false` |
| `cloud` | 3100 | lokaler Supabase-Stack (`getCloudSupabaseEnv()`) | `false` |

Abschluss-Review (final-review.md, C1/Ruling AG): Vorher übernahm Playwright lokal
(`reuseExistingServer: !process.env.CI`, also `true`) einen bereits laufenden Server auf
Port 3000 — genau der Standardport von `npm run dev`. Lief beim Entwickeln `npm run dev` (liest
`.env.local`, zeigt also auf die Produktion) und startete Daniel danach `npm run test:e2e`, hätte
die gesamte Offline-Suite gegen eine Produktions-App laufen können, ohne dass der `env`-Override in
`playwright.config.ts` je gegriffen hätte. Seit der Fixrunde:

- `reuseExistingServer: false` für BEIDE Webserver, immer (nicht mehr nur in der CI) — Playwright
  startet den Server bei JEDEM Lauf selbst neu.
- `--strictPort` an `vite`/`vite preview` — belegt ein anderer Prozess (z. B. ein laufender
  `npm run dev`) exakt diesen Port, bricht Vite sofort ab, statt still auf den nächsten freien Port
  auszuweichen. Playwright meldet dann einen klaren Startfehler statt eines mehrminütigen Timeouts.
- Beide Ports bleiben bewusst UNVERÄNDERT (3000 offline, 3100 cloud) — genau auf Port 3000
  kollidiert ein versehentlich laufender `npm run dev` mit dem offline-Webserver, das ist Absicht
  (siehe Gegenprobe unten).
- `CI_E2E_USE_PREVIEW` außerhalb der CI (`!process.env.CI`) bricht die `playwright.config.ts`-Konfiguration
  jetzt mit einer klaren Fehlermeldung sofort ab — ein lokaler `npm run build` würde `.env.local`
  fest in das Preview-Bundle einbauen (Vite ersetzt `VITE_SUPABASE_*` beim Build, nicht zur
  Laufzeit). Einzige Ausnahme: `npm run test:visual`/`test:visual:update` (siehe unten,
  `scripts/visual-in-container.sh`) setzen neben `CI_E2E_USE_PREVIEW=1` explizit auch `CI=true`
  UND leeren `VITE_SUPABASE_*` selbst für den Build im Container — ein bewusst nachgebauter
  CI-Ablauf, keine Umgehung.

**Gegenprobe (final-fix-report.md):** `npm run dev` auf Port 3000 laufen lassen (liest
`.env.local`, ohne dessen Inhalt zu lesen — die Datei bleibt für diese Aufgabe tabu), danach die
Offline-Suite starten. Der eigene `offline`-Webserver scheitert am belegten Port
(`--strictPort`/`EADDRINUSE`), Playwright bricht den Lauf ab — kein einziger Test läuft gegen den
laufenden Dev-Server. `tests/e2e/flows/production-lockout.spec.ts` bleibt zusätzlich die
strukturelle Absicherung (0 Anfragen an `*.supabase.co`), falls der Port zufällig frei ist.

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
  Version 2.117.0 — dieselbe wie lokal, siehe „Voraussetzungen" oben), spielt Schema + Seed über
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

- **Wann:** nur bei Pull Requests, die `supabase/migrations/**`, `scripts/rls-role-matrix.sh`,
  `scripts/lib/migrations-since-baseline.sh` (Abschluss-Fixrunde, final-review.md M4 — das Skript
  sourced diese Datei seit Task T1 für die Baseline-Migrationsliste, fehlte vorher im Filter),
  der Workflow selbst oder `src/features/auth/permissions/rolePermissions.json` ändern
  (Pfad-Trigger, kein Push).
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

- **Wann:** bei Pull Requests gegen `main`, `types: [opened, synchronize, reopened, labeled]`
  (kein Push-Trigger — Vorlagen ändern sich nicht von selbst). Das explizite `labeled` (Fixrunde 1,
  Ruling AC) sorgt dafür, dass reines Setzen des Labels `visual-update` auf einen bereits offenen
  PR sofort einen Lauf auslöst, statt einen Leer-Commit zu erfordern, damit ein
  `synchronize`-Event das Label sieht.
- **Was:** siehe Abschnitt „Visual Regression (Bildvergleiche)" unten für das Gesamtbild. Der
  Job läuft im offiziellen Playwright-Container (`mcr.microsoft.com/playwright:v1.63.0-noble`,
  exakt passend zur gepinnten `@playwright/test`-Version — ein eigener Pin-Check-Schritt
  (Abschluss-Fixrunde, final-review.md M9) vergleicht `npx playwright --version` gegen die
  Image-Version und bricht mit klarer Meldung ab, falls ein Dependabot-Bump von
  `@playwright/test` das Image nicht mit anhebt) und vergleicht per Default
  (`--update-snapshots=none`) gegen die eingecheckten Vorlagen. Trägt der PR das Label
  `visual-update`, schreibt der Job stattdessen neue Vorlagen (`--update-snapshots=all`) und lädt
  sie als Artefakt `visual-snapshots` hoch — **und beendet sich danach absichtlich rot**
  (Fixrunde 1, Ruling AC) mit der Meldung „Update-Modus – Vorlagen im Artefakt visual-snapshots,
  Label entfernen und Vorlagen committen". Grund: `--update-snapshots=all` vergleicht nichts,
  sondern schreibt nur — ohne den bewussten Fehlschlag würde ein vergessenes, weiter gesetztes
  Label jeden folgenden Push stillschweigend als grün durchwinken, egal ob sich dabei eine echte
  visuelle Regression einschleicht. **Nach dem Commit der Vorlagen muss deshalb immer ein
  abschließender grüner Vergleichslauf (Label entfernt) den Endstand bestätigen, bevor der PR
  gemerged wird** — ein roter Update-Modus-Lauf ist kein Fehler, sondern die Erinnerung daran.
- **Zeitbudget:** `timeout-minutes: 15` (kein Vorgabewert aus dem Brief, eigene Einschätzung —
  Production-Build + drei Viewport-Projekte im Container ohne Docker-Layer-Cache).
- **Roten Lauf lesen:** zwei unterschiedliche Ursachen.
  - Ohne Label, eine echte Abweichung: der Job lädt zwei Artefakte hoch — `playwright-report-visual`
    (HTML-Report mit Differenzbildern) und `visual-diff-results` (`test-results/`, dieselben
    Differenzbilder als Rohdateien).
  - Mit Label `visual-update`: IMMER rot, absichtlich (siehe oben) — das Artefakt
    `visual-snapshots` enthält in diesem Fall die neuen Vorlagen, kein Differenzbild. Das
    Committen der neuen Vorlagen macht in jedem Fall der Controller, nicht der Workflow selbst.

## Visual Regression (Bildvergleiche)

Task T5 (`.superpowers/sdd/2026-09-24-testumgebung/task-T5-brief.md`). `toHaveScreenshot`-Tests
unter `tests/e2e/visual/*.visual.spec.ts` für acht Screens auf drei Breakpoints (Handy 390,
Tablet 768, Desktop 1280 — eigene Playwright-Projekte `visual-mobile`/`visual-tablet`/
`visual-desktop`, `playwright.config.ts`):

| Screen | Spec-Datei | Route |
|---|---|---|
| Dashboard | `dashboard.visual.spec.ts` | `/#/` |
| Wizard Schritt 1 (Stammdaten) | `wizard-step1.visual.spec.ts` | `/#/tournament/new` |
| Wizard letzter Schritt (Übersicht) | `wizard-overview.visual.spec.ts` | `/#/tournament/new?step=6` |
| Turnier-Admin (Dashboard-Kategorie) | `admin.visual.spec.ts` | `/#/tournament/:id/admin/dashboard` |
| Live-Cockpit (laufendes Spiel) | `cockpit-running.visual.spec.ts` | `/#/tournament/:id/live` |
| Monitor | `monitor.visual.spec.ts` | `/#/display/:id/:monitorId` |
| Öffentliche Turnierseite | `public-tournament-page.visual.spec.ts` | `/#/public/:id` |
| Login | `login.visual.spec.ts` | `/#/login` |

Macht 8 × 3 = 24 Vorlagen, wie im Plan vorgegeben.

**Fixrunde 1 (T5-Review, Ruling AD):** Der zweite Wizard-Screen war ursprünglich Schritt 5
("Teams"), das entsprach aber nicht der Plan-Absicht „erster und letzter Schritt" — der Wizard
hat 6 Schritte, der letzte ist „Übersicht" (Schritt 6). Datei entsprechend umbenannt
(`wizard-step5.visual.spec.ts` → `wizard-overview.visual.spec.ts`), alte Vorlagen aus
`__screenshots__` gelöscht.

**Noch nicht abgedeckt — eine echte Lücke (T5-Review, Ruling AE):** die Zuschauersicht
`/live/:shareCode` (`LiveViewScreen`, `src/screens/LiveViewScreen.tsx`) ist **kein** Bildvergleich-
Screen. `tests/e2e/visual/live-view.visual.spec.ts` hält das als `test.fixme` fest, mit
Begründung im Datei-Kommentar. Grund: `LiveViewScreen` braucht einen echten Supabase-Stack zur
Share-Code-Auflösung, der Visual-Job hat bewusst keinen (Ruling Y, Punkt 2 — „kein Supabase im
Container nötig"). Die „Öffentliche Turnierseite" (`/public/:tournamentId`,
`PublicTournamentViewScreen`) ist **nicht** derselbe Screen wie `/live/:shareCode` — eigener
State, eigene Komponente (`src/App.tsx:706-716`, Kommentar dort bestätigt die bewusste Trennung)
— und deckt diese Lücke deshalb NICHT ab, auch wenn sie oberflächlich ähnlich aussieht. (Der
ursprüngliche T5-Report hatte das fälschlich als „keine Lücke" behauptet — korrigiert in
Fixrunde 1.)

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
(`--update-snapshots=all`) rufen dafür `scripts/visual-in-container.sh compare`/`update` auf.

**Abschluss-Fixrunde (final-review.md, I1/Ruling AG):** Vorher lief im Container `npm run dev`
(kein Build) — anders als die CI, die per `npm run build` + `CI_E2E_USE_PREVIEW` (`vite preview`)
baut. Die Vorlagen stammen aus genau diesem Build, ein Dev-Server kann abweichendes CSS-Timing/
-Reihenfolge liefern und falsche Differenzen erzeugen. Gefixt: Build statt Dev-Server, mit
`CI=true` + `CI_E2E_USE_PREVIEW=1` (derselbe Build+Preview-Ablauf wie `visual.yml`) und leeren
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.

**Nach-Review (final-rereview.md, I-R1):** Der Fix aus der Abschluss-Fixrunde reichte nicht —
der damalige Bind-Mount (`-v "$(pwd):/work"`) machte `.env.local` im Container sichtbar, und Vite
lädt beim Build ALLE `VITE_*`-Variablen aus einer sichtbaren `.env.local`, nicht nur die beiden
Supabase-Werte, die die Docker-`-e`-Flags überschreiben. `.env.example` führt u. a.
`VITE_FF_ANON_AUTH`/`VITE_FF_OFFLINE`/`VITE_FF_LIMIT`/`VITE_FF_MERGE` aktiv und `VITE_SENTRY_DSN`
optional — ein lokal gesetztes `VITE_FF_LIMIT=true` hätte andere Vorlagen erzeugt als die CI
(sauberer Checkout ohne `.env.local`), ein gesetztes `VITE_SENTRY_DSN` sogar einen echten
PROD-Sentry-Report ausgelöst (die Visual-Fixtures setzen `errorTracking: true`).

Deshalb jetzt `scripts/visual-in-container.sh`: Das Repo wird **read-only** gemountet
(`-v "$REPO_ROOT:/src:ro"`), im Container entsteht daraus per `tar`-Kopie (kein Bind-Mount) eine
eigene Arbeitskopie unter `/work` — die Exclude-Muster `.env*`, `node_modules`, `dist`,
`test-results`, `playwright-report` lassen `.env*` dabei kategorisch aus der Kopie heraus,
unabhängig davon, was auf dem Host liegt. Dort laufen `npm ci`, der Build (mit `CI=true`,
`CI_E2E_USE_PREVIEW=1`, leeren `VITE_SUPABASE_*`) und die drei `visual-*`-Projekte. Im
Update-Modus kopiert das Skript am Ende nur die neuen Vorlagen aus
`/work/tests/e2e/visual/__screenshots__` in einen zweiten, beschreibbaren Mount
(`-v "$PWD/tests/e2e/visual/__screenshots__:/out"`) zurück — sonst verlässt nichts den Container.

`node_modules` lebt dadurch im eigenen Dateisystem des Containers (nicht mehr als Docker-Volume
nötig) — das Host-`node_modules` wird nie berührt, dafür macht jeder Lauf einen vollen `npm ci`.

**Weiterhin NICHT lokal ausgeführt** (Auftrag der Abschluss-Fixrunde, final-fix-brief.md: „Docker-
Platte voll, nichts löschen — nur sorgfältig prüfen und dokumentieren") — Skript und Doku sind
geprüft (`bash -n`, `shellcheck`, Kommandos, Env-Variablen, Mount-Syntax), aber nicht gegen den
echten Container ausgeführt. Ein CI-Lauf mit dem Label `visual-update` bleibt der Weg, um neue
Vorlagen zu erzeugen.

### Was stattdessen lokal (ohne Container) geprüft wurde

Ohne Container liefert derselbe Test andere Pixel (macOS-Font-Rendering) — die dabei erzeugten
Bilder dürfen deshalb nie die eingecheckten Vorlagen werden. `playwright.config.ts` liest dafür
`VISUAL_SNAPSHOT_DIR`: gesetzt, zeigt der Snapshot-Pfad auf ein beliebiges (temporäres)
Verzeichnis statt auf `tests/e2e/visual/__screenshots__`. So lässt sich lokal mit echtem
Chromium beweisen, dass Selektoren, Fixtures, Masken und `page.clock` funktionieren, ohne
Mac-Bilder einzuchecken. Ergebnis und Laufzeiten: siehe
`.superpowers/sdd/2026-09-24-testumgebung/task-T5-report.md`.

### Wartebedingung: lazy geladener Inhalt statt synchrones Chrome

Wiederkehrendes Flake-Muster (zuerst gefunden bei `admin.visual.spec.ts`/`visual-mobile`, dann im
T5-Review bei `wizard-step5` — jetzt `wizard-overview` — als unbehoben benannt, Issue #2): Wartet
ein Screenshot-Test auf einen Text, der SOWOHL in der sofort verfügbaren Navigations-/
Fortschritts-Chrome (Breadcrumb, `ProgressBar`-Step-Label) ALS AUCH im tatsächlichen,
lazy-geladenen Inhalt vorkommt, kann `.first()`/eine ungenaue Textsuche den Screenshot noch im
Lade-/Skeleton-Zustand erwischen — nicht zuverlässig bei jedem Lauf, sondern zufällig je nach
Timing. Deshalb: pro Screen entweder ein `data-testid`, das ausschließlich im echten Inhalt
existiert (z. B. `wizard-show-preview`, `match-timer-display`), oder eine rollen-eingeschränkte
Bedingung (`getByRole('heading', ...)`), die mit der Navigations-Chrome nicht kollidiert — nie
eine ungeschützte `getByText(...).first()` auf einen Text, der auch außerhalb des eigentlichen
Inhalts vorkommen könnte.

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
Element nicht, wird es einfach ignoriert): Toast-Container und Sync-Status-Badge
(`commonMasks()` in `helpers.ts`) — beide existieren als echte `data-testid`/`aria-label`-Ziele,
matchen auf den meisten der acht Screens aber 0 Elemente. Die QR-Code-Maske (`[data-testid="qr-code"]`)
ist demgegenüber **rein aspirational**: dieses Testid existiert nirgends im Repo (der QR-Code in
`src/components/dialogs/ShareDialog.tsx` hat keines) — Fund aus dem T5-Review (Issue #4),
Kommentar in `helpers.ts` entsprechend präzisiert.

### Datenquelle: Offline-Fixtures statt Supabase

Alle acht echten Screens laufen offline (IndexedDB-Fixtures über `seedIndexedDB`, wie die
bestehenden `tests/e2e/flows/*.spec.ts`). Für die Zuschauersicht gibt es zwei Routen mit
unterschiedlicher Datenquelle UND unterschiedlichem Screen (`src/core/routing/routeRegistry.ts`,
`src/App.tsx:706-716`):
- `/live/:shareCode` (`LiveViewScreen`) — braucht einen echten Supabase-Stack, eigenständige
  Komponente (Pull-to-Refresh, „Mein Team", Theme-Umschalter, eigene URL-Filter).
- `/public/:tournamentId` (`PublicTournamentViewScreen`) — rendert komplett aus IndexedDB, aber
  ein ANDERER, eigenständiger Screen (u. a. mit `ScheduleActionButtons` für Share/PDF).

**Korrektur (T5-Review, Fixrunde 1):** Diese beiden Routen sind NICHT austauschbar. Die
Visual-Specs decken deshalb nur `/public/:tournamentId` als eigenen Screen „Öffentliche
Turnierseite" ab (`public-tournament-page.visual.spec.ts`) — `/live/:shareCode` bleibt eine offen
benannte Lücke (`live-view.visual.spec.ts`, `test.fixme`), siehe Tabelle oben. Der ursprüngliche
Report hatte `/public/:tournamentId` fälschlich als vollwertigen Ersatz für `/live/:shareCode`
dargestellt.

Das Live-Cockpit braucht zusätzlich einen Eintrag in der `liveMatches-<tournamentId>`-
localStorage-Quelle (`src/hooks/useLiveMatches.ts`, getrennt vom IndexedDB-Turnier-Blob) — dafür
gibt es `seedRunningLiveMatch()` in `helpers.ts`, mit einem `timerStartTime` exakt 320s vor der
eingefrorenen Uhr statt eines echten Start-Klicks (deterministisch statt klick-zeitpunkt-
abhängig).

### Toleranz (`maxDiffPixelRatio`) und Vorlagen als Ist-Stand (Ruling AF, Beobachtungswoche)

`playwright.config.ts` setzt `expect.toHaveScreenshot.maxDiffPixelRatio: 0.01` global (1 % der
Pixel einer Seite) — pragmatische Ingenieurs-Entscheidung gegen Sub-Pixel-Antialiasing-Rauschen
zwischen zwei Container-Läufen, keine Brief-Vorgabe. Beim Cockpit auf dem Handy (`fullPage`, ca.
390×1320 px) erlaubt das rund 5.000 abweichende Pixel — eine kleine Farb- oder
Spielstand-Ziffernänderung kann darunter bleiben und würde den Vergleichslauf NICHT rot färben
(final-review.md, M8). Bis zur Entscheidung nach der Beobachtungswoche (Ruling AF) bleibt der Wert
bewusst so stehen; mittelfristige Alternativen: `maxDiffPixels` je Screen statt eines globalen
Anteils, oder Element-Screenshots statt `fullPage` auf dem Handy.

Die 24 eingecheckten Vorlagen halten den **Ist-Zustand** fest, nicht zwingend den gewünschten
Soll-Zustand — u. a. bekannt und von Daniel zu bewerten:
- **C-MON720:** Monitor-Desktop (1280×720) — die Spieluhr „05:20 / 10:00" überlappt die
  Teamnamen. Vorlage hält den Ist-Zustand fest; nach einem UI-Fix bewusst neu erzeugen
  (`npm run test:visual:update`, Label `visual-update`), nicht einfach als „falsch" markieren.
- Cockpit-Handy (`fullPage`): die fixe Bottom-Nav liegt mitten im Bild und verdeckt Knöpfe.
- Gleicher Spielstand nach 320 s zeigt Cockpit „04:40 / 10:00", Monitor „05:20 / 10:00" — sieht
  nach Countdown (Cockpit) gegen Hochzählen (Monitor) mit gleichem Zeit-Suffix aus, nicht
  geprüft.

## Nie tun

- `supabase link` in diesem Repo ausführen.
- `supabase db push` — das Projekt verwaltet Migrationen bewusst nicht über `db push`
  (siehe `supabase/migrations/README.md`, Abschnitt „Namensraum-Konflikt").
- `.env.local` lesen oder in ein Skript dieser Testumgebung einbauen — die Testumgebung ist
  komplett unabhängig von der Produktionskonfiguration.
