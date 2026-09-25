# Paket „Testumgebung“: Oberfläche gegen eine echte, lokale Datenbank testen

> ⏸ **Nach Freigabe auf „go“ warten.** Subagent-driven. Briefs je Task, nie der ganze Plan.
> Ledger: `.superpowers/sdd/2026-09-24-testumgebung/progress.md`

## Context

Daniel möchte in der Entwicklung prüfen können, „ob alles auch auf der Oberfläche so funktioniert wie
angedacht“.

**Ist-Stand, erhoben am 24.09.:**
- 219 Playwright-Tests je Viewport, 18 Spec-Dateien.
- **Alle laufen ohne Datenbank.** Die CI setzt keine Supabase-Variablen, die App läuft im reinen
  Offline-/Gastmodus, und dort gilt jeder Nutzer als „Eigentümer“. Daten entstehen nur per
  IndexedDB-Seeding (`tests/e2e/helpers/test-fixtures.ts`).
- **Lokal gefährlich:** `playwright.config.ts` hat keinen `env`-Block. `npm run dev` liest `.env.local`,
  ein lokaler E2E-Lauf spricht also mit der **Produktion**. So entstanden die 357 „E2E Verify“-Turniere.

**Auf der Oberfläche praktisch ungetestet:**
- echter Login und Registrierung
- Cloud-Sync und offline→online
- Realtime zwischen Geräten (Cockpit → Monitor/zweites Gerät)
- Public View `/live/:shareCode`
- **alle Rollen außer Eigentümer**
- Einladungen
- visuelle Regression (es gibt keinen einzigen `toHaveScreenshot`)

**Ziel:** Ein Befehl startet eine vollständige lokale Kopie der Cloud (Datenbank, Anmeldung, Realtime,
API, Mail-Postfach). Ein zweiter befüllt sie mit Testnutzern und Testturnieren. Playwright spielt damit
echte Abläufe mit mehreren Personen und Geräten durch, lokal und in der CI, **ohne die Produktion je zu
berühren**. Dazu kommen Bildvergleiche der wichtigsten Screens.

**Werkzeug-Entscheidung (Recherche 24.09., Doku Supabase/Playwright):** Playwright bleibt. Es kann
mehrere angemeldete Browser-Kontexte in einem Test halten, das passt genau zum Turniertag mit mehreren
Geräten. Der lokale Stack ist `supabase start` (CLI 2.67.1 ist installiert, Docker läuft mit 8 GB).
Vitest bleibt für Logik und Komponenten; der Browser-Modus ist ein späterer Schritt.

## Die Testnutzer und Testdaten (T2)

Alle Nutzer melden sich per **E-Mail und Passwort** an (`signInWithPassword`). Die Konten gibt es nur im
lokalen Stack. Passwörter und Schlüssel sind die öffentlich bekannten lokalen Standardwerte, keine
Geheimnisse, und landen nie in der Produktion.

| Kennung | E-Mail (lokal) | Rolle im Turnier „Live-Cup“ | Zweck |
|---|---|---|---|
| `owner` | owner@test.local | Eigentümer | Verwaltet alles, legt Turniere an |
| `coadmin` | coadmin@test.local | co-admin (angenommen) | Einstellungen, Spielplan umbauen, kein Löschen |
| `helper` | helper@test.local | collaborator (angenommen) | Tore/Ereignisse eintragen, Teams ändern |
| `trainer` | trainer@test.local | trainer (angenommen, Team A) | nur lesen |
| `viewer` | viewer@test.local | viewer (angenommen) | nur lesen |
| `revoked` | revoked@test.local | co-admin, **widerrufen** | darf nichts mehr sehen |
| `invitee` | invitee@test.local | offene Einladung (co-admin) | Einladung annehmen |
| `stranger` | stranger@test.local | kein Mitglied, eigenes Turnier „Fremd-Cup“ | Angreifer-Sicht |
| (anonym) | – | – | Zuschauer ohne Konto, Monitor |

**Testturniere** (Eigentümer `owner`, außer „Fremd-Cup“):

