# Testing & Device Compatibility Guide

> **Datei:** `.claude/workflows/TESTING.md`
> **Erstellt:** 2025-12-29
> **Zweck:** E2E-Tests, Device Compatibility, Usability Testing - ALLES IN EINER DATEI

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│  TEST-BEFEHLE                                                   │
├─────────────────────────────────────────────────────────────────┤
│  npm test                    │ Unit Tests (Vitest)              │
│  npm run test:e2e            │ E2E Tests (alle Devices)         │
│  npm run test:e2e:mobile     │ Nur iPhone + Pixel               │
│  npm run test:e2e:headed     │ Mit sichtbarem Browser           │
│  npm run test:a11y           │ Accessibility Tests              │
│  npm run test:scenarios      │ Szenarien, Verweis-Pflicht       │
└─────────────────────────────────────────────────────────────────┘
```

---

# Teil 0: Anforderung, Test, Defekt

> Gilt für jede Testdatei unter `src/`, `tests/` und `scripts/`. Die Prüfung läuft in der CI
> (`npm run test:scenarios -- --base origin/main`) und lokal mit demselben Befehl.

## 0.1 Kennung im Testnamen

- Ein Test belegt ein Szenario, wenn seine **Kennung im Testnamen** steht: `it('@SL-034 Grenze 3: das 3. Foul meldet einen Hinweis', …)`.
  Gezählt werden Namen von `it`/`test`/`describe`/`test.step` und `each`-Tabellen, nie Kommentare oder andere Strings.
- **Regulär** heißt: ein Test, der in der CI wirklich läuft und grün sein muss. Nicht regulär sind `skip`, `todo`, `fixme`,
  `it.fails`/`test.fail` am Aufruf und alles darin sowie unbedingte Markierungen im Rumpf (`test.fail()`, `test.skip()`). Bedingte
  Rumpf-Aufrufe wie `test.fail(cond, …)` und `test.skip(cond, …)` bleiben regulär und zählen „mit Test“. Nur reguläre Tests zählen als „mit Test“.
- `@XX-nnn:teil` im Namen heißt **teilweise** abgedeckt (eigene Spalte, zählt nicht als „mit Test“).

## 0.2 Markierung „erwartet rot“ nur mit Verweis

Zeigt ein Test einen bekannten Fehler (Beobachtung aus der Anforderung, die der Code noch verletzt), wird er **nicht an den Code
angepasst**, sondern als „erwartet rot“ markiert und nennt im Namen den Befund oder Defekt:

```ts
// Vitest: Verweis im Testnamen oder im Namen eines umgebenden describe
it.fails('@SL-034 @DF-001 Grenze 3: das 3. Foul meldet einen Hinweis', () => { … });
describe('Offen C-KONTRAST-TEXTPAARE: Text-Paare unter 4,5 : 1', () => { it.fails('hell: Schrift auf Fläche', () => { … }); });

