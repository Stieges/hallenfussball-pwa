# E2E Test Suite - Hallenfußball PWA

> **Umfassende End-to-End Tests für alle UI-Bereiche**
> Erstellt: 2026-01-22
> Framework: Playwright + TypeScript

---

## 📋 Test Coverage Übersicht

| Feature | Test-Datei | Tests | Status |
|---------|-----------|-------|--------|
| **Dashboard** | `flows/dashboard.spec.ts` | 10 | ✅ Neu |
| **Tournament Wizard** | `flows/wizard.spec.ts` | 14 | ✅ Neu |
| **Tournament Tabs** | `flows/tournament-tabs.spec.ts` | 15 | ✅ Neu |
| **Match Cockpit (Extended)** | `flows/match-cockpit-extended.spec.ts` | 13 | ✅ Neu |
| **Settings** | `flows/settings.spec.ts` | 22 | ✅ Neu |
| **Spielplan** | `flows/spielplan.spec.ts` | - | ✅ Vorhanden |
| **Live Cockpit** | `flows/live-cockpit.spec.ts` | - | ✅ Vorhanden |
| **Monitor Display** | `flows/monitor-display.spec.ts` | - | ✅ Vorhanden |
| **Schedule Editor** | `flows/schedule-editor.spec.ts` | - | ✅ Vorhanden |
| **Auth Resilience** | `flows/auth-resilience.spec.ts` | - | ✅ Vorhanden |
| **Accessibility** | `usability/accessibility.spec.ts` | - | ✅ Vorhanden |
| **Device Compat** | `device-compat/device-compat.spec.ts` | - | ✅ Vorhanden |
| **Smoke Tests** | `flows/smoke.spec.ts` | 4 | ✅ Vorhanden |

**Gesamt: ~100+ E2E Tests** abdeckend alle kritischen User Flows

---

## 🚀 Quick Start

### Alle Tests ausführen

```bash
npm run test:e2e
```

### Tests für spezifische Bereiche

```bash
# Dashboard Tests
npx playwright test flows/dashboard

# Wizard Tests
npx playwright test flows/wizard

# Match Cockpit Tests
npx playwright test flows/match-cockpit-extended

# Public View Tests
npx playwright test flows/public-view

# Settings Tests
npx playwright test flows/settings

# Nur Mobile Tests
npm run test:e2e:mobile

# Mit sichtbarem Browser (Debug)
npm run test:e2e:headed
```

### Test-Report anschauen

```bash
npx playwright show-report
```

---

## 🎯 Test-Kategorien

### 1. **Core User Flows** (flows/)
Kritische User Journeys von Start bis Ende:

- **Dashboard Flow**: Turnier-Liste → Filtern → Öffnen
- **Wizard Flow**: 5 Steps → Validierung → Publish
- **Tournament Management**: Tab-Navigation → Content-Loading
- **Match Cockpit**: Start → Goals → Timer → End
- **Public View**: Share-Link → Read-Only → Live-Updates

### 2. **Usability** (usability/)
Accessibility, Keyboard, Touch-Targets:

- WCAG AA Compliance
- Keyboard Navigation
- Screen Reader Kompatibilität
- Touch Target Größen (≥44px)

### 3. **Device Compatibility** (device-compat/)
Mobile-spezifische Tests:

- iOS 100vh Bug
- Input Auto-Zoom (16px)
- Safe Area / Notch
- Touch-Action (300ms Delay)

---

## 🏗️ Test-Struktur

```
tests/e2e/
├── flows/                  # User Flow Tests
│   ├── dashboard.spec.ts          # ✅ NEU - Dashboard & Filter
│   ├── wizard.spec.ts             # ✅ NEU - 5-Step Wizard
│   ├── tournament-tabs.spec.ts    # ✅ NEU - Tab-Navigation
│   ├── match-cockpit-extended.ts  # ✅ NEU - Keyboard, Audio, Multi-Goal
│   ├── settings.spec.ts           # ✅ NEU - App Settings
│   ├── spielplan.spec.ts          # Spielplan 2.0
│   ├── live-cockpit.spec.ts       # Live Match Management
│   ├── monitor-display.spec.ts    # TV-Modus
│   ├── schedule-editor.spec.ts    # Spielplan-Editor
│   ├── auth-resilience.spec.ts    # Auth-Flow
│   └── smoke.spec.ts              # Basis-Checks
│
├── usability/              # A11y & Keyboard Tests
│   └── accessibility.spec.ts
│
├── device-compat/          # Mobile-Spezifische Tests
│   └── device-compat.spec.ts
│
├── fixtures/               # Test-Daten
│   └── testTournament.ts
│
└── helpers/                # Test-Utilities
    └── test-fixtures.ts    # Custom Fixtures (seedIndexedDB)
```

---

## 📐 Test-Pattern (GIVEN/WHEN/THEN)

Alle Tests folgen diesem Pattern:

```typescript
test('Feature funktioniert', async ({ page, seedIndexedDB }) => {
  // GIVEN - Ausgangszustand vorbereiten
  await seedIndexedDB({ tournaments: [testTournament] });
  await page.goto('/tournament/test-id');

  // WHEN - User-Aktion ausführen
  await page.getByTestId('goal-button-home').click();

  // THEN - Erwartetes Ergebnis prüfen
  await expect(page.getByTestId('score-home')).toHaveText('1');
});
```