| Turnier | Zustand | Wofür |
|---|---|---|
| **Live-Cup** | privat, Gruppenphase läuft, 8 Teams, 1 Spiel `RUNNING`, Mitarbeiter wie oben | Cockpit, Rollen, Realtime |
| **Public-Cup** | veröffentlicht, Share-Code fest (z. B. `E2EPUB`), einige Ergebnisse | Public View, Monitor anonym |
| **Entwurf-Cup** | Entwurf, privat | darf nirgends öffentlich erscheinen |
| **Fremd-Cup** | Eigentümer `stranger`, privat | Angriffe über ein fremdes Turnier |

Dazu Einladungen im Zustand gültig, widerrufen und abgelaufen, und ein Monitor im Public-Cup.

**Reset:** Ein Befehl setzt die Datenbank vor jedem Lauf auf genau diesen Stand zurück, deterministisch
mit festen IDs.

## Tasks

### T1: Lokaler Stack aus unseren Migrationen

- `supabase init`: `supabase/config.toml` (Projekt-ID lokal, Ports, Auth ohne E-Mail-Bestätigung,
  Mailpit/Inbucket an, Realtime an).
- **Migrationen einspielen:** Die älteren Dateien lassen sich nicht von Null neu einspielen (3
  Policy-Kollisionen, laut `supabase/migrations/README.md`). Maßgeblich sind Baseline plus die neueren
  Migrationen, dieselbe Logik wie `scripts/rls-role-matrix.sh`/`db-drift-check.sh`.
  - Empirisch klären, ob `config.toml` eine Dateiliste zulässt (`[db.migrations] schema_paths`).
  - Sonst: automatisches Einspielen abschalten, eigenes `scripts/local-db-apply.sh` nach dem
    `supabase start`. Diese Entscheidung ist Teil des Tasks, mit Begründung.
- **Neue Migration `on_auth_user_created`:** Der Trigger auf `auth.users` fehlt in der Baseline, der
  Dump umfasste nur `public`. Ohne ihn bekommen Testnutzer kein Profil. Live existiert er, dort ist die
  Migration ein No-op (`CREATE OR REPLACE TRIGGER`). Sie schließt zugleich die Lücke der
  Rekonstruierbarkeit. **Produktions-DDL, Daniel sieht sie vorher.**
- Edge Function `validate-registration-code` lokal bereitstellen (`supabase functions serve` oder in
  `start` enthalten) mit lokalem `REGISTRATION_CODE`.
- npm-Skripte: `test:env:up`, `test:env:down`, `test:env:reset`. Kurze Anleitung
  `docs/TESTUMGEBUNG.md`.
- **Nachweis:** Aus dem Nichts `test:env:up` → Schema identisch zur Baseline-Rekonstruktion, 14
  RLS-Tabellen, `role_permissions` = JSON (Gleichlauf-Abfrage aus dem Drift-Check wiederverwenden).

### T2: Testnutzer und Testturniere per Knopfdruck

- `scripts/e2e-seed.ts` über die Admin-API (Service-Role des **lokalen** Stacks):
  - Nutzer anlegen.
  - Turniere, Teams und Spielpläne **über die Repository-/Mapper-Schicht der App** erzeugen, damit
    Fixtures und Produktformat nicht auseinanderlaufen.
  - Mitgliedschaften, Einladungen, Share-Code, Monitor anlegen.
  - Idempotent: `db reset` + Seed ≤ 60 s.
- Die IDs und Zugangsdaten als exportierte Konstanten in `tests/e2e/cloud/testData.ts`, eine Quelle für
  Seed und Tests.
- **Sicherung gegen Produktion:** Das Seed-Skript bricht ab, wenn die URL nicht `127.0.0.1`/`localhost`
  ist. Ein Test belegt das.

### T3: Playwright zweigeteilt, die Produktion ausgesperrt

- **Zwei Webserver** in `playwright.config.ts`:
  - **offline** (Port 3000): `VITE_SUPABASE_URL=''` und Key leer, **explizit gesetzt**. Vite gibt
    Prozess-Variablen Vorrang vor `.env.local`, damit ist das Produktionsrisiko geschlossen. Das muss
    im laufenden Test belegt werden (`isSupabaseConfigured === false`).
  - **cloud** (Port 3100): URL und Anon-Key des lokalen Stacks.
