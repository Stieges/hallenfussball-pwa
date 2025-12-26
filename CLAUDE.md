# Hallenfußball PWA - Projektkontext für Claude

Diese Datei gibt Claude (und anderen KI-Assistenten) den vollständigen Kontext über das Projekt.

---

## Vision & Mission

**Vision:** Die beste Turnierverwaltungs-App für Hallenfußball und Indoor-Sportarten im deutschsprachigen Raum.

**Mission:** Vereinen und Veranstaltern eine professionelle, einfach zu bedienende Lösung bieten, die:
- Turnierorganisation von Stunden auf Minuten reduziert
- Live-Ergebnisse für Fans/Eltern in Echtzeit bereitstellt
- Sponsoren messbare Reichweite liefert
- Offline-first funktioniert (Sporthallen haben oft schlechtes WLAN)

---

## Zielgruppen & Stakeholder

| Stakeholder | Bedürfnis | Wie wir helfen |
|-------------|-----------|----------------|
| **Turnierveranstalter** | Weniger Aufwand, professioneller Auftritt | 5-Min-Wizard, automatischer Spielplan, TV-Modus |
| **Trainer** | Eigenes Team im Blick, Statistiken | Trainer-Cockpit, Torschützen-Erfassung |
| **Fans/Eltern** | Live-Ergebnisse, "Wie steht's?" | Fan-Mode, Push-Notifications, Live-Ticker |
| **Sponsoren** | Messbare Werbung statt Bauchgefühl | Impressionen-Tracking, Sponsor-Reports |
| **Fördervereine** | Neue Spendenkanäle | Digitale Spenden-Widgets |

---

## Aktueller Status (v2.3.0)

### Vollständig implementiert
- 5-Step Tournament Creation Wizard
- Fair Scheduler Algorithmus (faire Pausen-Verteilung)
- Live-Turnierverwaltung mit Match Cockpit
- Gruppenphase + Playoffs (2/4 Gruppen)
- PDF-Export
- Import (JSON/CSV)
- Responsive Design (Mobile-First)
- Design Token System
- WCAG AA Kontrast-Compliance

### In Entwicklung
- Monitor-Ansicht für Großbildschirm (TV-Modus)
- Public View (Zuschauer-Link)
- Schedule Editor (Spielplan-Editor)

---

## Roadmap & Prioritäten

### Phase 1: Foundation (aktuell)
- [x] Basis-Turnierverwaltung
- [x] Live-Timer & Ergebnisse
- [x] Design System mit Tokens
- [ ] Öffentlicher Turnier-Link (Public View)
- [ ] TV-Anzeigemodus optimieren

### Phase 2: Multi-User & Rollen
- [ ] Trainer-Cockpit (team-zentrierte Ansicht)
- [ ] Fan-Mode (hierarchische Ereigniserfassung)
- [ ] Invite-System für Helfer
- [ ] Offline-Sync (lokale Änderungen → Server)

### Phase 3: Engagement & Monetarisierung
- [ ] Sponsor-Banner-System mit Analytics
- [ ] Digitale Gewinnspiele (DSGVO-konform)
- [ ] MVP-Voting
- [ ] Push-Notifications
- [ ] Freemium-Modell (Free + Pro-Tier)

### Phase 4: Ecosystem
- [ ] Förderverein-Spenden-Widget
- [ ] Multi-Sport-Unterstützung (Handball, Basketball)
- [ ] Verbands-Integration
- [ ] API für Drittanbieter

---

## Technische Architektur

```
src/
├── design-tokens/     # Single Source of Truth für Styling
├── components/
│   ├── ui/            # Basis-Komponenten (Button, Card, Input...)
│   ├── schedule/      # Spielplan-Komponenten
│   └── match-cockpit/ # Live-Spielsteuerung
├── features/
│   ├── tournament-creation/   # Wizard Steps
│   ├── tournament-management/ # Tabs (Spielplan, Tabelle, Ranking)
│   └── schedule-editor/       # Spielplan-Editor (neu)
├── utils/
│   ├── fairScheduler.ts       # Kern-Algorithmus
│   └── playoffScheduler.ts    # Playoff-Logik
└── types/             # TypeScript Definitionen
```

---

## Wichtige Konzept-Dokumente

