#!/usr/bin/env python3
"""
Code Review mit parallelen Qwen Thinking-Agents.

12 spezialisierte Agents mit fokussierten Verzeichnissen fuer tiefe Analyse.
Nutzt qwen-3.5-122b-sovereign ueber adesso AI Hub (Thinking Mode).

Nutzung:
  python reviews/code-review-agents.py                    # Alle 12 Agents
  python reviews/code-review-agents.py --agent security   # Nur Security
  python reviews/code-review-agents.py --list             # Agents anzeigen
  python reviews/code-review-agents.py --batch 6          # In 2 Wellen a 6
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import requests

# ── Config ──────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REVIEWS_DIR = PROJECT_ROOT / "reviews"
REVIEWS_DIR.mkdir(exist_ok=True)

API_BASE = os.environ.get("ADESSO_AI_HUB_BASE_URL", "https://adesso-ai-hub.3asabc.de/v1")
API_KEY = os.environ.get("ADESSO_AI_HUB_API_KEY", "")
MODEL = "qwen-3.5-122b-sovereign"
MAX_TOKENS = 32000
TIMEOUT = 600  # 10 Minuten pro Agent (Thinking braucht laenger)

# Dateien die NICHT reviewed werden sollen
EXCLUDE_PATTERNS = {
    "node_modules", "dist", ".git", ".husky", ".vercel", ".gemini",
    "playwright-report", "test-reports", "test-results", "coverage",
    "package-lock.json", ".DS_Store", "ci_logs.txt",
}

INCLUDE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json", ".sql", ".yaml", ".yml"}

# Common suffix appended to every agent system prompt (D18, D19).
COMMON_SYSTEM_SUFFIX = """

KRITISCHE METHODIK-REGELN (D19, Sichtfeld-Beschränkung):

Du siehst nur die Dateien aus deinen `focus_dirs`. Du hast KEINEN Überblick über das gesamte Repo.

- Wenn du etwas vermisst (z.B. "Playoff-Logik fehlt komplett"):
  formuliere als "Zu prüfen ob X außerhalb meines Scopes existiert" — NICHT als Critical Finding.
  Severity solcher Aussagen: HÖCHSTENS Low (zu verifizieren).

- Wenn du Code-Snippets als Beispiel zeigst, markiere klar dass es DEINE Beschreibung ist,
  nicht der echte Code. Halluzinationen vermeiden: KEINE erfundenen Pfade.

KONSERVATIVE SEVERITY-EINSTUFUNG:

- critical: NUR Security-Lücken oder Datenverlust-Risiken
- high: Architektur-Verletzungen oder User-treffende Bugs
- medium: Code-Smells mit echtem Impact
- low: Polish, Wartbarkeit, "zu prüfen ob"-Aussagen

SELF_CHECK vor dem Output (D18):

[ ] Habe ich alle in meinem prompt aufgelisteten Punkte abgearbeitet?
[ ] Sind alle Datei-Pfade vollständig (z.B. `src/foo/bar.ts:42`)?
[ ] Habe ich Severity konservativ vergeben?
[ ] Habe ich "fehlt komplett"-Aussagen als Low + zu-prüfen markiert?
"""

# ── Agent-Definitionen (12 Agents) ─────────────────────────────

AGENTS = {
    # ── 1. Architektur ──
    "architecture": {
        "name": "Architektur & Schichtenmodell",
        "focus_dirs": ["src/core", "src/types", "src/contexts", "src/lib", "src/config"],
        "max_chars": 150000,
        "prompt": """Du bist ein erfahrener Software-Architekt. Analysiere die Architektur dieser React/TypeScript PWA.

<think>
Analysiere systematisch:
1. Schichtenarchitektur — Core (Models/Repositories/Services/Generators) vs. Features vs. Components. Ist die Trennung sauber?
2. Dependency Flow — Importiert Core jemals aus Features/Components? Zirkulaere Imports?
3. Repository Pattern — LocalStorageRepository vs. SupabaseRepository. Sind die Abstraktionen korrekt? Kann man leicht wechseln?
4. Type System — Zod-Schemas als Runtime-Validierung + TypeScript-Typen. Sind sie konsistent? Gibt es Doppel-Definitionen?
5. Configuration — Wie werden Sport-Configs, Feature-Flags, Umgebungen verwaltet?
6. Error Handling Strategie — Konsistentes Pattern oder ad-hoc?
7. Abhaengigkeiten — God-Objects? Zuviele Verantwortlichkeiten in einzelnen Dateien?
8. Barrel Exports / Index Files — Sauber oder chaotisch?
</think>

Gib ein strukturiertes Review mit:
- **Staerken** (was gut geloest ist)
- **Architektur-Probleme** (mit Schweregrad: Critical/High/Medium/Low und Datei-Referenz)
- **Konkrete Verbesserungsvorschlaege** (mit Code-Beispielen wo sinnvoll)
- **Bewertung** (1-10 Skala)""",
    },

    # ── 2. Supabase & Daten ──
    "supabase_data": {
        "name": "Supabase, Datenbank & Sync",
        "focus_dirs": ["supabase", "src/core/repositories", "src/core/storage", "src/core/sync", "src/core/realtime", "src/features/sync", "src/features/collaboration"],
        "max_chars": 150000,
        "prompt": """Du bist ein Supabase/PostgreSQL-Experte. Analysiere die Datenbank-Architektur, Auth und Realtime-Integration.