- Die bestehenden 219 Tests laufen unverändert als Projektgruppe „offline“. Neue Tests liegen in
  `tests/e2e/cloud/`.
- **Setup-Projekt je Rolle:** Einmal per Oberfläche anmelden (`login-email-input` usw.), die
  Anmeldung als `storageState` speichern. Die App hält die Session im localStorage.
- **App-seitige Testbarkeit, kleine Änderungen:**
  - `SyncStatusBar` bekommt `data-testid="sync-status"` mit `data-state` und `data-pending`. Ein Helper
    `waitForSync(page)` wartet auf `idle`/0.
  - `data-testid` für die rollenrelevanten Elemente: Löschen-Bereich (DangerZone), Einladen-Knopf,
    Mitgliederliste, RoleBadge, InviteAcceptScreen, InviteDialog.
  - Keine Test-Hooks im Produktionscode, keine `window.__…`.

### T4: Echte Abläufe auf der Oberfläche

Je Ablauf ein Spec in `tests/e2e/cloud/`, auf Desktop und Handy:
1. **Anmelden/Abmelden** mit Passwort, falsches Passwort, „Passwort vergessen“: Die Reset-Mail kommt
   im lokalen Postfach an (Mailpit-API). Der Google-Hinweis erscheint für ein OAuth-Testkonto.
2. **Rollen-Sichtprüfung:** Je Rolle Dashboard, Turnier-Admin und Cockpit öffnen. Geprüft wird, was
   sichtbar, bedienbar oder gesperrt ist, nach `rolePermissions.json` erzeugt, **nicht handgeschrieben**.
   Dazu `revoked` und `stranger` sehen das Turnier nicht.
3. **Zwei Geräte, ein Spiel:** `helper` trägt im Cockpit ein Tor ein. Der Monitor (anonym) und das
   Gerät von `owner` zeigen es ohne Neuladen. Das Ereignis löschen verschwindet überall.
4. **Offline → online:** `helper` geht offline, trägt zwei Tore ein, geht online. `waitForSync`, danach
   sieht `owner` beide Tore.
5. **Public View:** `/live/E2EPUB` anonym zeigt den Stand. Entwurf-Cup und privater Cup sind
   unerreichbar.
6. **Veröffentlichen durch Co-Admin:** Sponsoren und Monitor folgen.

**Nicht in diesem Paket:** Einladen und Spielende durch Helfer sind kaputt (I1, H2a). Die zugehörigen
Tests entstehen im Paket „Helfer beendet Spiel“ zuerst rot (TDD), mit genau dieser Umgebung.

### T5: Bildvergleiche

- `toHaveScreenshot` für die wichtigsten Screens: Dashboard, Wizard (Schritt 1 und 5), Turnier-Admin,
  Cockpit (laufendes Spiel), Monitor, Public View und Login. Je auf Handy (390), Tablet (768) und
  Desktop (1280), also rund 24 Vorlagen.
- **Immer im offiziellen Playwright-Docker-Image**, lokal (`npm run test:visual`) wie in der CI. Sonst
  weichen Schriften zwischen Mac und Linux ab. `npm run test:visual:update` aktualisiert die Vorlagen
  bewusst.
- Abdecken (`mask`/`stylePath`): Spieluhr, Monitor-Timer, Pixel-Shift des Monitors (im Test per Zeit
  einfrieren: `page.clock`), „vor X Min.“, Datum, QR- und Share-Codes, Toasts.
- Die Vorlagen werden eingecheckt. Abweichungen erscheinen im HTML-Report als Differenzbild.

### T6: CI

- Neuer Job `e2e-cloud`: `supabase/setup-cli`, `supabase start` (Docker ist auf den GitHub-Runnern
  vorhanden), Migrationen, Seed, cloud-Projekte auf Desktop und mobile-md. Zeitbudget ≤ 12 min.