// Playwright: Verweis in der Begründung (2. Argument) oder im Testnamen
test.fail(testInfo.project.name === 'tablet-portrait', 'Befund C-COCKPIT-TABLET-OHNE-PROTOKOLL');
```

- **Markierung** ist `it.fails`/`test.fail('Titel', fn)` am Aufruf oder jedes `test.fail(…)`/`testInfo.fail(…)` im Rumpf, bedingt oder
  unbedingt (auch `test.info().fail()`). Für die Verweis-Pflicht zählt also auch das bedingte `test.fail(cond, …)` als Markierung, obwohl der
  Test regulär bleibt. `skip`/`fixme`/`todo` brauchen keinen Verweis.
- **Schreibweisen des Verweises:** `@DF-001` oder `DF-001` (genau drei Ziffern) oder eine Befund-Kennung `C-…` in Großbuchstaben
  (`C-COCKPIT-TABLET-OHNE-PROTOKOLL`). Nicht gültig: `@DF-01`, `@DF-0012`, `B-51b`, `F-B13-4`, `C-Jugend`. Ein Verweis nur im Kommentar zählt nicht.
- **Ratsche:** Die Zahl der Markierungen ohne Verweis darf nicht größer sein als auf `main` (Verschieben zählt nicht als Zuwachs);
  die Meldung nennt die neuen Tests. Sinkt die Zahl, ist die Prüfung grün und meldet es.
- **Unbekannter Verweis ist lokal sofort rot**, auch in regulären Tests (Tippfehler, @TA-024): `npm run test:scenarios` prüft gegen die
  lokale Befundliste (`docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md`, aus Arbeitskopien über das Hauptrepo; `--befunde <pfad>`).
  In der CI fehlt die Liste: dort zählt nur die Schreibweise (@TA-023). Deshalb fährt jeder Review den lokalen Lauf.

## 0.3 Selbst-Auflösung

Wird der Fehler behoben, schlägt der Lauf fehl („Expect test to fail“). Dann die **Markierung entfernen**; der Verweis bleibt im Namen als
Spur. Der Test zählt ab dann als regulärer Test für seine Kennung.

## 0.4 Beobachtung, Defekt, Stationen

Beobachtung (`C-…` in der Befundliste, lokal) → bei Bestätigung ein Defekt → eingeplant → in Arbeit → behoben. In Teil 1 ist die Station
eine Spalte der Befundliste; eine eigene Defekt-Datei je `DF-nnn` ist Teil 2. Neue Zeilen in der Befundliste trägt die Projektleitung ein,
nicht der Umsetzer: ein Umsetzer schlägt sie vor und lässt den Test bis dahin „ohne Verweis“.

## 0.5 Liste der bekannten Kennungen und Untergrenze

```bash
node scripts/mvp-kennungen-erzeugen.mjs --repo <Hauptrepo>                    # MVP-Kennungen aus den Anforderungen neu erzeugen
node scripts/scenario-tests.mjs --floor-schreiben                             # Untergrenze auf den gemessenen Stand, nie von Hand
```

- Eine Liste der bekannten Befund-Kennungen gibt es im Repo nicht mehr (Konflikte bei fast jedem Paket, Daniel 30.10.).
- **Untergrenze** am Paketende nachziehen (`--floor-schreiben`, nach der MVP-Liste), nie senken.

## 0.6 Datenwege

| Objekt | liegt | geprüft von |
|---|---|---|
| Szenario `@XX-nnn` | Anforderungs-Record (lokal) | `mvp-kennungen.json` (Auszug im Repo), CI |
| Beobachtung / Befund `C-…`, `DF-nnn` | Befundliste (lokal) | `scenario-tests.mjs` lokal (bekannt?), CI nur Schreibweise |
| Test | `src/`, `tests/`, `scripts/` | Vitest/Playwright, `scenario-tests.mjs` |
| Untergrenze | `tests/meta/szenario-floor.json` | `scenario-tests.mjs` |
| Aufgaben, Briefe, Proben | lokal | Review |
| Lokal vs. Repo | Records und Befundliste nur lokal; die CI sieht nur die erzeugten Auszüge | |

## 0.7 Vor dem Hochladen: Prüfung wie die CI (`.husky/pre-push`, @TA-019, @TA-020)

`git push` startet `scripts/vor-push/vor-push.mjs`. Es holt `origin/main`, führt den hochzuladenden Commit damit zusammen
(nur im Objektspeicher, `git merge-tree`; Arbeitsbaum, Index und Branch bleiben unberührt) und prüft das Ergebnis in einer
temporären Arbeitskopie ohne `.env.local`: Token- und Terminologie-Gleichlauf, Lint, Build, `test:scenarios --base origin/main`,
den Härtetest der visuellen Messung (nur bei Änderungen an App oder `scripts/visual-metrics/`) und die Playwright-Specs der
geänderten Bereiche im Projekt `desktop` ohne Datenbank (Vorschau des Builds, freier Port, kein Server auf 3000/3100).
Die Ausgabe nennt je Spec den Grund der Auswahl (`scripts/vor-push/auswahl.mjs`) und am Ende die Dauer je Schritt.

- **Konflikt mit `origin/main`:** Abbruch mit den Dateien; `git merge origin/main` (kein Rebase), lösen, erneut pushen.
- **Abhängigkeiten:** Passen die installierten `node_modules` nicht zur `package-lock.json` des geprüften Stands, bricht der
  Hook mit „npm ci“ ab (nie mit fremden Abhängigkeiten prüfen).
- **Zeitgrenze:** je Schritt fest; Playwright `VOR_PUSH_E2E_MINUTEN` (Standard 15), Abruf des Hauptzweigs
  `VOR_PUSH_FETCH_SEKUNDEN` (Standard 60, sonst „nicht erreichbar“). Überschreiten bricht mit Schritt und Grenze ab.
- **Strg-C / Terminal zu:** beendet den laufenden Schritt samt Unterprozessen und räumt die Arbeitskopie weg; liegen
  gebliebene `vor-push-*` älter als 6 h räumt der nächste Start auf.
- **Ohne Prüfung:** Branch auf dem Server löschen, Tags, ein Stand ohne neue Commits gegenüber `origin/main`.
- **Sicherungs-Push (@TA-025):** `VOR_PUSH_MODUS=sicherung git push origin HEAD:sicherung/<name>` – nur für Branches
  `sicherung/…`. Konflikt nur als Warnung, geprüft werden nur Lint und Typen; Ausgabe „SICHERUNG – nicht geprüft wie die
  CI“, Eintrag in `.git/vor-push-sicherung.log`. Für den PR danach normal pushen.
- `--no-verify` ist nie nötig und bleibt verboten.

### Main-Ampel (Stopp-Regel, @TA-022)

Nach jedem Merge laufen die Pflicht-Prüfungen auf `main`. `scripts/main-ampel.mjs` (Workflow `main-ampel.yml`) setzt auf
jedem offenen PR den Status „Main-Ampel (Stopp-Regel)“: rot, solange eine Pflicht-Prüfung der Branch-Regel auf `main` rot
ist; das Label `main-reparatur` lässt einen Reparatur-PR durch. Bei Rot auf `main`: nichts weiter mergen, zuerst reparieren.

## 0.8 Warten auf den Zustand, nicht auf die Zeit (@TA-021)

- Nach einer Aktion auf das erwartete Element oder den erwarteten Zustand warten (`findBy…`, `waitFor`, Playwright-`expect`),
  nie auf eine feste Zeit. Abwesenheit („kein Endstand“) erst prüfen, wenn die Antwort, von der sie abhängt, verarbeitet ist –
  sonst ist die Prüfung grün, ohne etwas zu prüfen.
- Zeitbezüge in E2E (`page.clock`) relativ zu einem Zeitpunkt der Seite nehmen (z. B. `Date.now()` der Seite nach dem Anpfiff),
  nie relativ zum Laden der Testdatei.
- Ein höheres Zeitlimit nur mit Begründung im Code (welche echte Wartezeit, gemessen wie lange). Teure Durchläufe (Dateibaum)
  lieber in einem nativen Aufruf (`git grep`) als die Grenze anzuheben.
- Nachweis je Fix: dreimal parallel unter Last grün und Mutationsprobe rot.

---

# Teil 1: E2E-Testing mit Playwright

## 1.1 Setup

### Installation
```bash
npm install -D @playwright/test @axe-core/playwright
npx playwright install
```

### NPM Scripts (package.json)
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:mobile": "playwright test --project='iPhone 13' --project='Pixel 5'",
    "test:e2e:desktop": "playwright test --project='Desktop Chrome'",
    "test:a11y": "playwright test tests/e2e/usability/accessibility.spec.ts"
  }
}
```