<think>
Pruefe systematisch:
1. Database Schema — Migrationen konsistent? Fremdschluessel? Indizes? Constraints?
2. Row Level Security (RLS) — Policies korrekt? Luecken (Bypass moeglich)?
3. Auth Integration — Wie wird Auth in der App genutzt? Token-Handling?
4. Realtime Subscriptions — Effizient? Cleanup bei Unmount? Conflict Resolution?
5. LocalStorage ↔ Supabase Sync — Wie funktioniert die Synchronisation? Offline-First?
6. Data Migration — Gibt es ein Schema-Migrations-Konzept fuer bestehende LocalStorage-Daten?
7. Repository Pattern — Sind die Repositories gut abstrahiert? Koennte man Supabase austauschen?
8. Connection Handling — Pooling? Retry? Error Recovery?
9. Edge Functions — Gibt es welche? Sicherheit?
10. Storage — File Uploads? Policies?
</think>

Gib ein strukturiertes Review mit:
- **Kritische DB/Auth-Probleme** (RLS-Luecken, Schema-Fehler)
- **Sync-Probleme** (Konflikte, Datenverlust-Risiken)
- **Optimierungspotenzial** (Queries, Indizes, Subscriptions)
- **Positive Patterns**
- **Supabase Score** (1-10)""",
    },

    # ── 3. Security ──
    "security": {
        "name": "Security & Datenschutz",
        "focus_dirs": ["src/features/auth", "supabase", "src/lib", "public", "src/core/storage"],
        "max_chars": 150000,
        "prompt": """Du bist ein Application Security Engineer. Fuehre ein Security-Audit dieser PWA durch.

<think>
Pruefe systematisch (OWASP Top 10 + PWA-spezifisch):
1. Authentication — Supabase Auth korrekt implementiert? Session-Management? Token-Refresh?
2. Authorization — RLS-Policies? Client-Side Route Guards reichen NICHT als Schutz!
3. Input Validation — Zod-Schemas lueckenlos? XSS-Vektoren in User-Input? dangerouslySetInnerHTML?
4. Client-Side Storage — Sensible Daten in LocalStorage/IndexedDB? Verschluesselung?
5. API-Key Exposure — Supabase anon key im Client ist OK, aber: sind service_role keys exponiert?
6. Service Worker Security — Cache-Poisoning? Update-Mechanismus? Integrity?
7. Secrets Management — .env.local Handling, .env.example, Vercel-Config
8. Dependency Security — bekannte CVEs in package.json Dependencies?
9. CSRF/Clickjacking — PWA-spezifische Angriffsvektoren, Frame-Busting
10. Content Security Policy — Header gesetzt (vercel.json)? Script-Src, Style-Src?
11. Datenschutz/DSGVO — Welche personenbezogenen Daten? Consent? Loeschkonzept?
12. Deep Link Security — URL-basierte Tournamentfreigabe? Token-Guessing?
</think>

Gib ein strukturiertes Security-Report mit:
- **Kritische Findings** (sofort beheben)
- **Hohe Findings** (vor naechstem Release)
- **Mittlere Findings** (in Backlog)
- **Empfehlungen** (Hardening)
- **Security Score** (1-10)""",
    },

    # ── 4. Tournament Creation Flow ──
    "tournament_creation": {
        "name": "Turnier-Erstellung (Wizard Flow)",
        "focus_dirs": ["src/features/tournament-creation", "src/core/generators", "src/core/models"],
        "max_chars": 150000,
        "prompt": """Du bist ein QA-Engineer und UX-Spezialist. Analysiere den Turnier-Erstellungs-Wizard.

<think>
Pruefe systematisch:
1. Wizard-Schritte — Welche Schritte gibt es? Reihenfolge logisch?
2. Validierung — Werden alle Eingaben validiert? Fehlermeldungen klar?
3. Zurueck-Navigation — Kann man Schritte zurueckgehen ohne Datenverlust?
4. Team-Verwaltung — Hinzufuegen, Entfernen, Umbenennen. Edge Cases?
5. Spielplan-Generierung — Algorithmus korrekt? Fairness (gleiche Anzahl Spiele, ausgewogene Gegner)?
6. Gruppen-Modus — Gruppenaufteilung fair? Topfverlosung?
7. Turnier-Formate — Welche werden unterstuetzt? (Jeder-gegen-Jeden, Gruppen+Playoff, Schweizer System?)
8. Sport-Konfiguration — Verschiedene Sportarten? Regelwerke?
9. Freilose (Bye) — Korrekt bei ungerader Teamzahl?
10. Persistierung — Wird Zwischenstand gespeichert? Was passiert bei Browser-Absturz im Wizard?
</think>

