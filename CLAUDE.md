# Hallenfußball PWA - Projektkontext für Claude

Diese Datei wird von Claude Code automatisch bei jedem neuen Gespräch geladen und definiert den vollständigen Projektkontext sowie Verhaltensregeln.

---

## Verhaltensregeln für Claude

### Vor JEDER Implementierung

1. **Recherchiere ausgiebig** - Lies relevante Dokumentation, bevor du Code schreibst
2. **Nutze Context7** - Bei komplexen Fragen zu Libraries/Frameworks erst Dokumentation abrufen
3. **Analysiere bestehende Patterns** - Wie wird das Problem in ähnlichen Komponenten gelöst?
4. **Denke systemisch** - Keine isolierten Quick-Fixes, sondern Lösungen die überall funktionieren

### Wenn der User dich korrigieren muss

Das bedeutet, du hast nicht genug recherchiert. Bei der nächsten Aufgabe:
- Lies ALLE relevanten Dateien bevor du Code schreibst
- Prüfe die Design Token Dokumentation
- Schaue wie ähnliche Features implementiert sind
- Frage bei Unklarheiten BEVOR du implementierst

### Wichtige Dokumente zum Lesen

| Wann | Dokument |
|------|----------|
| **Immer bei Styling** | [Design Token README](src/design-tokens/README.md) |
| **Bei neuen Features** | [CODE_INDEX.md](CODE_INDEX.md) - Wo ist was? |
| **Bei UI-Komponenten** | [Design System Concept](docs/concepts/DESIGN-SYSTEM-CONCEPT.md) |
| **Bei Multi-User Fragen** | [Multi-User Konzept](docs/MULTI-USER-KONZEPT.md) |
| **Bei Business-Fragen** | [Monetization Concept](docs/concepts/MONETIZATION-CONCEPT.md) |

---

## Vision & Mission

**Vision:** Die weltweit beste Turnierverwaltungs-App für alle Sportarten - von Hallenfußball bis Basketball, von lokalen Vereinsturnieren bis zu internationalen Events.

**Ursprung:** Gestartet mit Hallenfußball im deutschsprachigen Raum, aber die Architektur ist von Anfang an sportarten-agnostisch und internationalisierbar designed.

**Mission:** Vereinen und Veranstaltern weltweit eine professionelle, einfach zu bedienende Lösung bieten, die:
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
- **Tournament Creation Wizard** - 5 Schritte zur Turniererstellung
- **Fair Scheduler Algorithmus** - Faire Pausen-/Spielzeitverteilung (Herzstück!)
- **Live-Turnierverwaltung** - Match Cockpit mit Timer, Tor-Buttons, Events
- **Gruppenphase + Playoffs** - 2/4 Gruppen mit konfigurierbaren Finals
- **PDF-Export** - Spielpläne, Ergebnisse, Tabellen
- **Import (JSON/CSV)** - Turniere/Teams importieren
- **Design Token System** - Zentralisierte Styling-Werte
- **WCAG AA Compliance** - Alle Kontraste validiert
- **Responsive Design** - Mobile-First mit 3 Breakpoints

### In Entwicklung
- Monitor-Ansicht für Großbildschirm (TV-Modus)
- Public View (Zuschauer-Link)
- Schedule Editor (Spielplan nachträglich bearbeiten)

---

## Roadmap & Prioritäten

### Phase 1: Foundation (aktuell)
- [x] Basis-Turnierverwaltung
- [x] Live-Timer & Ergebnisse
- [x] Design System mit Tokens
- [ ] Öffentlicher Turnier-Link (Public View)
- [ ] TV-Anzeigemodus optimieren
- [ ] Schedule Editor fertigstellen

