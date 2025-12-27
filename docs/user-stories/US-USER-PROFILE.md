# US-USER-PROFILE: Benutzerbereich & Profilverwaltung

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-USER-PROFILE |
| **Priorität** | Medium |
| **Status** | Draft |
| **Erstellt** | 2025-12-20 |
| **Kategorie** | Admin |
| **Impact** | Mittel |

---

## User Story

**Als** Turnier-Organisator
**möchte ich** einen persönlichen Benutzerbereich mit Profil und Einstellungen
**damit** meine Kontaktdaten automatisch in Turnieren erscheinen, mein Logo verwendet wird und ich App-weite Einstellungen zentral verwalten kann.

---

## Kontext & Motivation

Die App ermöglicht bereits:
- Kontaktinformationen im Tournament-Footer (`ContactInfo` in TournamentFooter.tsx)
- Logo-URL für Turniere (`logoUrl` Parameter)
- QR-Codes für Live-Tracking
- Externe Turnier-Imports

**Problem:** Diese Daten müssen aktuell pro Turnier eingegeben oder sind nicht persistent. Ein zentraler Benutzerbereich würde:
1. Wiederverwendbare Profildaten speichern
2. Vereins-/Organisator-Logo zentral verwalten
3. Standard-Einstellungen für neue Turniere definieren
4. Datenschutz-konforme Datenverwaltung ermöglichen

---

## UI-Konzept

### Position & Zugang
- **Icon:** Benutzer-Avatar (Kreis mit Initialen oder Bild) rechts oben in der Header-Leiste
- **Verhalten:** Klick öffnet Dropdown-Menü oder navigiert zu Profil-Seite
- **Fallback:** Wenn kein Profilbild → Initialen aus Namen oder Standard-Icon

### Dropdown-Menü (Quick Access)
```
┌─────────────────────────┐
│ 👤 Daniel Stiegler      │
│    daniel@example.com   │
├─────────────────────────┤
│ 📋 Meine Turniere (12)  │
│ ⚙️ Einstellungen        │
│ 📤 Daten exportieren    │
├─────────────────────────┤
│ ❓ Hilfe & Support      │
│ 🚪 Abmelden             │
└─────────────────────────┘
```

### Profil-Seite (Vollansicht)

#### Tab 1: Persönliche Daten
- **Name** (wird in Turnier-Fußzeile als "Turnierleitung" angezeigt)
- **E-Mail** (Kontakt für Rückfragen)
- **Telefon** (optional, für Turniertag)
- **Verein/Organisation** (erscheint als Veranstalter)
- **Profilbild** (für Avatar in der App)

#### Tab 2: Branding & Logo
- **Vereins-/Organisations-Logo** (Upload, max 2MB, PNG/JPG/SVG)
- **Logo-Vorschau** in verschiedenen Größen (Spielplan-Header, PDF, etc.)
- **Standard-Logo für neue Turniere** aktivieren/deaktivieren
- **Hintergrundfarbe für Logo** (falls transparent)

#### Tab 3: Standard-Einstellungen
Voreinstellungen für neue Turniere:
- **Standard-Spielzeit** (z.B. 10 Min.)
- **Standard-Pausenzeit** (z.B. 2 Min.)
- **Standard-Punktesystem** (3-1-0 oder 2-1-0)
- **Standard-Platzierungskriterien** (Reihenfolge)
- **Bambini-Modus als Standard** (für Kinderturnier-Organisatoren)
- **Ergebnisse für Öffentlichkeit ausblenden** (Standard)

#### Tab 4: Mein Team
- **Team-Mitglieder verwalten** (Helfer die regelmäßig unterstützen)
- **Rollen zuweisen** (Zeitnehmer, Spielleiter, Vollzugriff)
- **Altersklassen-Einschränkung** (optional: z.B. nur U11, U13)
- **Schnell-Zuweisung** bei neuen Turnieren

→ Detailliert beschrieben in **US-INVITE**

#### Tab 5: Datenschutz & Daten
- **Alle Daten exportieren** (JSON-Export aller Turniere + Profil)
- **Einzelne Turniere exportieren** (Auswahl-Liste)
- **Alle Daten löschen** (DSGVO-konform, mit Bestätigung)
- **Lokale Daten löschen** (Cache leeren, Profil behalten)