Gib ein strukturiertes Review mit:
- **Logik-Fehler** im Wizard oder Generator
- **Fehlende Validierungen** (Pflichtfelder, Grenzwerte)
- **UX-Probleme** im Wizard-Flow
- **Edge Cases** die nicht abgedeckt sind
- **Tournament Creation Score** (1-10)""",
    },

    # ── 5. Live-Cockpit & Match Management ──
    "live_cockpit": {
        "name": "Live-Cockpit & Spielsteuerung",
        "focus_dirs": ["src/features/schedule-editor", "src/features/monitor-display", "src/features/tournament-management", "src/components/schedule"],
        "max_chars": 150000,
        "prompt": """Du bist ein QA-Engineer spezialisiert auf Realtime-Anwendungen. Analysiere das Live-Cockpit fuer Spielsteuerung.

<think>
Pruefe systematisch:
1. Timer-Logik — Start/Stop/Pause korrekt? Was bei Browser-Tab-Wechsel? Drift-Kompensation?
2. Tor-Erfassung — Eingabe, Korrektur, Undo. Race Conditions bei schneller Eingabe?
3. Spielstand-Updates — Realtime-Sync? Was bei Netzwerk-Ausfall waehrend des Spiels?
4. Gleichzeitige Bearbeitung — Kann ein zweiter Nutzer Tore eintragen? Konflikte?
5. Ergebnis-Berechnung — Punkte, Tordifferenz, Direkter Vergleich, Fairplay. Alles korrekt?
6. Tabellenstand — Live-Aktualisierung? Sortierung korrekt bei Punktgleichheit?
7. Spielplan-Ansicht — Uebersichtlich? Filter? Suche? Farbkodierung?
8. Monitor/Anzeigetafel — Was sehen Zuschauer? Auto-Refresh? Darstellung bei verschiedenen Screens?
9. Spielreihenfolge — Stimmt die Reihenfolge mit dem generierten Spielplan ueberein?
10. Fehl-Tipp-Schutz — Bestaetigung bei Tor-Eingabe? Undo-Zeitfenster?
</think>

Gib ein strukturiertes Review mit:
- **Kritische Timing-Bugs** (Timer, Sync, Race Conditions)
- **Logik-Fehler** (Berechnung, Sortierung)
- **UX-Probleme** unter Zeitdruck (Halle = Stress-Szenario)
- **Positive Patterns**
- **Live-Cockpit Score** (1-10)""",
    },

    # ── 6. Tournament Admin & Playoffs ──
    "tournament_admin": {
        "name": "Turnier-Admin & Playoff-Logik",
        # D20: include playoff*.ts explicitly so cross-cutting code is in scope
        "focus_dirs": [
            "src/features/tournament-admin",
            "src/core/generators",  # already covers playoff*.ts via rglob
            "src/core/generators/playoffGenerator.ts",
            "src/core/generators/playoffResolver.ts",
            "src/core/generators/playoffScheduler.ts",
            "src/core/services",
            "src/core/models",
        ],
        "max_chars": 150000,
        "prompt": """Du bist ein Domain-Experte fuer Turniersoftware. Analysiere Admin-Features und Playoff-Logik.

<think>
Pruefe systematisch:
1. Playoff-Bracket — Generation korrekt? Seeding fair (1. vs Letzter)?
2. Tiebreaker-Regeln — Was bei Punktgleichheit? Direkter Vergleich → Tordifferenz → Torverhaeltnis → Los?
3. Bye-Handling — Freilose in Playoffs korrekt? Automatischer Sieg ohne Ergebnis?
4. Team-Zurueckziehung — Was passiert wenn ein Team mitten im Turnier ausscheidet?
5. Nachtraegliche Aenderungen — Ergebnis-Korrektur nach Spielende? Auswirkung auf Tabelle?
6. Turnier-Abbruch — Kann ein Turnier vorzeitig beendet werden? Endstand?
7. Spielplan-Regenerierung — Kann der Spielplan nach Start geaendert werden?
8. Multi-Gruppen → Playoff — Uebergang korrekt? Kreuzspiele?
9. Dritter-Platz-Spiel — Optional? Korrekt integriert?
10. Export — PDF-Spielplan, Ergebnisse. Vollstaendig und korrekt?
</think>

Gib ein strukturiertes Review mit:
- **Logik-Fehler** (falsche Berechnung, falsches Bracket)
- **Fehlende Edge Cases**
- **Inkonsistenzen** zwischen Gruppen- und Playoff-Phase
- **Admin-UX-Probleme**
- **Tournament Admin Score** (1-10)""",
    },

    # ── 7. Components & UI Library ──
    "components_ui": {
        "name": "UI-Komponenten & Design System",
        "focus_dirs": ["src/components/ui", "src/design-tokens", "src/styles"],
        "max_chars": 150000,
        "prompt": """Du bist ein Frontend-Architect mit Fokus auf Component Libraries. Analysiere die UI-Komponenten.

<think>
Pruefe systematisch:
1. Component API — Props konsistent? Defaults sinnvoll? Typisierung?
2. Composability — Sind Komponenten zusammensetzbar oder monolithisch?
3. Design Tokens — Werden sie konsistent genutzt? Hardcodierte Werte?
4. Accessibility — ARIA Labels, Rollen, Keyboard-Support, Focus Management
5. Responsive Design — Breakpoints, Container Queries, Mobile-First?
6. Theming — Dark Mode? Custom Themes? CSS Variables?
7. Animation — Smooth Transitions? Reduced Motion Support?
8. Form Components — Validation-Integration, Error States, Loading States
9. Reusability — Koennen Komponenten projektuebergreifend genutzt werden?
10. Storybook/Docs — Dokumentation der Komponenten? Playground?
</think>

