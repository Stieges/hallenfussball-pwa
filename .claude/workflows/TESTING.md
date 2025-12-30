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
└─────────────────────────────────────────────────────────────────┘
```

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