### Ordnerstruktur
```
tests/e2e/
├── flows/              # User Flow Tests
├── usability/          # Touch Targets, A11y, Keyboard
├── device-compat/      # Device-spezifische Tests
├── fixtures/           # Test-Daten
└── helpers/            # Wiederverwendbare Funktionen
```

### Playwright Config (playwright.config.ts)
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'iPhone 13', use: { ...devices['iPhone 13'], hasTouch: true } },
    { name: 'Pixel 5', use: { ...devices['Pixel 5'], hasTouch: true } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 1.2 data-testid Konvention

### Schema
```
[bereich]-[element]-[qualifier]
```

### Pflicht-Attribute

| Komponente | data-testid |
|------------|-------------|
| Timer | `match-timer-display` |
| Score | `score-display`, `score-home`, `score-away` |
| Goal Buttons | `goal-button-home`, `goal-button-away` |
| Start/Pause/End | `match-start-button`, `match-pause-button`, `match-end-button` |
| Dialoge | `dialog-goal`, `dialog-card`, `dialog-confirm-button`, `dialog-cancel-button` |
| Navigation | `nav-tab-schedule`, `nav-tab-standings`, `nav-back-button` |
| Listen | `tournament-card-{id}`, `match-card-{index}`, `team-row-{index}` |
| Wizard | `wizard-step-{n}`, `wizard-next-button`, `wizard-back-button` |
| Inputs | `input-tournament-name`, `input-team-name-{index}` |
| Monitor Display | `monitor-error-state`, `monitor-error-message`, `monitor-no-slides-state`, `monitor-no-slides-message`, `monitor-pause-indicator` |

### Regeln
- ✅ Jedes interaktive Element MUSS data-testid haben
- ❌ NIEMALS CSS-Klassen als Selektoren
- ❌ NIEMALS DOM-Struktur-basierte Selektoren

## 1.3 Test-Pattern (GIVEN/WHEN/THEN)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature: [Name]', () => {
  test('[User Story]', async ({ page }) => {
    // GIVEN - Ausgangszustand
    await page.goto('/');

    // WHEN - User-Aktionen
    await page.getByTestId('button-name').click();

    // THEN - Erwartetes Ergebnis
    await expect(page.getByTestId('result')).toBeVisible();
  });
});
```

## 1.4 Best Practices (Playwright)

### Zuverlässige Selektoren (Priorität)

1. **`getByTestId()`** - Bevorzugt! Stabil und unabhängig von UI-Änderungen
2. **`getByRole()`** - Für Accessibility-relevante Elemente
3. **`getByText()`** - Nur für statischen Text, kein dynamischer Content

```typescript
// ✅ GUT - data-testid
await expect(page.getByTestId('monitor-error-message')).toBeVisible();