Gib ein strukturiertes Review mit:
- **Inkonsistenzen** (verschiedene Patterns fuer gleiche Dinge)
- **Accessibility-Verstoesse** (WCAG 2.1 AA)
- **Design-Token-Verstoesse** (hardcodierte Farben/Groessen)
- **Verbesserungsvorschlaege**
- **UI Component Score** (1-10)""",
    },

    # ── 8. Hooks & State Management ──
    "hooks_state": {
        "name": "Hooks, State & Context",
        "focus_dirs": ["src/hooks", "src/contexts", "src/core/contexts"],
        "max_chars": 150000,
        "prompt": """Du bist ein React-Experte spezialisiert auf State Management und Custom Hooks. Analysiere alle Hooks und Contexts.

<think>
Pruefe systematisch:
1. Custom Hooks — Naming (use*), Rueckgabewerte, Fehlerbehandlung
2. Context Architecture — Wie viele Contexts? Verschachtelt? Provider Hell?
3. Re-Render Optimierung — useMemo, useCallback korrekt? Oder unnoetige Wrapping?
4. Side Effects — useEffect Cleanup? Dependency Arrays korrekt? Race Conditions?
5. Hook Composition — Werden Hooks aus anderen Hooks zusammengebaut? Zu tief verschachtelt?
6. State Colocation — State nah an der Nutzung oder zu weit oben (Prop Drilling)?
7. Derived State — Wird State abgeleitet statt dupliziert?
8. Hook Dependencies — Stabile Referenzen? Closures korrekt?
9. Error Boundaries — Integration mit Hook-Fehlern?
10. Performance — Hooks die bei jedem Render neue Objekte/Arrays erzeugen?
</think>

Gib ein strukturiertes Review mit:
- **Re-Render-Probleme** (unnoetige Renders durch schlechte Deps)
- **Memory Leaks** (fehlender Cleanup)
- **Anti-Patterns** (Rules of Hooks Verstoesse, God-Hooks)
- **Positive Patterns**
- **State Management Score** (1-10)""",
    },

    # ── 9. Performance & Bundle ──
    "performance": {
        "name": "Performance, Bundle & PWA",
        "focus_dirs": ["vite.config.ts", "vercel.json", "package.json", "public", "src/main.tsx", "src/App.tsx", "src/core/storage"],
        "max_chars": 120000,
        "prompt": """Du bist ein Web Performance Engineer. Analysiere Performance, Bundle-Size und PWA-Verhalten.

<think>
Pruefe systematisch:
1. Bundle Size — Code Splitting korrekt? Lazy Loading fuer Routes? Dynamic Imports?
2. Vite Config — Build-Optimierungen? Chunk-Splitting? Rollup-Config?
3. Tree Shaking — Werden nur genutzte Exports importiert? Barrel-Export-Probleme?
4. Asset Optimization — Bilder komprimiert? Fonts (WOFF2)? Preloading?
5. PWA Config — Manifest vollstaendig? Icons? Splash? Install-Prompt?
6. Service Worker — Caching-Strategie? Precache? Runtime Cache? Update-Flow?
7. Offline-Faehigkeit — Funktioniert die App offline? Was fehlt offline?
8. Runtime Performance — Grosse Listen virtualisiert? Timer effizient?
9. Memory Leaks — Event Listener, Subscriptions, Intervals — Cleanup?
10. Lighthouse-Einschaetzung — LCP, FID, CLS aus dem Code heraus bewerten
11. Network — Waterfall? Prefetching? HTTP/2 Push?
12. Vercel Config — Headers, Redirects, Edge Functions?
</think>

Gib ein strukturiertes Performance-Report mit:
- **Critical Issues** (spuerbare Verzoegerungen, fehlende Offline-Funktion)
- **Bundle-Optimierungen** (mit geschaetztem Size-Impact)
- **PWA-Luecken** (fehlende Offline-Features, Install-Flow)
- **Positive Patterns**
- **Performance Score** (1-10)""",
    },

    # ── 10. Testing & QA ──
    "testing": {
        "name": "Testing & Qualitaetssicherung",
        "focus_dirs": ["src/test", "src/test-data", "src/utils/__tests__", "src/design-tokens/__tests__", "vitest.config.ts", "playwright.config.ts", "eslint.config.js"],
        "max_chars": 150000,
        "prompt": """Du bist ein QA-Lead und Testing-Experte. Analysiere die gesamte Test-Strategie.

<think>
Pruefe systematisch:
1. Test-Pyramide — Verhaeltnis Unit/Integration/E2E? Richtige Balance?
2. Testabdeckung — Welche Module sind getestet? Welche fehlen komplett?
3. Unit Tests — Vitest-Setup korrekt? Mocking sinnvoll? Assertions aussagekraeftig?
4. E2E Tests — Playwright-Setup? Selektoren stabil? Flaky Tests?
5. Test-Daten — Fixtures/Factories? Hardcodierte Werte?
6. Edge Cases — Werden Grenzfaelle getestet? (0 Teams, 1 Team, 100 Teams)
7. Async Testing — Timer, Realtime, Network — korrekt gemockt?
8. Snapshot Tests — Werden sie genutzt? Sinnvoll oder Rauschen?
9. CI/CD — Laeuft Test-Suite automatisch? Performance der Suite?
10. Test-Qualitaet — Testen Tests das Richtige? False Positives?
</think>