### Phase 2: Multi-User & Rollen
- [ ] **Trainer-Cockpit** - Team-zentrierte Ansicht, Torschützen, Aufstellungen
- [ ] **Fan-Mode** - Hierarchische Ereigniserfassung (TL > Trainer > Fan)
- [ ] **Invite-System** - Helfer per Token einladen
- [ ] **Cloud-Backend** - Supabase/Firebase für Sync
- [ ] **Offline-First** - Lokale Queue mit späterem Sync

### Phase 3: Engagement & Monetarisierung
- [ ] Sponsor-Banner-System mit Analytics (Impressionen, CPM)
- [ ] Digitale Gewinnspiele (DSGVO-konform, Cloudflare Turnstile)
- [ ] MVP-Voting
- [ ] Push-Notifications
- [ ] **Freemium-Modell** - Free (8 Teams) vs Pro (€9,99/Monat)

### Phase 4: Ecosystem & Scale
- [ ] Förderverein-Spenden-Widget
- [ ] Volle Multi-Sport-Unterstützung (Handball, Basketball, Volleyball, Hockey...)
- [ ] Internationalisierung (i18n) - Englisch, Spanisch, Französisch...
- [ ] Verbands-Integration (z.B. DFB, ÖFB)
- [ ] API für Drittanbieter
- [ ] White-Label für große Organisationen

---

## Technische Architektur

### Projektstruktur

```
src/
├── design-tokens/           # Single Source of Truth für Styling
│   ├── colors.ts            # Farbpalette (WCAG-validiert)
│   ├── spacing.ts           # 8pt Grid
│   ├── typography.ts        # MD3-inspiriert
│   └── ...
├── components/
│   ├── ui/                  # Basis-Komponenten (Button, Card, Input...)
│   ├── schedule/            # Spielplan-Komponenten
│   ├── match-cockpit/       # Live-Spielsteuerung
│   └── dialogs/             # Modale Dialoge
├── features/
│   ├── tournament-creation/ # Wizard Steps 1-5
│   ├── tournament-management/ # Tabs (Spielplan, Tabelle, Ranking)
│   └── schedule-editor/     # Spielplan-Editor (neu)
├── utils/
│   ├── fairScheduler.ts     # ⭐ KERN-ALGORITHMUS
│   ├── playoffScheduler.ts  # Playoff-Logik
│   ├── tournamentCopy.ts    # Turnier-Duplikation
│   └── storage.ts           # localStorage Wrapper
├── hooks/
│   ├── useTournaments.ts    # CRUD Operations
│   ├── useLiveMatches.ts    # Live-Match-State
│   └── useLocalStorage.ts   # Persistenz
├── types/
│   └── tournament.ts        # TypeScript Definitionen
└── styles/
    ├── theme.ts             # Legacy (zu Design Tokens migrieren)
    └── global.css           # Globale Styles, CSS Variables
```

### Kritische Dateien

| Priorität | Datei | Zweck |
|-----------|-------|-------|
| ⭐⭐⭐ | `src/utils/fairScheduler.ts` | Kern-Scheduling-Algorithmus |
| ⭐⭐⭐ | `src/utils/playoffScheduler.ts` | Playoff-Match-Generierung |
| ⭐⭐⭐ | `src/lib/scheduleGenerator.ts` | Zeit-basierte Integration |
| ⭐⭐ | `src/types/tournament.ts` | Datenstruktur-Definitionen |
| ⭐⭐ | `src/design-tokens/` | Design System Source |
| ⭐⭐ | `src/hooks/useTournaments.ts` | State Management |

### Technische Entscheidungen

1. **localStorage statt Backend** - Aktuell Offline-Only, Multi-User kommt mit Supabase
2. **Fair Scheduler Priorität** - Pausen-Fairness > Home/Away > Feldverteilung
3. **Design Tokens** - TypeScript + CSS Variables für duale Nutzung
4. **Corporate Colors** - Premium-Feature im Pro-Tier
5. **Responsive Breakpoints** - Mobile <768px, Tablet 768-1024px, Desktop >1024px

---

## Wichtige Konzept-Dokumente