#### Tab 6: App-Einstellungen
- **Dark/Light Mode** (aktuell nur Dark)
- **Sprache** (DE/EN - Vorbereitung für Internationalisierung)
- **Benachrichtigungen** (PWA Push-Notifications für Turnier-Updates)
- **Offline-Modus** (Daten für Offline-Nutzung cachen)
- **Ergebnis-Sperre** (Standard: aktiviert)
  - Wenn aktiviert: Beendete Spiele können nur über den Korrektur-Workflow geändert werden
  - Wenn deaktiviert: Alle Ergebnisse sind jederzeit direkt editierbar
  - ✅ **Implementiert** in `useAppSettings` Hook (`lockFinishedResults`)

---

## Acceptance Criteria

### Profil-Zugang
1. Given die App ist geöffnet, When ich auf den Avatar rechts oben klicke, Then öffnet sich das Benutzer-Dropdown-Menü
2. Given das Dropdown ist offen, When ich "Einstellungen" wähle, Then navigiere ich zur Profil-Seite
3. Given ich bin auf der Profil-Seite, When ich Änderungen vornehme, Then werden diese automatisch in localStorage gespeichert

### Persönliche Daten
4. Given ich habe meinen Namen eingegeben, When ich ein neues Turnier erstelle, Then wird mein Name als "Turnierleitung" im Footer vorgeschlagen
5. Given ich habe meine Kontaktdaten gespeichert, When ich den Spielplan drucke/exportiere, Then erscheinen diese im Footer
6. Given mein Profil hat ein Bild, Then zeigt der Avatar mein Bild statt Initialen

### Logo-Management
7. Given ich lade ein Logo hoch, When das Bild größer als 2MB ist, Then erhalte ich eine Fehlermeldung mit Komprimierungs-Hinweis
8. Given ich habe ein Standard-Logo gesetzt, When ich ein neues Turnier erstelle, Then ist das Logo automatisch zugewiesen
9. Given ein Turnier hat mein Logo, When ich das Standard-Logo ändere, Then bleiben bestehende Turniere unverändert (nur neue erben)

### Standard-Einstellungen
10. Given ich habe Standard-Spielzeit auf 12 Min. gesetzt, When ich ein neues Turnier erstelle, Then ist 12 Min. vorausgewählt
11. Given ich ändere meine Standards, When bestehende Turniere existieren, Then werden diese NICHT verändert (nur neue)

### Datenexport
12. Given ich klicke "Alle Daten exportieren", When der Export fertig ist, Then erhalte ich eine JSON-Datei mit allen Turnieren und Profildaten
13. Given ich wähle "Turnier exportieren" für ein einzelnes Turnier, Then erhalte ich eine JSON-Datei nur für dieses Turnier
14. Given ich klicke "Alle Daten löschen", Then erscheint ein Bestätigungsdialog mit deutlicher Warnung

### Turnier-Übersicht
15. Given ich öffne "Meine Turniere", Then sehe ich eine Liste aller Turniere mit Status-Badge (Draft/Live/Beendet)
16. Given ich bin in der Turnier-Übersicht, When ich ein Turnier auswähle, Then navigiere ich zum Turnier-Management

---

## Technische Details

### Datenmodell (localStorage)

```typescript
interface UserProfile {
  id: string;                    // UUID
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp

  // Persönliche Daten
  name: string;
  email?: string;
  phone?: string;
  organization?: string;         // Verein/Organisation
  avatarUrl?: string;            // Base64 oder URL

  // Branding
  logoUrl?: string;              // Base64 oder URL
  logoBackgroundColor?: string;  // Hex-Farbe für transparente Logos
  useLogoAsDefault: boolean;

  // Team-Mitglieder (siehe US-INVITE für Details)
  team: TeamMember[];            // Persistente Helfer mit Rollen

  // Standard-Einstellungen für neue Turniere
  defaults: {
    groupPhaseGameDuration: number;
    groupPhaseBreakDuration: number;
    pointSystem: {
      win: number;
      draw: number;
      loss: number;
    };
    placementLogic: PlacementCriterion[];
    isKidsTournament: boolean;
    hideScoresForPublic: boolean;
    hideRankingsForPublic: boolean;
  };

  // App-Einstellungen
  settings: {
    theme: 'dark' | 'light' | 'system';
    language: 'de' | 'en';
    enableNotifications: boolean;
    enableOfflineMode: boolean;
  };
}
```

### Komponenten-Struktur