Gib ein strukturiertes Testing-Report mit:
- **Testluecken** (ungetestete kritische Pfade)
- **Test-Qualitaetsprobleme** (fragile Tests, schlechte Assertions)
- **Fehlende Test-Typen** (z.B. kein Accessibility-Testing)
- **Empfehlungen** priorisiert nach Impact
- **Testing Score** (1-10)""",
    },

    # ── 11. i18n & Accessibility ──
    "i18n_a11y": {
        "name": "Internationalisierung & Barrierefreiheit",
        "focus_dirs": ["src/i18n", "src/components", "src/screens"],
        "max_chars": 150000,
        "prompt": """Du bist ein i18n- und Accessibility-Experte. Analysiere Mehrsprachigkeit und Barrierefreiheit.

<think>
Pruefe systematisch:
i18n:
1. Uebersetzungsdateien — Alle Keys vorhanden? Fehlende Uebersetzungen?
2. Hardcodierte Strings — Text direkt in JSX statt ueber i18n?
3. Pluralisierung — Korrekte Plural-Regeln? (1 Tor vs. 2 Tore)
4. Datumsformate — Lokalisiert? Zeitzone-Handling?
5. Zahlenformate — Dezimaltrennzeichen, Tausendertrennzeichen?
6. RTL-Support — Layout-Anpassungen fuer RTL-Sprachen?
7. Sprach-Erkennung — Browser-Sprache? Fallback?

Accessibility:
8. Semantisches HTML — <button> statt <div onClick>? Landmarks?
9. ARIA — Labels, Roles, Live Regions (fuer Timer-Updates!), Announcements
10. Keyboard Navigation — Tab-Reihenfolge? Focus Traps in Modals? Skip Links?
11. Screenreader — Werden Spielstaende vorgelesen? Timer-Updates?
12. Farb-Kontraste — Ausreichend (4.5:1 normal, 3:1 gross)?
13. Motion — Reduced Motion respektiert?
14. Touch Targets — Mindestens 48x48px? Abstand zwischen Targets?
</think>

Gib ein strukturiertes Review mit:
- **i18n-Luecken** (fehlende Keys, hardcodierte Strings)
- **WCAG 2.1 AA Verstoesse** (mit Schweregrad)
- **Screenreader-Probleme** (besonders bei Live-Daten)
- **Positive Patterns**
- **i18n Score** (1-10) und **Accessibility Score** (1-10)""",
    },

    # ── 12. Code Quality & Patterns ──
    "code_quality": {
        "name": "Code-Qualitaet & TypeScript-Patterns",
        "focus_dirs": ["src/utils", "src/lib", "src/types", "src/constants", "src/services", "src/core/utils"],
        "max_chars": 150000,
        "prompt": """Du bist ein Senior TypeScript/React Developer. Analysiere Code-Qualitaet, Patterns und Wartbarkeit.

<think>
Pruefe systematisch:
1. TypeScript Strict Mode — any-Casts? as-Casts? Non-Null Assertions (!)? Strict Flags?
2. Type Definitions — Sind Types gut modelliert? Union Types vs. Enums? Branded Types?
3. Utility Functions — DRY? Richtige Abstraktion? Oder Over-Engineering?
4. Constants — Magic Numbers? Magic Strings? Enum-artige Konstanten?
5. Error Handling — try/catch konsistent? Custom Error Types? Error Boundaries?
6. Naming Conventions — Konsistent? Sprechend? Deutsch/Englisch gemischt?
7. Code Smells — Lange Funktionen (>50 LOC)? Deep Nesting? Switch-Ketten?
8. DRY-Verstoesse — Copy-Paste-Code? Fehlende Abstraktionen?
9. ESLint-Config — Welche Regeln aktiv? Passend fuer React/TS?
10. Dead Code — Ungenutzte Exports, Imports, Funktionen?
</think>

Gib ein strukturiertes Quality-Report mit:
- **Code Smells** (mit Schweregrad und Datei-Referenz)
- **TypeScript-Verstoesse** (any, unsafe casts)
- **Naming-Inkonsistenzen**
- **Positive Patterns** (vorbildlicher Code)
- **Refactoring-Empfehlungen** (priorisiert)
- **Code Quality Score** (1-10)""",
    },

    # ── 13. Screens & Navigation ──
    "screens_navigation": {
        "name": "Screens, Routing & Navigation",
        "focus_dirs": ["src/screens", "src/App.tsx", "src/main.tsx", "src/features/settings"],
        "max_chars": 150000,
        "prompt": """Du bist ein React Router-Experte und UX-Engineer. Analysiere Screens, Routing und Navigation.