| Dokument | Inhalt | Status |
|----------|--------|--------|
| [FAIR_SCHEDULER.md](docs/FAIR_SCHEDULER.md) | Algorithmus-Details, Circle Method, Scoring | ✅ Implementiert |
| [DESIGN-SYSTEM-CONCEPT.md](docs/concepts/DESIGN-SYSTEM-CONCEPT.md) | Corporate Colors, Theme-Switching, WCAG | ✅ Implementiert |
| [TRAINER-COCKPIT-CONCEPT.md](docs/concepts/TRAINER-COCKPIT-CONCEPT.md) | Team-Ansicht, Torschützen, Kader | 📋 Geplant |
| [FAN-MODE-CONCEPT.md](docs/concepts/FAN-MODE-CONCEPT.md) | Hierarchie TL>Trainer>Fan, Konfliktlösung | 📋 Geplant |
| [TOURNAMENT-COPY-CONCEPT.md](docs/concepts/TOURNAMENT-COPY-CONCEPT.md) | Turnier-Duplikation als Template | 📋 Geplant |
| [MONETIZATION-CONCEPT.md](docs/concepts/MONETIZATION-CONCEPT.md) | Freemium, Sponsor-Pakete, Preise | 📋 Geplant |
| [MULTI-USER-KONZEPT.md](docs/MULTI-USER-KONZEPT.md) | Supabase, Rollen, Offline-Sync | 📋 Geplant |

---

## Business Model (geplant)

### Freemium
- **Free:** Unbegrenzte Turniere, max 8 Teams, Plattform-Branding
- **Pro (€9,99/Monat | €79/Jahr):** Unbegrenzte Teams, Corporate Colors, Analytics, PDF ohne Branding, TV-Modus

### Transaktionsbasiert
- Digitale Tombola: 5% Provision
- Spendenweiterleitung: 2% Provision
- Merchandise: 10% Provision

### Sponsor-Pakete
| Paket | Preis | Leistung |
|-------|-------|----------|
| Bronze | €50 | Logo im Sponsoren-Bereich |
| Silber | €150 | Banner-Rotation + Gewinnspiel |
| Gold | €300 | Exklusiv-Banner + QR-Code |
| Platin | €500 | Namensrecht + Logo auf Urkunden |

### ROI für Vereine
- ~€105 Ersparnis pro Turnier (Arbeitszeit)
- 430% ROI bei €79/Jahr und 4 Turnieren

---

## Coding Konventionen

### Design Tokens sind PFLICHT

```typescript
// ✅ RICHTIG
import { colors, spacing, fontSizes } from '@/design-tokens';

// ❌ VERBOTEN - Keine hardcoded Werte!
padding: '16px'     // → spacing.md oder spacing['2']
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
| Nur Dark Mode testen | Bricht bei Light Mode | Corporate Colors beachten |

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

**Scopes:** `wizard`, `cockpit`, `schedule`, `design`, `a11y`, `ui`, `fair-scheduler`

---

## Geplante Backend-Architektur

### Tech Stack (geplant für Phase 2)
- **Supabase** - PostgreSQL + Realtime + Auth
- **Stripe** - Zahlungen für Pro-Tier
- **Cloudflare Turnstile** - Bot-Schutz für Fan-Mode
- **Sentry** - Error Tracking

### Rollen-System
| Rolle | Rechte |
|-------|--------|
| Guest | Nur lokal, kein Sync |
| Viewer | Nur lesen (Public View) |
| Collaborator | Ergebnisse eingeben |
| Trainer | Eigenes Team verwalten |
| Admin/TL | Volle Kontrolle |

---

## Referenzen

- [README.md](README.md) - Technische Dokumentation
- [Design Tokens](src/design-tokens/README.md) - Styling Guidelines
- [CODE_INDEX.md](CODE_INDEX.md) - Wo ist was implementiert?
- [MDN color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