```
src/
├── features/
│   └── user-profile/
│       ├── UserProfileScreen.tsx      # Hauptseite
│       ├── ProfileTab.tsx             # Persönliche Daten
│       ├── BrandingTab.tsx            # Logo & Branding
│       ├── DefaultsTab.tsx            # Standard-Einstellungen
│       ├── TeamTab.tsx                # Mein Team (siehe US-INVITE)
│       ├── PrivacyTab.tsx             # Datenschutz & Export
│       ├── SettingsTab.tsx            # App-Einstellungen
│       └── index.ts
├── components/
│   └── UserMenu/
│       ├── UserAvatar.tsx             # Avatar-Komponente
│       ├── UserDropdown.tsx           # Dropdown-Menü
│       └── index.ts
├── hooks/
│   └── useUserProfile.ts              # Profil-Hook (localStorage)
└── types/
    └── userProfile.ts                 # TypeScript-Typen
```

### Integration in bestehende Komponenten

1. **App.tsx / Layout**: UserAvatar + UserDropdown rechts oben
2. **TournamentCreationScreen**: Defaults aus Profil laden
3. **TournamentFooter**: ContactInfo aus Profil
4. **ScheduleDisplay**: Logo aus Profil (wenn kein Turnier-Logo)

---

## UX-Empfehlungen

1. **Onboarding**: Beim ersten App-Start sanfter Hinweis "Profil einrichten für personalisierte Turniere"
2. **Autosave**: Alle Änderungen sofort speichern, kleine "Gespeichert"-Bestätigung
3. **Bildkomprimierung**: Bei zu großen Bildern automatisch verkleinern anbieten
4. **Skeleton Loading**: Beim Laden des Profils Skeleton-UI zeigen
5. **Avatar-Fallback**: Farbiger Kreis mit Initialen (Farbe aus Name generiert)
6. **Responsive**: Profil-Seite als Tab-Navigation auf Mobile, Sidebar auf Desktop

---

## Abhängigkeiten

- **Bestehend:** ContactInfo-Interface, logoUrl-Parameter, theme.ts
- **Neu:** useUserProfile Hook, UserProfile-Type, Avatar-Komponente

---

## Abgrenzung (Out of Scope)

- **Cloud-Sync**: Profil nur lokal (localStorage), kein Backend
- **Multi-User**: Keine Benutzerverwaltung, nur ein Profil pro Gerät
- **OAuth/Login**: Kein echtes Login-System (nur lokales Profil)
- **Rollen**: Keine Unterscheidung Admin/User (kommt ggf. später)

---

## Verwandte User Stories

- **US-INVITE**: Einladungen & Team-Management (Team-Verwaltung im Profil)
- **US-005**: Import externer Turniere (nutzt Profil für Standard-Werte)
- **TOUR-EDIT-META**: Turnier-Metadaten (erbt Kontaktdaten aus Profil)
- **MON-PUBLIC-01**: Öffentlicher Spielplan (zeigt Kontaktdaten aus Profil)

---

## Mockups

### Avatar & Dropdown (Header)
```
┌──────────────────────────────────────────────────────┐
│ 🏟️ Hallenfußball                      [🔔] [DS ▼]   │
└──────────────────────────────────────────────────────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │ Daniel Stiegler   │
                                    │ daniel@mail.de    │
                                    ├───────────────────┤
                                    │ 📋 Meine Turniere │
                                    │ ⚙️ Einstellungen  │
                                    │ 📤 Daten export.  │
                                    ├───────────────────┤
                                    │ ❓ Hilfe          │
                                    └───────────────────┘
```

### Profil-Seite (Desktop)
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Zurück                              Profil & Einstellungen    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────┐  Daniel Stiegler                                      │
│  │  DS  │  daniel@example.com                                   │
│  └──────┘  FC Musterstadt e.V.                                  │
│            [Profilbild ändern]                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [Profil] [Branding] [Standards] [Mein Team] [Datenschutz] [App] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Persönliche Daten                                              │
│  ─────────────────                                              │
│                                                                 │
│  Name             [Daniel Stiegler          ]                   │
│  E-Mail           [daniel@example.com       ]                   │
│  Telefon          [+49 123 456789           ]                   │
│  Organisation     [FC Musterstadt e.V.      ]                   │
│                                                                 │
│  ℹ️ Diese Daten werden als Kontaktinformationen in deinen       │
│     Turnier-Spielplänen angezeigt.                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