// ⚠️ OKAY - Role + Name
await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();

// ❌ SCHLECHT - CSS Selektoren, DOM-Struktur
await expect(page.locator('.error-message')).toBeVisible();
await expect(page.locator('div > span:first-child')).toBeVisible();
```

### Auto-Wait nutzen (keine manuellen Waits)

```typescript
// ✅ GUT - Playwright wartet automatisch
await expect(page.getByTestId('result')).toBeVisible({ timeout: 10000 });

// ❌ SCHLECHT - Manuelle Timeouts
await page.waitForTimeout(3000);
await expect(page.getByTestId('result')).toBeVisible();
```

**Ausnahme:** `waitForTimeout` nur bei Keyboard-Events oder Animationen:
```typescript
// Keyboard-Focus braucht kurze Pause
await page.waitForTimeout(500);
await page.keyboard.press('Space');
```

### Seed-Fixtures für localStorage

```typescript
// tests/e2e/helpers/test-fixtures.ts
export const test = base.extend<TestOptions>({
  seedLocalStorage: async ({ page }, use) => {
    const seedFn = async (data: Record<string, unknown>) => {
      await page.goto('/');
      await page.evaluate((data) => {
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      }, data);
      await page.reload();
    };
    await use(seedFn);
  },
});
```

### Praxis-Beispiel (Monitor Display Tests)

```typescript
// Component: data-testid Attribute hinzufügen
<div data-testid="monitor-error-state">
  <div data-testid="monitor-error-message">{error}</div>