- Neuer Job `visual`: im Playwright-Container. Artefakt mit Differenzbildern bei Fehlschlag.
- Beide zunächst **nicht als Pflicht-Check** in der Branch-Protection: eine Woche beobachten, ob sie
  stabil sind. Danach Pflicht. Daniel entscheidet.
- `scripts/rls-role-matrix.sh` zusätzlich in die CI (heute nur lokal): läuft bei PRs mit Änderungen an
  Migrationen.

### T7: Vitest 5 (Dependabot #196 + #198 zusammen)

- `vitest` und `@vitest/coverage-v8` gemeinsam auf 5 anheben, Brüche beheben. Beide PRs danach
  schließen.
- Browser-Modus nur **prüfen und bewerten**, nicht einführen. Ergebnis als Empfehlung im Report.


### T7b: Vitest-Einstellungen ausreizen (nach T1, vor T2)

Daniels Wunsch (24.09.). Dafür in beide Richtungen messen: Laufzeit, Testzahl und welche Tests rot werden.
- **Vitest-Projects:** Logik-Tests laufen in `node`, nur Komponenten- und Hook-Tests in `jsdom`. Vitest
  meldete, dass jsdom 107-mal neu erzeugt wird, das sind 63 % der Laufzeit. Die Testzahl muss gleich
  bleiben.
- **`clearMocks: true`** (die neue Voreinstellung von Vitest 5, in T7 bewusst zurückgedreht). Jeden
  roten Test einzeln erklären: hing er von übrig gebliebenen Mock-Zuständen ab? Den Test reparieren,
  nicht die Einstellung.
- **Coverage-Baseline** messen und als Untergrenze setzen, knapp unter dem Ist-Wert. Den Wert in
  `docs/TODO.md` nennen, sobald dort keine fremden Änderungen mehr liegen, sonst im Report.
- `pool: 'vmThreads'` / `isolate: false` **nur nach Messung** und nur, wenn die Tests nachweislich
  unabhängig bleiben.

## Reihenfolge und Abhängigkeiten

```
T7 ▸ T1 ▸ T7b ▸ T2 ▸ T3 ▸ T4 ▸ T5 ▸ T6
```

T1 enthält die einzige Produktions-DDL (Trigger, live ein No-op), mit Freigabe durch Daniel.

## Regeln (tragend)

- **Die Produktion wird nie berührt:** kein Test, kein Seed, kein Skript gegen die Live-URL. Harte
  Abbrüche statt Hoffnung.
- Jeder neue Test wird zuerst ROT gesehen: Guard, Selektor oder Erwartung kaputt machen, dann
  wiederherstellen.
- Die erwarteten Rechte werden aus `rolePermissions.json` erzeugt, nicht dupliziert.
- Nie stagen: `.serena/project.yml`, `.claude/commands/coherence-review.md`, `_starter-packs/`,
  `docs/TODO.md` (fremd). `docs/` ist gitignored, neue Dateien brauchen `git add -f`.
- Commit-Trailer: das orchestrierende Modell.

## Verifikation

| # | Prüfung | Erwartung |
|---|---|---|
| 1 | `test:env:up` auf leerem Rechner | Stack läuft, Schema = Baseline-Rekonstruktion, Gleichlauf grün |
| 2 | `test:env:reset` zweimal hintereinander | identischer Stand, ≤ 60 s |
| 3 | offline-Projekt mit vorhandener `.env.local` | `isSupabaseConfigured === false`, kein Request an `*.supabase.co` (per Netzwerk-Mitschnitt belegt) |
| 4 | Seed gegen eine Nicht-localhost-URL | bricht ab |
| 5 | Rollen-Spec | jede Zeile der Rechtetabelle auf der Oberfläche geprüft, Mutation in JSON → rot |
| 6 | Zwei-Geräte-Spec | Tor erscheint auf dem Monitor ohne Reload |
| 7 | Visual in Docker zweimal | stabil grün, gezielte CSS-Änderung → rot mit Differenzbild |
| 8 | CI | e2e-cloud und visual grün, Laufzeit notiert |
| 9 | bestehende 219 Tests je Viewport | unverändert grün |