<think>
Pruefe systematisch:
1. Route-Struktur — Hierarchie logisch? Nested Routes? Lazy Loading?
2. Navigation Flow — Kann der User von ueberall zurueck? Breadcrumbs? History?
3. Deep Links — Funktionieren direkte URLs zu Turnieren/Spielen? Sharing?
4. Route Guards — Auth-geschuetzte Routes? Redirect bei fehlender Berechtigung?
5. 404 Handling — Was bei unbekannten Routes?
6. Screen Layouts — Konsistentes Layout? Header/Footer/Navigation?
7. Page Transitions — Smooth? Loading States beim Routenwechsel?
8. URL-Design — Sprechende URLs? Query Parameters sinnvoll?
9. Back-Button — Funktioniert der Browser-Zurueck-Button korrekt?
10. Settings — Einstellungen persistent? Validierung? UX?
</think>

Gib ein strukturiertes Review mit:
- **Routing-Probleme** (fehlende Guards, broken Links)
- **Navigation-UX-Probleme** (Sackgassen, fehlende Zurueck-Moeglichkeit)
- **Deep-Link-Luecken**
- **Positive Patterns**
- **Navigation Score** (1-10)""",
    },

    # ── 14. Sport-Konfiguration & Datenmodell ──
    "sport_config": {
        "name": "Sport-Konfiguration & Datenmodell",
        "focus_dirs": ["src/config/sports", "src/core/models", "src/types", "data", "src/constants"],
        "max_chars": 150000,
        "prompt": """Du bist ein Domain-Experte fuer Sportturnier-Software. Analysiere das Datenmodell und die Sport-Konfiguration.

<think>
Pruefe systematisch:
1. Datenmodell — Tournament, Team, Match, Group, Playoff. Vollstaendig? Konsistent?
2. Sport-Konfiguration — Welche Sportarten? Unterschiedliche Regeln (Spielzeit, Punkte, Tiebreaker)?
3. Zod-Schemas — Runtime-Validierung korrekt? Deckt alle Edge Cases ab?
4. Enums/Constants — Turnier-Status, Match-Status, Spielmodi — konsistent definiert?
5. Daten-Migration — Gibt es Versioning? Was bei Schema-Aenderungen?
6. Type Guards — Discriminated Unions korrekt? Exhaustive Checks?
7. Domain Events — Werden Zustandsuebergaenge modelliert? (z.B. Match: scheduled → running → finished)
8. Erweiterbarkeit — Kann man leicht neue Sportarten/Modi hinzufuegen?
9. Serialisierung — JSON-Kompatibilitaet? Date-Handling?
10. Invarianten — Werden Geschaeftsregeln im Modell erzwungen? (z.B. min 2 Teams, max Teams)
</think>

Gib ein strukturiertes Review mit:
- **Modell-Probleme** (fehlende Constraints, Inkonsistenzen)
- **Schema-Luecken** (unvalidierte Eingaben)
- **Erweiterbarkeits-Probleme**
- **Positive Patterns**
- **Datenmodell Score** (1-10)""",
    },

    # ── 15. PDF-Export & Daten-Ausgabe ──
    "export_output": {
        "name": "PDF-Export, Sharing & Datenausgabe",
        "focus_dirs": ["src/components", "src/core/services", "src/hooks", "src/utils"],
        "max_chars": 150000,
        "prompt": """Du bist ein Frontend-Entwickler spezialisiert auf Datenexport und Sharing. Analysiere PDF-Generation, Sharing und Datenausgabe.

<think>
Pruefe systematisch:
1. PDF-Export — jsPDF Integration korrekt? Layout? Schriftarten? Umlaute?
2. Spielplan-PDF — Alle Informationen enthalten? Lesbar? Druckfreundlich?
3. Ergebnis-Export — Tabellen, Endergebnis exportierbar?
4. Share-Funktion — Web Share API? Deep Links? QR-Code?
5. Turnier-Teilen — Wie wird ein Turnier mit anderen geteilt? Link? Code?
6. Monitor-URL — Oeffentliche Anzeigetafel-URL? Ohne Auth zugaenglich?
7. Clipboard — Copy-to-Clipboard fuer Links? Spielplaene?
8. Print — @media print Styles? Druckvorschau?
9. Datenformat — Gibt es Import/Export (z.B. CSV, JSON) fuer Turnierdaten?
10. Fehlerbehandlung — Was wenn PDF-Generation fehlschlaegt? Fallback?
</think>