| Dokument | Inhalt |
|----------|--------|
| [MONETIZATION-CONCEPT.md](docs/concepts/MONETIZATION-CONCEPT.md) | Business Model, Sponsor-Integration, Preise |
| [FAN-MODE-CONCEPT.md](docs/concepts/FAN-MODE-CONCEPT.md) | Hierarchisches Rollen-System, Konfliktlösung |
| [TRAINER-COCKPIT-CONCEPT.md](docs/concepts/TRAINER-COCKPIT-CONCEPT.md) | Team-zentrierte Ansicht, Torschützen |
| [DESIGN-SYSTEM-CONCEPT.md](docs/concepts/DESIGN-SYSTEM-CONCEPT.md) | Corporate Colors, Theme-Switching |
| [MULTI-USER-KONZEPT.md](docs/MULTI-USER-KONZEPT.md) | Sync, Offline-First, Invite-Tokens |

---

## Business Model (geplant)

### Freemium
- **Free:** Unbegrenzte Turniere, max 8 Teams, Plattform-Branding
- **Pro (€9,99/Monat):** Unbegrenzte Teams, eigene Sponsoren, Analytics, PDF-Export ohne Branding

### Transaktionsbasiert
- Digitale Tombola: 5% Provision
- Spendenweiterleitung: 2% Provision

### Sponsor-Pakete
- Bronze (€50) → Logo im Sponsoren-Bereich
- Silber (€150) → Banner-Rotation + Gewinnspiel
- Gold (€300) → Exklusiv-Banner + QR-Code
- Platin (€500) → Namensrecht + Logo auf Urkunden

---

## Coding Konventionen

### Pre-Change Checklist

**Vor JEDER Code-Änderung:**

1. **Dokumentation prüfen**
   - [Design Token README](src/design-tokens/README.md)
   - [Design System Concept](docs/concepts/DESIGN-SYSTEM-CONCEPT.md)
   - [CODE_INDEX.md](CODE_INDEX.md) - Wo ist was implementiert?

2. **Bestehende Patterns analysieren**
   - Wie wird das Problem in ähnlichen Komponenten gelöst?
   - Gibt es bereits eine Utility/Helper dafür?
   - Welche Design Tokens werden verwendet?

3. **Auswirkungen bedenken**
   - Funktioniert die Lösung bei Theme-Wechsel (Dark/Light)?
   - Ist die Lösung zukunftssicher oder ein Quick-Fix?
   - Werden WCAG AA Kontrast-Anforderungen erfüllt?

### Design Tokens sind PFLICHT

```typescript
// RICHTIG
import { colors, spacing, fontSizes } from '@/design-tokens';

// VERBOTEN - Keine hardcoded Werte!
padding: '16px'     // → spacing.md
color: '#00d46a'    // → colors.primary
fontSize: '14px'    // → fontSizes.md
```

### Browser Native Controls

Für Date Picker, Scrollbars etc. wird `color-scheme` in `/src/styles/global.css` verwendet:

```css
:root {
  color-scheme: dark;  /* Browser rendert native Elemente im Dark Mode */
}
```

**NICHT verwenden:**
- `filter: invert(1)` - Bricht bei Theme-Wechsel
- Hardcoded Farben für native Elemente

### Häufige Fehler vermeiden

| Fehler | Problem | Lösung |
|--------|---------|--------|
| Isolierte Quick-Fixes | Funktioniert nicht bei Theme-Wechsel | Systemweite Lösung finden |
| Dokumentation ignorieren | Rad neu erfinden | Erst Design Token README lesen |
| Hardcoded Werte | Inkonsistente UI | Design Tokens verwenden |
| Nur Dark Mode | Bricht bei Light Mode | Corporate Colors beachten |

### Code Quality

```bash
npm run lint          # Muss ohne Warnings durchlaufen
npm run build         # Muss erfolgreich bauen
npm run test          # Tests müssen grün sein
```

- `--max-warnings=0` ist aktiv
- Pre-Push Hook prüft automatisch Lint + Build

---

## Commit-Konvention

```
<type>(<scope>): <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`

**Scopes:** `wizard`, `cockpit`, `schedule`, `design`, `a11y`, `ui`

---

## Referenzen

- [README.md](README.md) - Technische Dokumentation
- [Design Tokens](src/design-tokens/README.md) - Styling Guidelines
- [MDN color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