</div>

<div data-testid="monitor-no-slides-state">
  <div data-testid="monitor-no-slides-message">Keine Slides konfiguriert.</div>
</div>

{isPaused && <div data-testid="monitor-pause-indicator">⏸ Pausiert</div>}

// Test: getByTestId verwenden
test('zeigt Fehler bei ungültiger Tournament-ID', async ({ page }) => {
  await page.goto('/display/invalid-tournament/monitor-1');
  await expect(page.getByTestId('monitor-error-message')).toBeVisible({ timeout: 10000 });
});
```

### Quellen

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators](https://playwright.dev/docs/locators)

---

# Teil 2: Device Compatibility

## 2.1 Kritische Mobile-Issues

### Issue 1: iOS 100vh Bug
**Problem:** `100vh` ist größer als sichtbarer Bereich (Browser-UI wird mitgerechnet)

**Lösung:**
```css
.fullscreen {
  height: 100dvh; /* Dynamic Viewport Height */
}
/* Fallback */
.fullscreen {
  height: 100vh;
  height: 100dvh;
}
```

**Test:**
```typescript
test('Footer ist sichtbar', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByTestId('app-footer');
  await expect(footer).toBeInViewport();
});
```

---

### Issue 2: iOS Input Auto-Zoom
**Problem:** iOS zoomt bei Inputs mit `font-size < 16px`

**Lösung:**
```css
input, select, textarea {
  font-size: 16px; /* Minimum! */
}
```

**Test:**
```typescript
test('Inputs haben min. 16px', async ({ page }) => {
  await page.goto('/wizard/step-1');
  const inputs = await page.locator('input, select, textarea').all();
  
  for (const input of inputs) {
    const fontSize = await input.evaluate(el => 
      parseFloat(window.getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  }
});
```

---

### Issue 3: Safe Area / Notch
**Problem:** Content unter Notch/Home Indicator versteckt

**Lösung:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
```css
.header { padding-top: env(safe-area-inset-top, 0); }
.footer { padding-bottom: env(safe-area-inset-bottom, 0); }
```

**Test:**
```typescript
test('Viewport Meta korrekt', async ({ page }) => {
  await page.goto('/');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  
  expect(viewport).toContain('viewport-fit=cover');
  expect(viewport).not.toContain('user-scalable=no'); // Accessibility!
});
```

---

### Issue 4: 300ms Tap Delay
**Problem:** App fühlt sich langsam an

**Lösung:**
```css
button, a, [role="button"] {
  touch-action: manipulation;
}
```

**Test:**
```typescript
test('Buttons haben touch-action', async ({ page }) => {
  await page.goto('/');
  const buttons = await page.locator('button').all();
  
  for (const btn of buttons) {
    const touchAction = await btn.evaluate(el => 
      window.getComputedStyle(el).touchAction
    );
    expect(['manipulation', 'pan-x pan-y']).toContain(touchAction);
  }
});
```

---

### Issue 5: Touch Targets zu klein
**Problem:** Fehltaps bei kleinen Buttons

**Standard:** Min. 44×44px (WCAG), Primary 56×56px

**Test:**
```typescript
test('Buttons min. 44px', async ({ page }) => {
  await page.goto('/');
  const buttons = await page.locator('button:visible').all();
  
  for (const btn of buttons) {
    const box = await btn.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});
```

---

## 2.2 Viewport Meta (Korrekt)

```html
<meta 
  name="viewport" 
  content="width=device-width, initial-scale=1, viewport-fit=cover"
>
```

| ✅ Erlaubt | ❌ Verboten (Accessibility!) |
|-----------|------------------------------|
| `width=device-width` | `user-scalable=no` |
| `initial-scale=1` | `maximum-scale=1` |
| `viewport-fit=cover` | |

---

## 2.3 PWA Meta Tags

```html
<meta name="theme-color" content="#1A1A2E">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/manifest.json">
```

---

# Teil 3: Usability Tests

## 3.1 Accessibility (axe-core)

```typescript
import AxeBuilder from '@axe-core/playwright';

test('Keine A11y Violations', async ({ page }) => {
  await page.goto('/');
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  
  expect(results.violations).toEqual([]);
});
```

## 3.2 Keyboard Navigation

```typescript
test('Tab-Navigation funktioniert', async ({ page }) => {
  await page.goto('/');
  
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(['BUTTON', 'A', 'INPUT']).toContain(focused);
});

test('Escape schließt Dialog', async ({ page }) => {
  await page.goto('/tournament/test/match/1');
  await page.getByTestId('goal-button-home').click();
  
  await expect(page.getByTestId('dialog-goal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dialog-goal')).not.toBeVisible();
});
```

---

# Teil 4: CI/CD Integration

## GitHub Actions (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --run --coverage

  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        project: ['iPhone 13', 'Pixel 5', 'Desktop Chrome']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --project="${{ matrix.project }}"
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.project }}
          path: playwright-report/

  build:
    needs: [unit-tests, e2e-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

---

# Teil 5: Checklisten

## 5.1 Neue UI-Komponente

```
□ data-testid hinzugefügt (nach Konvention)
□ Touch Target ≥44px (Primary: ≥56px)
□ Input font-size ≥16px
□ touch-action: manipulation auf Buttons
□ Safe Area berücksichtigt (wenn am Rand)
□ 100dvh statt 100vh (wenn Fullscreen)
```

## 5.2 Neues Feature

```
□ Feature implementiert und committed
□ data-testid zu allen interaktiven Elementen
□ E2E-Test für Haupt-Flow geschrieben
□ Test läuft auf Mobile UND Desktop
□ Test committed
```

## 5.3 Vor Release

```
□ npm run lint (keine Errors)
□ npm test -- --run (Unit Tests grün)
□ npm run test:e2e (E2E Tests grün)
□ npm run test:e2e:mobile (Mobile Tests grün)
□ npm run build (Build erfolgreich)
```

## 5.4 Device Compatibility (bei Mobile-Arbeit)

```
□ 100vh → 100dvh?
□ Inputs ≥16px font-size?
□ Safe Area Insets?
□ touch-action: manipulation?
□ Touch Targets ≥44px?
□ Viewport Meta vollständig?
□ PWA Meta Tags?
```

---

# Teil 6: CLAUDE.md Integration

## Pflichtlektüre (Ergänzung zur bestehenden Tabelle)

| Aufgabe | Docs lesen |
|---------|------------|
| E2E-Tests | `.claude/workflows/TESTING.md` |
| UI-Komponente (Mobile) | `.claude/workflows/TESTING.md` → Teil 2 |
| Device-spezifisch | `.claude/workflows/TESTING.md` → Teil 2 |

## Nach Feature-Implementierung

Claude Code MUSS fragen:
> "Soll ich E2E-Tests für dieses Feature erstellen?"

Wenn ja → Test schreiben nach Pattern in Teil 1.3

## Commit-Checkliste (Ergänzung)

```
Bestehend:
□ Lint, Build, keine hardcoded Werte, keine any, keine console.log

NEU für UI:
□ data-testid hinzugefügt
□ Touch Targets ≥44px
□ Input font-size ≥16px
□ E2E-Test geschrieben (oder geplant)
```

---

# Teil 7: Automatische Aktualisierung

## Browser-Support prüfen (Quartalsweise)

| Feature | Can I Use | Prüfen für |
|---------|-----------|------------|
| `dvh` | viewport-unit-variants | 100vh Bug |
| `env()` | css-env-function | Safe Area |
| `touch-action` | css-touch-action | 300ms Delay |

## Update-Workflow

1. Dokument-Alter prüfen (sollte < 90 Tage sein)
2. Bei Bedarf: Web-Recherche "[Feature] iOS Safari [Jahr]"
3. Can I Use prüfen
4. Dokument aktualisieren
5. "Letzte Aktualisierung" Datum ändern

---

**Letzte Aktualisierung:** 2025-12-29