Gib ein strukturiertes Review mit:
- **Export-Bugs** (fehlende Daten, Layout-Probleme)
- **Fehlende Export-Formate**
- **Sharing-UX-Probleme**
- **Positive Patterns**
- **Export Score** (1-10)""",
    },
}


# ── Datei-Sammlung ──────────────────────────────────────────────

def collect_files(focus_dirs: list[str], max_chars: int = 120000) -> str:
    """Sammelt relevante Dateien aus den Fokus-Verzeichnissen."""
    files_content = []
    total_chars = 0

    for focus_dir in focus_dirs:
        dir_path = PROJECT_ROOT / focus_dir
        if not dir_path.exists():
            # Einzeldatei?
            fp = PROJECT_ROOT / focus_dir
            if fp.is_file() and fp.suffix in INCLUDE_EXTENSIONS:
                try:
                    content = fp.read_text(errors="replace")
                    if total_chars + len(content) > max_chars:
                        continue
                    files_content.append(f"### {focus_dir}\n```{fp.suffix.lstrip('.')}\n{content}\n```")
                    total_chars += len(content)
                except Exception:
                    pass
            continue

        for fp in sorted(dir_path.rglob("*")):
            if not fp.is_file():
                continue
            if fp.suffix not in INCLUDE_EXTENSIONS:
                continue
            if any(excl in str(fp) for excl in EXCLUDE_PATTERNS):
                continue

            rel = fp.relative_to(PROJECT_ROOT)
            try:
                content = fp.read_text(errors="replace")
            except Exception:
                continue

            # Grosse Dateien kuerzen
            if len(content) > 10000:
                content = content[:10000] + f"\n\n... (gekuerzt, {len(content)} Zeichen gesamt)"

            if total_chars + len(content) > max_chars:
                files_content.append(f"\n... (Budget erreicht nach {total_chars:,} Zeichen, weitere Dateien uebersprungen)")
                break

            files_content.append(f"### {rel}\n```{fp.suffix.lstrip('.')}\n{content}\n```")
            total_chars += len(content)

    return "\n\n".join(files_content)


# ── API Call ────────────────────────────────────────────────────

def call_qwen_thinking(agent_key: str, agent_def: dict, code_context: str) -> dict:
    """Einzelnen Qwen Thinking-Agent aufrufen."""
    t0 = time.time()

    system_prompt = agent_def["prompt"] + COMMON_SYSTEM_SUFFIX
    user_message = f"""# Code Review: hallenfussball-pwa

## Projekt-Kontext
React 19 + TypeScript PWA fuer Hallenfussball-Turnierverwaltung.
Tech Stack: Vite 7, Supabase (Auth + DB + Realtime), Zod, React Router, i18next, jsPDF.
626 Source-Dateien, ~24.000 LOC. Deployment: Vercel.
Features: Turnier-Erstellung (Wizard), Spielplan-Generierung, Live-Cockpit (Timer, Tore),
Ergebnis-Tabellen, Playoff-Bracket, Monitor/Anzeigetafel, PDF-Export, Multi-User via Supabase Realtime.

## Fokus: {agent_def['name']}

## Code ({len(code_context):,} Zeichen)

