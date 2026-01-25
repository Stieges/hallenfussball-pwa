# E2E Test Commands - Quick Reference

> **Schnellreferenz für alle Test-Befehle**

---

## 🚀 Basis-Befehle

```bash
# Alle E2E-Tests
npm run test:e2e

# Mit UI (interaktiver Modus)
npm run test:e2e:ui

# Mit sichtbarem Browser
npm run test:e2e:headed

# Nur Mobile-Tests
npm run test:e2e:mobile

# Nur Desktop-Tests
npm run test:e2e:desktop
```

---

## 🎯 Tests nach Feature

### Dashboard
```bash
npx playwright test flows/dashboard

# Spezifischer Test
npx playwright test flows/dashboard -g "zeigt Dashboard"
```

### Tournament Wizard
```bash
npx playwright test flows/wizard

# Nur Step 1
npx playwright test flows/wizard -g "Step 1"

# Alle Navigation-Tests
npx playwright test flows/wizard -g "Navigation"
```

### Tournament Tabs
```bash
npx playwright test flows/tournament-tabs

# Nur Desktop
npx playwright test flows/tournament-tabs --project=desktop

# Nur Mobile
npx playwright test flows/tournament-tabs --project=mobile-md
```

### Match Cockpit
```bash
# Basis-Tests (vorhanden)
npx playwright test flows/live-cockpit

# Erweiterte Tests (neu)
npx playwright test flows/match-cockpit-extended

# Nur Keyboard-Tests
npx playwright test flows/match-cockpit-extended -g "Keyboard"
```

### Public View
```bash
npx playwright test flows/public-view

# Nur Privacy-Tests
npx playwright test flows/public-view -g "Privacy|ausgeblendet"

# Nur Live-Update-Tests
npx playwright test flows/public-view -g "Live"
```

### Settings
```bash
npx playwright test flows/settings

# Nur Theme-Tests
npx playwright test flows/settings -g "Theme"

# Nur Audio-Tests
npx playwright test flows/settings -g "Audio"
```

---

## 📱 Tests nach Device

```bash
# iPhone 13 (mobile-md)
npx playwright test --project=mobile-md

# Pixel 5 (mobile-sm)
npx playwright test --project=mobile-sm

# iPad Portrait
npx playwright test --project=tablet-portrait

# Desktop Chrome
npx playwright test --project=desktop

# Alle Mobile-Devices
npx playwright test --project=mobile-sm --project=mobile-md --project=mobile-lg
```

---

## 🐛 Debugging

```bash
# Debug-Modus (Step-by-Step)
npx playwright test flows/dashboard --debug

# Mit Traces (für spätere Analyse)
npx playwright test --trace on

# Nur failed Tests wiederholen
npx playwright test --last-failed

# Mit slowMo (Aktionen verlangsamen)
npx playwright test --slow-mo=1000
```

---

## 📊 Reports & Logs

```bash
# HTML-Report anzeigen
npx playwright show-report

# JSON-Report generieren
npx playwright test --reporter=json

# Test-Logs mit Details
npx playwright test --reporter=list
```

---

## 🔄 Kombinationen

```bash
# Dashboard auf Mobile mit Debug
npx playwright test flows/dashboard --project=mobile-md --debug

# Wizard auf allen Devices
npx playwright test flows/wizard --project=mobile-sm --project=mobile-md --project=desktop

# Alle Flow-Tests (ohne Usability/Device-Compat)
npx playwright test flows/

# Nur einen spezifischen Test auf allen Devices
npx playwright test flows/dashboard -g "Navigation zu Archiv"

# Mit Screenshots für alle Tests
npx playwright test --screenshot=on
```

---

## ⚡ Performance

```bash
# Parallel auf allen CPUs
npx playwright test --workers=4

# Sequentiell (für Debugging)
npx playwright test --workers=1

# Mit Network Throttling (Slow 3G)
npx playwright test --project=mobile-slow-3g
```

---

## 🧪 Neue Tests schreiben

```bash
# Test-Datei erstellen
touch tests/e2e/flows/new-feature.spec.ts

# Test sofort ausführen
npx playwright test flows/new-feature

# Codegen für neue Tests (generiert Test-Code beim Klicken)
npx playwright codegen http://localhost:3000
```

---

## 🎬 CI/CD Simulation

```bash
# Tests wie in CI ausführen (Preview-Build)
CI_E2E_USE_PREVIEW=1 npm run test:e2e

# Mit 2 Retries (wie in CI)
npx playwright test --retries=2

# Alle Devices parallel (wie in CI)
npx playwright test --workers=4
```

---

## 📝 Smoke Tests (Schnell-Check)

```bash
# Nur kritische Smoke-Tests
npx playwright test flows/smoke

# Alle kritischen Flows (Dashboard + Wizard + Cockpit)
npx playwright test flows/dashboard flows/wizard flows/live-cockpit
```

---

## 🔍 Filter & Suche

```bash
# Nach Test-Name filtern (Regex)
npx playwright test -g "Navigation"

# Mehrere Patterns
npx playwright test -g "Navigation|Button|Click"

# Tests OHNE bestimmtes Pattern
npx playwright test -g "^(?!.*Mobile)"

# Nach Datei-Pattern
npx playwright test tests/e2e/flows/dashboard*
```

---

## 🛠️ Wartung

```bash
# Playwright-Browser updaten
npx playwright install

# Mit Dependencies (für CI)
npx playwright install --with-deps

# Nur Chromium
npx playwright install chromium

# Alte Test-Results löschen
rm -rf test-results/ playwright-report/
```

---

## 🎯 Pro-Tipps

### Nur einen Test debuggen
```bash
npx playwright test flows/dashboard -g "zeigt Dashboard" --debug
```

### Alle failed Screenshots anzeigen
```bash
ls -la test-results/*/test-failed-*.png
```

### Test-Report nach CI-Run herunterladen
```bash
# GitHub Actions Artifact herunterladen
gh run download <run-id> -n playwright-report-mobile-sm
```

### Watch-Modus (Auto-Rerun bei Änderungen)
```bash
npx playwright test --watch
```

---

**Mehr Infos:** [Playwright CLI Docs](https://playwright.dev/docs/test-cli)