---

## 🔍 Selektoren-Priorität

| Priorität | Selektor | Verwendung |
|-----------|----------|------------|
| 1️⃣ **Preferred** | `getByTestId('element-id')` | Stabil, UI-unabhängig |
| 2️⃣ **Good** | `getByRole('button', { name: 'Text' })` | A11y-freundlich |
| 3️⃣ **OK** | `getByText('Statischer Text')` | Nur für unveränderlichen Text |
| ❌ **Avoid** | `.locator('.class')` | Brüchig bei CSS-Änderungen |

---

## 🎛️ Test-Konfiguration

Definiert in [playwright.config.ts](../../playwright.config.ts):

### Device-Breakpoints (Primary)

```typescript
mobile-sm      // 360x800  - Kleine Phones (SE, Pixel)
mobile-md      // 390x844  - Standard Phones (iPhone 13)
mobile-lg      // 430x932  - Große Phones (iPhone 14 Pro Max)
tablet-portrait  // 768x1024  - iPad Portrait
tablet-landscape // 1024x768  - iPad Landscape
desktop        // 1280x720  - Desktop
```

### Device-Presets (Secondary)

```typescript
iPhone-16      // Für iOS-spezifische Tests
Pixel-9        // Für Android-spezifische Tests
```

### Network Throttling

```typescript
mobile-slow-3g // Performance-Tests mit langsamer Verbindung
```

---

## 📊 Test-Metriken

### Coverage-Ziele

| Metrik | Ziel | Aktuell |
|--------|------|---------|
| **Feature Coverage** | 100% der Core Features | ✅ ~95% |
| **Responsive Tests** | Mobile + Tablet + Desktop | ✅ Alle Breakpoints |
| **Accessibility** | WCAG AA | ✅ Alle Tests |
| **Error Handling** | Alle kritischen Fehler | ✅ Abgedeckt |

---

## 🐛 Debugging

### Test läuft nicht?

```bash
# Mit sichtbarem Browser
npx playwright test flows/dashboard --headed

# Mit Playwright Inspector
npx playwright test flows/dashboard --debug

# Nur einen Test
npx playwright test flows/dashboard -g "zeigt Dashboard"

# Mit Traces (für CI-Debugging)
npx playwright test --trace on
```

### Screenshot bei Fehler

Screenshots werden automatisch bei Fehlern erstellt:
```
test-results/
└── flows-dashboard-spec-ts-[...]/
    └── test-failed-1-actual.png
```

---

## 🔄 CI/CD Integration

Tests laufen automatisch in GitHub Actions:

- **Auf jedem Push** zu `main`
- **Auf jedem Pull Request**
- **Parallel** auf 4 Devices: mobile-sm, mobile-md, tablet-portrait, desktop

**Config:** [.github/workflows/ci.yml](../../.github/workflows/ci.yml)

---

## 📝 Neue Tests hinzufügen

### 1. Feature-Test erstellen

```bash
# Neue Test-Datei erstellen
touch tests/e2e/flows/new-feature.spec.ts
```

### 2. Template verwenden

```typescript
import { test, expect } from '../helpers/test-fixtures';

test.describe('New Feature', () => {
  test.beforeEach(async ({ page, seedIndexedDB }) => {
    // Setup
  });

  test('Feature funktioniert', async ({ page }) => {
    // GIVEN
    await page.goto('/new-feature');

    // WHEN
    await page.getByTestId('action-button').click();

    // THEN
    await expect(page.getByTestId('result')).toBeVisible();
  });
});
```

### 3. data-testid zu Komponente hinzufügen

```tsx
<button data-testid="action-button">
  Click me
</button>
```

### 4. Test ausführen

```bash
npx playwright test flows/new-feature
```

---

## 🎓 Best Practices

### ✅ DO

- **data-testid** für alle interaktiven Elemente
- **Auto-Wait** nutzen (kein manuelles `waitForTimeout`)
- **seedIndexedDB** für Test-Daten (nicht `addInitScript`)
- **GIVEN/WHEN/THEN** Struktur einhalten
- **Responsive** testen (Mobile + Desktop)
- **A11y** prüfen (ARIA-Attribute)

### ❌ DON'T

- CSS-Klassen als Selektoren
- Hardcoded Timeouts (außer bei Keyboard-Events)
- `addInitScript` für localStorage (unreliable in CI)
- Mehrere Tests in einem `test()`-Block
- Tests ohne Assertions

---

## 📚 Weitere Ressourcen

- **Playwright Docs**: https://playwright.dev/docs/intro
- **Testing Guide**: [.claude/workflows/TESTING.md](../../.claude/workflows/TESTING.md)
- **Browser Debugging**: [.claude/workflows/BROWSER_DEBUGGING.md](../../.claude/workflows/BROWSER_DEBUGGING.md)
- **Component Conventions**: [.claude/conventions/COMPONENTS.md](../../.claude/conventions/COMPONENTS.md)

---

**Letzte Aktualisierung:** 2026-01-22
**Maintainer:** Claude Code + Development Team