{code_context}
"""

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": MAX_TOKENS,
        # Offizielle Qwen3 Thinking-Mode-Empfehlung (HF Modelcard, Qwen Quickstart):
        # temp 0.6, top_p 0.95, top_k 20, presence_penalty 0.0, min_p 0.
        # WARNUNG: greedy decoding (temp=0) führt zu endless repetitions.
        "temperature": 0.6,
        "top_p": 0.95,
        "top_k": 20,
        "presence_penalty": 0.0,
        "extra_body": {"enable_thinking": True, "min_p": 0},
    }

    try:
        resp = requests.post(
            f"{API_BASE}/chat/completions",
            headers=headers,
            json=payload,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        thinking = data["choices"][0]["message"].get("reasoning_content", "")
        elapsed = time.time() - t0

        return {
            "agent": agent_key,
            "name": agent_def["name"],
            "status": "success",
            "content": content,
            "thinking": thinking,
            "duration_seconds": round(elapsed, 1),
            "tokens": data.get("usage", {}),
            "code_chars": len(code_context),
        }
    except Exception as e:
        return {
            "agent": agent_key,
            "name": agent_def["name"],
            "status": "error",
            "content": str(e),
            "thinking": "",
            "duration_seconds": round(time.time() - t0, 1),
            "tokens": {},
            "code_chars": len(code_context),
        }


# ── Main ────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Code Review mit Qwen Thinking-Agents")
    parser.add_argument("--agent", type=str, help="Nur diesen Agent ausfuehren")
    parser.add_argument("--list", action="store_true", help="Verfuegbare Agents anzeigen")
    parser.add_argument("--sequential", action="store_true", help="Sequenziell statt parallel")
    parser.add_argument("--batch", type=int, default=0, help="Agents in Batches aufteilen (z.B. --batch 6)")
    args = parser.parse_args()

    if args.list:
        print("Verfuegbare Review-Agents:\n")
        for key, agent in AGENTS.items():
            print(f"  {key:25s} {agent['name']}")
            print(f"  {'':25s} Fokus: {', '.join(agent['focus_dirs'])}")
            print()
        return

    if not API_KEY:
        print("FEHLER: ADESSO_AI_HUB_API_KEY nicht gesetzt")
        print("  export ADESSO_AI_HUB_API_KEY=...")
        sys.exit(1)

    agents_to_run = AGENTS
    if args.agent:
        if args.agent not in AGENTS:
            print(f"FEHLER: Agent '{args.agent}' nicht gefunden. Verfuegbar: {', '.join(AGENTS.keys())}")
            sys.exit(1)
        agents_to_run = {args.agent: AGENTS[args.agent]}

    print(f"=== Code Review: hallenfussball-pwa ===")
    print(f"Modell: {MODEL} (Thinking Mode)")
    print(f"Agents: {len(agents_to_run)}")
    print()

    # Code sammeln pro Agent
    agent_contexts = {}
    for key, agent in agents_to_run.items():
        max_c = agent.get("max_chars", 120000)
        print(f"  Sammle Code fuer {agent['name']}...")
        agent_contexts[key] = collect_files(agent["focus_dirs"], max_chars=max_c)
        chars = len(agent_contexts[key])
        print(f"    -> {chars:,} Zeichen aus {', '.join(agent['focus_dirs'])}")

    print()

    results = []
    t_total = time.time()

    if args.sequential:
        print(f"Starte {len(agents_to_run)} Agents sequenziell...\n")
        for key, agent in agents_to_run.items():
            print(f"  [{key}] Laeuft...")
            result = call_qwen_thinking(key, agent, agent_contexts[key])
            results.append(result)
            icon = "OK" if result["status"] == "success" else "FAIL"
            print(f"  [{key}] {icon} ({result['duration_seconds']}s)")
    elif args.batch > 0:
        # In Batches aufteilen
        keys = list(agents_to_run.keys())
        batch_size = args.batch
        batches = [keys[i:i + batch_size] for i in range(0, len(keys), batch_size)]
        print(f"Starte {len(agents_to_run)} Agents in {len(batches)} Batches a {batch_size}...\n")

        for batch_num, batch_keys in enumerate(batches, 1):
            print(f"--- Batch {batch_num}/{len(batches)} ({len(batch_keys)} Agents) ---")
            with ThreadPoolExecutor(max_workers=len(batch_keys)) as pool:
                futures = {
                    pool.submit(call_qwen_thinking, key, agents_to_run[key], agent_contexts[key]): key
                    for key in batch_keys
                }
                for future in as_completed(futures):
                    key = futures[future]
                    result = future.result()
                    results.append(result)
                    icon = "OK" if result["status"] == "success" else "FAIL"
                    print(f"  {icon} [{key}] {result['status']} ({result['duration_seconds']}s)")
            print()
    else:
        print(f"Starte {len(agents_to_run)} Agents parallel...\n")
        with ThreadPoolExecutor(max_workers=len(agents_to_run)) as pool:
            futures = {
                pool.submit(call_qwen_thinking, key, agent, agent_contexts[key]): key
                for key, agent in agents_to_run.items()
            }
            for future in as_completed(futures):
                key = futures[future]
                result = future.result()
                results.append(result)
                icon = "OK" if result["status"] == "success" else "FAIL"
                print(f"  {icon} [{key}] {result['status']} ({result['duration_seconds']}s)")

    total_time = round(time.time() - t_total, 1)

    # Ergebnisse speichern
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M")

    # Einzelne Agent-Reports
    print(f"\nSpeichere Reports:")
    for result in sorted(results, key=lambda x: x["agent"]):
        out_path = REVIEWS_DIR / f"{timestamp}_{result['agent']}.md"
        with open(out_path, "w") as f:
            f.write(f"# Code Review: {result['name']}\n\n")
            f.write(f"**Modell:** {MODEL} (Thinking Mode)  \n")
            f.write(f"**Dauer:** {result['duration_seconds']}s  \n")
            f.write(f"**Status:** {result['status']}  \n")
            f.write(f"**Code-Kontext:** {result.get('code_chars', 0):,} Zeichen  \n\n")
            if result.get("thinking"):
                f.write(f"<details><summary>Thinking Process ({len(result['thinking']):,} Zeichen)</summary>\n\n")
                f.write(f"{result['thinking']}\n\n</details>\n\n---\n\n")
            f.write(result["content"])
        print(f"  -> {out_path.name}")

    # Gesamt-Report
    summary_path = REVIEWS_DIR / f"{timestamp}_SUMMARY.md"
    with open(summary_path, "w") as f:
        f.write(f"# Code Review Summary: hallenfussball-pwa\n\n")
        f.write(f"**Datum:** {datetime.now().strftime('%Y-%m-%d %H:%M')}  \n")
        f.write(f"**Modell:** {MODEL} (Thinking Mode)  \n")
        f.write(f"**Gesamtdauer:** {total_time}s  \n")
        f.write(f"**Agents:** {len(results)}  \n\n")

        f.write("## Uebersicht\n\n")
        f.write("| # | Agent | Status | Dauer | Code | Tokens |\n")
        f.write("|---|-------|--------|-------|------|--------|\n")
        for i, r in enumerate(sorted(results, key=lambda x: x["agent"]), 1):
            tokens = r.get("tokens", {})
            total_tok = tokens.get("total_tokens", "?")
            code_k = round(r.get("code_chars", 0) / 1000, 1)
            f.write(f"| {i} | {r['name']} | {r['status']} | {r['duration_seconds']}s | {code_k}k | {total_tok} |\n")

        f.write(f"\n---\n\n")

        for r in sorted(results, key=lambda x: x["agent"]):
            f.write(f"## {r['name']}\n\n")
            if r["status"] == "error":
                f.write(f"> **FEHLER:** {r['content']}\n\n")
            else:
                f.write(f"{r['content']}\n\n")
            f.write(f"---\n\n")

    print(f"\n  -> {summary_path.name}")
    print(f"\n=== Fertig: {len(results)} Agents in {total_time}s ===")

    # Fehler-Summary
    errors = [r for r in results if r["status"] != "success"]
    if errors:
        print(f"\n  WARNUNG: {len(errors)} Agent(s) fehlgeschlagen:")
        for e in errors:
            print(f"    - {e['agent']}: {e['content'][:100]}")


if __name__ == "__main__":
    main()
