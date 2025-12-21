# User Stories: Multi-User & Cloud-Sync

## Legende

| Priorität | Bedeutung |
|-----------|-----------|
| **P0** | Must-Have (MVP) |
| **P1** | Should-Have |
| **P2** | Nice-to-Have |

| Story Points | Aufwand |
|--------------|---------|
| 1 | < 2 Stunden |
| 2 | 2-4 Stunden |
| 3 | 0.5-1 Tag |
| 5 | 1-2 Tage |
| 8 | 3-5 Tage |
| 13 | 1-2 Wochen |

---

## Epic 1: Authentifizierung (AUTH)

### AUTH-001: Google Login
**Priorität:** P0 | **Story Points:** 3

**Als** Turnierorganisator
**möchte ich** mich mit meinem Google-Konto anmelden können
**damit** ich keine neuen Zugangsdaten erstellen muss

#### Akzeptanzkriterien
- [ ] "Mit Google anmelden" Button prominent auf Login-Seite
- [ ] 1-Click Login ohne zusätzliche Passwort-Eingabe
- [ ] Automatische Übernahme von Name und Profilbild aus Google
- [ ] Weiterleitung zum Dashboard nach erfolgreicher Anmeldung
- [ ] Fehlerbehandlung bei:
  - Abgelehnter Google-Berechtigung
  - Popup-Blocker aktiv
  - Netzwerkfehler
- [ ] "Angemeldet bleiben" für 30 Tage (Refresh Token)

#### Technische Hinweise
```typescript
// Supabase Auth mit Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'email profile',
  },
});
```

#### Definition of Done
- [ ] Unit Tests für Auth-Flow
- [ ] E2E Test: Login → Dashboard
- [ ] Error States in UI implementiert
- [ ] Mobile-optimiert (PWA)

---

### AUTH-002: E-Mail Magic Link
**Priorität:** P0 | **Story Points:** 3

**Als** Benutzer ohne Google-Konto
**möchte ich** mich per E-Mail-Link anmelden können
**damit** ich die App auch ohne Google nutzen kann

#### Akzeptanzkriterien
- [ ] E-Mail-Eingabefeld mit Validierung
- [ ] "Magic Link senden" Button
- [ ] Bestätigungsanzeige: "E-Mail wurde gesendet"
- [ ] E-Mail enthält einmaligen Login-Link
- [ ] Link ist 24 Stunden gültig
- [ ] Automatische Anmeldung beim Klick auf Link
- [ ] Fallback-Meldung bei ungültigem/abgelaufenem Link
- [ ] Rate Limiting: Max. 5 Anfragen pro Stunde pro E-Mail

#### E-Mail Template
```
Betreff: Dein Login-Link für Hallenfußball Turnier-Manager

Hallo,

Klicke auf den folgenden Link, um dich anzumelden:
[Jetzt anmelden]

Der Link ist 24 Stunden gültig.

Falls du diese E-Mail nicht angefordert hast,
kannst du sie ignorieren.

Sportliche Grüße,
Hallenfußball Turnier-Manager
```

#### Definition of Done
- [ ] E-Mail-Versand getestet (Spam-Check)
- [ ] Link-Validierung implementiert
- [ ] Ablauf-Handling
- [ ] Responsive E-Mail Template

---

### AUTH-003: Gast-Modus (Offline-First)
**Priorität:** P0 | **Story Points:** 2

**Als** Gelegenheitsnutzer
**möchte ich** die App ohne Anmeldung testen können
**damit** ich entscheiden kann, ob ich ein Konto erstelle

#### Akzeptanzkriterien
- [ ] "Als Gast fortfahren" Button auf Login-Seite
- [ ] Alle Core-Features verfügbar (Turnier erstellen, verwalten)
- [ ] Daten werden nur lokal gespeichert (LocalStorage/IndexedDB)
- [ ] Persistenter Hinweis-Banner: "Anmelden für Cloud-Sync & Backup"
- [ ] Banner enthält "Jetzt anmelden" Button
- [ ] Lokale Daten bleiben nach Browser-Neustart erhalten
- [ ] Kein Zugriff auf Sharing-Features (ausgegraut mit Tooltip)

#### UI-Mockup
```
┌─────────────────────────────────────────────────┐
│ ℹ️ Du bist als Gast angemeldet                  │
│    Melde dich an für Cloud-Backup & Sharing     │
│                                    [Anmelden]   │
└─────────────────────────────────────────────────┘
```

#### Definition of Done
- [ ] LocalStorage-Persistenz getestet
- [ ] Feature-Gates für Sharing implementiert
- [ ] Banner nicht nervend (max. 1x pro Session)

---

### AUTH-004: Benutzerprofil verwalten
**Priorität:** P1 | **Story Points:** 2

**Als** angemeldeter Benutzer
**möchte ich** mein Profil bearbeiten können
**damit** mein Name korrekt bei Korrekturen angezeigt wird

#### Akzeptanzkriterien
- [ ] Profil-Seite erreichbar über Avatar/Menü
- [ ] Anzeigename bearbeitbar
- [ ] Avatar-Bild änderbar (Upload oder URL)
- [ ] E-Mail-Adresse angezeigt (nicht änderbar)
- [ ] "Abmelden" Button
- [ ] "Konto löschen" Option (DSGVO)
- [ ] Bestätigungsdialog bei Konto-Löschung

#### Datenstruktur
```typescript
interface UserProfile {
  id: string;           // UUID von Supabase Auth
  displayName: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Definition of Done
- [ ] Profil-Seite responsive
- [ ] Avatar-Upload funktioniert
- [ ] DSGVO-konforme Löschfunktion
- [ ] Audit-Log bei Löschung

---

### AUTH-005: Session-Verwaltung
**Priorität:** P1 | **Story Points:** 2

**Als** Benutzer mit mehreren Geräten
**möchte ich** meine aktiven Sessions sehen und verwalten können
**damit** ich unbefugten Zugriff verhindern kann

#### Akzeptanzkriterien
- [ ] Liste aller aktiven Sessions in Profil-Einstellungen
- [ ] Anzeige: Gerät, Browser, Letzter Zugriff, Standort (ungefähr)
- [ ] Aktuelle Session markiert
- [ ] "Abmelden" Button pro Session
- [ ] "Alle anderen Geräte abmelden" Button
- [ ] Benachrichtigung bei Login von neuem Gerät (optional)

#### Definition of Done
- [ ] Session-Tracking implementiert
- [ ] Remote-Logout funktioniert

---

## Epic 2: Cloud-Synchronisierung (SYNC)

### SYNC-001: Automatischer Cloud-Sync
**Priorität:** P0 | **Story Points:** 5

**Als** angemeldeter Benutzer
**möchte ich** dass meine Turniere automatisch in der Cloud gespeichert werden
**damit** ich von jedem Gerät darauf zugreifen kann

#### Akzeptanzkriterien
- [ ] Turniere werden bei jeder Änderung automatisch gespeichert
- [ ] Sync-Status-Indikator in der UI:
  - ✓ "Gespeichert"
  - ⏳ "Speichert..."
  - ⚠️ "Offline - Änderungen werden gespeichert"
- [ ] Turniere erscheinen auf anderen Geräten nach Refresh
- [ ] Letzte Synchronisierung mit Zeitstempel angezeigt
- [ ] Keine doppelten Turniere bei gleichzeitiger Bearbeitung

#### Sync-Status UI
```typescript
type SyncStatus =
  | { state: 'synced'; lastSync: Date }
  | { state: 'syncing'; pendingChanges: number }
  | { state: 'offline'; pendingChanges: number }
  | { state: 'error'; message: string };
```

#### Definition of Done
- [ ] Optimistisches UI-Update implementiert
- [ ] Debouncing bei schnellen Änderungen (500ms)
- [ ] Sync-Queue für zuverlässige Übertragung
- [ ] E2E Test: Änderung auf Gerät A → Erscheint auf Gerät B

---

### SYNC-002: Offline-Modus
**Priorität:** P0 | **Story Points:** 8

**Als** Turnierorganisator in einer Sporthalle ohne Internet
**möchte ich** Ergebnisse offline eingeben können
**damit** das Turnier nicht unterbrochen wird

#### Akzeptanzkriterien
- [ ] Offline-Banner erscheint bei Verbindungsverlust
- [ ] Alle Eingaben werden in IndexedDB gespeichert
- [ ] Anzahl ausstehender Änderungen wird angezeigt
- [ ] Automatischer Sync wenn wieder online
- [ ] Keine Datenverluste bei Verbindungsabbruch
- [ ] App bleibt voll funktionsfähig offline
- [ ] PWA installierbar für echten Offline-Betrieb

#### Offline-Indikator UI
```
┌─────────────────────────────────────────────────┐
│ 📴 Offline-Modus aktiv                          │
│    12 Änderungen werden gespeichert             │
│    Sync startet automatisch bei Verbindung      │
└─────────────────────────────────────────────────┘
```

#### Technische Architektur
```
┌─────────────────────────────────────────────────┐
│                 React State                      │
│                 (Zustand)                        │
└───────────────────────┬─────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              IndexedDB (Dexie.js)               │
│  • tournaments                                   │
│  • matches                                       │
│  • syncQueue                                     │
└───────────────────────┬─────────────────────────┘
                        │
                        ▼ (wenn online)
┌─────────────────────────────────────────────────┐
│              Supabase Cloud                     │
└─────────────────────────────────────────────────┘
```

#### Definition of Done
- [ ] IndexedDB-Schema implementiert
- [ ] Service Worker für Offline-Caching
- [ ] Sync-Queue mit Retry-Logik
- [ ] Manuelle Tests in Flugmodus
- [ ] PWA-Manifest konfiguriert

---

### SYNC-003: Konflikt-Erkennung und -Auflösung
**Priorität:** P1 | **Story Points:** 5

**Als** Benutzer mit mehreren Geräten
**möchte ich** bei Konflikten entscheiden können, welche Version gilt
**damit** keine wichtigen Daten verloren gehen

#### Akzeptanzkriterien
- [ ] Konflikt-Warnung bei abweichenden Versionen
- [ ] Vergleichsansicht: Lokale vs. Server-Version
- [ ] Optionen:
  - "Meine Version behalten"
  - "Server-Version übernehmen"
  - "Zusammenführen" (bei nicht-kritischen Feldern)
- [ ] Automatische Auflösung bei trivialen Konflikten (z.B. nur `updatedAt` unterschiedlich)
- [ ] Konflikt-Historie einsehbar

#### Konflikt-Dialog UI
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Konflikt erkannt                             │
├─────────────────────────────────────────────────┤
│                                                  │
│ Spiel #5: FC Bayern vs. TSV 1860                │
│                                                  │
│ ┌───────────────┬───────────────┐               │
│ │ Deine Version │ Server-Version│               │
│ ├───────────────┼───────────────┤               │
│ │ Ergebnis: 2:1 │ Ergebnis: 2:2 │               │
│ │ 14:32 Uhr     │ 14:35 Uhr     │               │
│ └───────────────┴───────────────┘               │
│                                                  │
│ [Meine behalten] [Server nehmen] [Abbrechen]    │
└─────────────────────────────────────────────────┘
```

#### Konflikt-Strategie
```typescript
type ConflictResolution =
  | 'local-wins'      // Lokale Version erzwingen
  | 'remote-wins'     // Server-Version übernehmen
  | 'last-write-wins' // Neueste Version gewinnt (automatisch)
  | 'manual-merge';   // Benutzer entscheidet

interface ConflictRecord {
  id: string;
  entityType: 'tournament' | 'match' | 'team';
  entityId: string;
  localVersion: unknown;
  remoteVersion: unknown;
  localTimestamp: Date;
  remoteTimestamp: Date;
  resolution?: ConflictResolution;
  resolvedAt?: Date;
}
```

#### Definition of Done
- [ ] Konflikt-Erkennung bei Sync
- [ ] Vergleichs-UI implementiert
- [ ] Auflösungs-Strategien getestet
- [ ] Edge Cases (gleichzeitige Bearbeitung) abgedeckt

---

### SYNC-004: Echtzeit-Updates (Live-Turnier)
**Priorität:** P0 | **Story Points:** 5

**Als** Zuschauer eines laufenden Turniers
**möchte ich** Ergebnisse in Echtzeit sehen
**damit** ich keine wichtigen Spiele verpasse

#### Akzeptanzkriterien
- [ ] Ergebnisse erscheinen ohne manuellen Refresh
- [ ] Tabellen aktualisieren sich automatisch
- [ ] Visueller Hinweis bei neuen Ergebnissen (Highlight)
- [ ] "Live"-Badge bei laufenden Spielen
- [ ] Latenz < 2 Sekunden
- [ ] Keine Performance-Probleme bei vielen Zuschauern
- [ ] Graceful Degradation bei Verbindungsproblemen

#### Realtime-Subscription
```typescript
// Supabase Realtime Channel
const channel = supabase
  .channel(`tournament-${tournamentId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'matches',
      filter: `tournament_id=eq.${tournamentId}`,
    },
    (payload) => {
      // Update lokalen State
      handleMatchUpdate(payload.new);
    }
  )
  .subscribe();
```

#### UI-Feedback bei Updates
```css
/* Highlight für neue Ergebnisse */
@keyframes result-flash {
  0% { background-color: rgba(0, 230, 118, 0.3); }
  100% { background-color: transparent; }
}

.result-updated {
  animation: result-flash 2s ease-out;
}
```

#### Definition of Done
- [ ] Realtime-Subscription implementiert
- [ ] Latenz-Tests < 2s
- [ ] Load-Test mit 100 gleichzeitigen Zuschauern
- [ ] Reconnection-Logik bei Verbindungsverlust

---

### SYNC-005: Daten-Migration (Gast → Account)
**Priorität:** P0 | **Story Points:** 3

**Als** bisheriger Gast-Benutzer
**möchte ich** meine lokalen Turniere in die Cloud migrieren können
**damit** ich sie nicht verliere

#### Akzeptanzkriterien
- [ ] Nach Login: "Lokale Turniere gefunden" Dialog
- [ ] Liste der lokalen Turniere mit Auswahl
- [ ] Fortschrittsanzeige während Migration
- [ ] Erfolgs-/Fehlermeldung pro Turnier
- [ ] Lokale Kopie wird nach erfolgreicher Migration gelöscht
- [ ] Option: "Später migrieren" (erneute Erinnerung nach 7 Tagen)
- [ ] Fehlerbehandlung bei teilweiser Migration

#### Migration-Dialog UI
```
┌─────────────────────────────────────────────────┐
│ 📦 Lokale Turniere gefunden                     │
├─────────────────────────────────────────────────┤
│                                                  │
│ Wir haben 3 Turniere auf diesem Gerät gefunden. │
│ Möchtest du sie in die Cloud übertragen?        │
│                                                  │
│ ☑ U12 Hallenturnier (15.12.2024)               │
│ ☑ Bambini Cup (22.12.2024)                     │
│ ☐ Test-Turnier (gelöscht)                       │
│                                                  │
│ [Ausgewählte migrieren]        [Später]         │
└─────────────────────────────────────────────────┘
```

#### Definition of Done
- [ ] Migration-Wizard implementiert
- [ ] Fortschrittsanzeige
- [ ] Rollback bei Fehlern
- [ ] Keine Duplikate nach Migration

---

## Epic 3: Turnier-Sharing (SHARE)

### SHARE-001: Öffentlicher Turnier-Link
**Priorität:** P0 | **Story Points:** 3

**Als** Turnierorganisator
**möchte ich** einen kurzen Link zu meinem Turnier teilen können
**damit** Zuschauer einfach darauf zugreifen können

#### Akzeptanzkriterien
- [ ] "Teilen"-Button im Turnier-Header
- [ ] Generiert Kurzlink (z.B. `t.hallenfussball.app/ABC123`)
- [ ] Link ist per Button kopierbar
- [ ] Share-Sheet auf Mobile (WhatsApp, SMS, etc.)
- [ ] QR-Code für den Link generierbar
- [ ] Öffentliche Ansicht ohne Login erforderlich
- [ ] Nur-Lesen-Modus für Besucher (keine Bearbeitung)

#### Share-Dialog UI
```
┌─────────────────────────────────────────────────┐
│ 📤 Turnier teilen                               │
├─────────────────────────────────────────────────┤
│                                                  │
│ Link: t.hallenfussball.app/ABC123    [Kopieren] │
│                                                  │
│ ┌─────────┐                                     │
│ │ QR-Code │  Scanne für Live-Ergebnisse        │
│ │  █▀▀█   │                                     │
│ │  █▀▀█   │                                     │
│ └─────────┘                                     │
│                                                  │
│ [WhatsApp] [E-Mail] [Mehr...]                   │
│                                                  │
│ Sichtbarkeit: ◉ Öffentlich ○ Nur mit Link      │
└─────────────────────────────────────────────────┘
```

#### Kurzlink-Generierung
```typescript
// Generiert 6-stelligen alphanumerischen Code
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne I,O,0,1
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
```

#### Definition of Done
- [ ] Kurzlink-Service implementiert
- [ ] QR-Code-Generierung
- [ ] Web Share API Integration
- [ ] Analytics: Aufrufe zählen

---

### SHARE-002: Helfer/Collaborator einladen
**Priorität:** P1 | **Story Points:** 5

**Als** Turnierorganisator
**möchte ich** Helfer einladen können, die Ergebnisse eintragen
**damit** ich nicht alles alleine machen muss

#### Akzeptanzkriterien
- [ ] "Helfer einladen" Button in Turnier-Einstellungen
- [ ] Einladung per E-Mail oder Einladungslink
- [ ] Helfer müssen kein Konto haben (Magic Link)
- [ ] Rollen:
  - **Viewer**: Nur lesen
  - **Collaborator**: Ergebnisse eintragen, Timer starten
  - **Admin**: Alles außer Löschen
- [ ] Übersicht aller Einladungen mit Status
- [ ] Einladungen widerrufbar
- [ ] Helfer sehen nur zugewiesenes Turnier

#### Einladungs-Flow
```
┌───────────────────────────────────────────────────────┐
│                    EINLADUNGS-FLOW                     │
├───────────────────────────────────────────────────────┤
│                                                        │
│  1. Organisator klickt "Helfer einladen"              │
│                    │                                   │
│                    ▼                                   │
│  2. E-Mail eingeben + Rolle wählen                    │
│                    │                                   │
│                    ▼                                   │
│  3. Einladungs-E-Mail wird gesendet                   │
│                    │                                   │
│                    ▼                                   │
│  4. Helfer klickt Link                                │
│                    │                                   │
│        ┌──────────┴──────────┐                        │
│        ▼                     ▼                         │
│   Hat Account?          Kein Account                  │
│        │                     │                         │
│        ▼                     ▼                         │
│   Automatisch           Magic Link                    │
│   verbunden             Login                         │
│                              │                         │
│                              ▼                         │
│                         Account                        │
│                         erstellt                       │
└───────────────────────────────────────────────────────┘
```

#### Rollen-Matrix
| Aktion | Viewer | Collaborator | Admin | Owner |
|--------|--------|--------------|-------|-------|
| Spielplan sehen | ✓ | ✓ | ✓ | ✓ |
| Ergebnisse eintragen | - | ✓ | ✓ | ✓ |
| Timer starten/stoppen | - | ✓ | ✓ | ✓ |
| Spielplan bearbeiten | - | - | ✓ | ✓ |
| Teams bearbeiten | - | - | ✓ | ✓ |
| Einstellungen ändern | - | - | ✓ | ✓ |
| Helfer einladen | - | - | ✓ | ✓ |
| Turnier löschen | - | - | - | ✓ |

#### Definition of Done
- [ ] Einladungs-E-Mail Template
- [ ] Rollen-basierte Zugriffskontrolle (RLS)
- [ ] Einladungs-Management UI
- [ ] E2E Test: Einladung → Annahme → Berechtigung

---

### SHARE-003: Turnier-Besitz übertragen
**Priorität:** P2 | **Story Points:** 3

**Als** Turnierorganisator
**möchte ich** ein Turnier an jemand anderen übertragen können
**damit** diese Person volle Kontrolle erhält

#### Akzeptanzkriterien
- [ ] "Besitz übertragen" in Turnier-Einstellungen
- [ ] Empfänger muss bestätigen (E-Mail-Bestätigung)
- [ ] Alter Besitzer wird zum Admin-Collaborator
- [ ] Alle Daten und Historie bleiben erhalten
- [ ] Audit-Log der Übertragung
- [ ] Übertragung kann nicht rückgängig gemacht werden

#### Transfer-Dialog
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Turnier-Besitz übertragen                    │
├─────────────────────────────────────────────────┤
│                                                  │
│ Du bist dabei, das Turnier                      │
│ "U12 Hallenturnier" zu übertragen.              │
│                                                  │
│ Neuer Besitzer:                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ max.mustermann@email.de                     ││
│ └─────────────────────────────────────────────┘│
│                                                  │
│ ⚠️ Du verlierst die Besitzrechte!              │
│    Du bleibst als Admin erhalten.              │
│                                                  │
│ [Abbrechen]              [Besitz übertragen]    │
└─────────────────────────────────────────────────┘
```

#### Definition of Done
- [ ] Transfer-Flow implementiert
- [ ] E-Mail-Bestätigung für Empfänger
- [ ] Audit-Trail

---

### SHARE-004: Turnier-Duplizierung
**Priorität:** P2 | **Story Points:** 2

**Als** Turnierorganisator
**möchte ich** ein bestehendes Turnier als Vorlage kopieren können
**damit** ich wiederkehrende Turniere schneller erstellen kann

#### Akzeptanzkriterien
- [ ] "Als Vorlage kopieren" Button
- [ ] Kopiert: Einstellungen, Teams (optional), Spielmodus
- [ ] Kopiert NICHT: Ergebnisse, Datum, Share-Code
- [ ] Neues Turnier im Draft-Status
- [ ] Dialog zur Auswahl was kopiert werden soll

#### Definition of Done
- [ ] Kopier-Funktion implementiert
- [ ] Selektive Kopie (mit/ohne Teams)

---

## Epic 4: Datenexport & Backup (EXPORT)

### EXPORT-001: Vollständiger Daten-Export
**Priorität:** P1 | **Story Points:** 2

**Als** Benutzer
**möchte ich** alle meine Daten exportieren können
**damit** ich ein lokales Backup habe

#### Akzeptanzkriterien
- [ ] "Alle Daten exportieren" in Profil-Einstellungen
- [ ] Export-Format: JSON (maschinenlesbar)
- [ ] Enthält: Alle Turniere, Teams, Matches, Ergebnisse
- [ ] Metadaten: Export-Datum, Version
- [ ] Download als `.json` Datei
- [ ] DSGVO-konform (vollständiger Datenexport)

#### Export-Format
```json
{
  "exportVersion": "1.0",
  "exportDate": "2024-12-21T10:30:00Z",
  "user": {
    "id": "uuid",
    "displayName": "Max Mustermann",
    "email": "max@example.com"
  },
  "tournaments": [
    {
      "id": "uuid",
      "title": "U12 Hallenturnier",
      "teams": [...],
      "matches": [...],
      "config": {...}
    }
  ]
}
```

#### Definition of Done
- [ ] Export-Funktion implementiert
- [ ] JSON-Schema dokumentiert
- [ ] Große Exporte getestet (100+ Turniere)

---

### EXPORT-002: Turnier-Import aus Backup
**Priorität:** P2 | **Story Points:** 3

**Als** Benutzer
**möchte ich** ein exportiertes Backup wieder importieren können
**damit** ich meine Daten wiederherstellen kann

#### Akzeptanzkriterien
- [ ] "Backup importieren" in Profil-Einstellungen
- [ ] Akzeptiert `.json` Dateien aus EXPORT-001
- [ ] Validierung der Dateistruktur
- [ ] Warnung bei Duplikaten
- [ ] Fortschrittsanzeige bei großen Imports
- [ ] Fehlerbehandlung mit Details

#### Definition of Done
- [ ] Import-Funktion implementiert
- [ ] Schema-Validierung
- [ ] Duplikat-Erkennung

---

## Epic 5: Administration (ADMIN)

### ADMIN-001: Turnier-Archivierung
**Priorität:** P1 | **Story Points:** 2

**Als** Benutzer mit vielen Turnieren
**möchte ich** alte Turniere archivieren können
**damit** mein Dashboard übersichtlich bleibt

#### Akzeptanzkriterien
- [ ] "Archivieren" Option für abgeschlossene Turniere
- [ ] Archivierte Turniere in separatem Tab/Filter
- [ ] Archivierte Turniere weiterhin einsehbar
- [ ] "Wiederherstellen" Option
- [ ] Automatische Archivierung (optional):
  - Nach X Tagen nach Turnierdatum
  - Konfigurierbar in Einstellungen
- [ ] Archivierte Turniere zählen nicht zum Limit (falls vorhanden)

#### Dashboard-Filter
```
┌─────────────────────────────────────────────────┐
│ Meine Turniere                                   │
│                                                  │
│ [Aktiv (5)] [Archiviert (12)] [Alle]            │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ U12 Hallenturnier           [Archivieren]   │ │
│ │ 15.12.2024 • Abgeschlossen                  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

#### Definition of Done
- [ ] Archivierungs-Status in DB
- [ ] Filter-UI implementiert
- [ ] Auto-Archivierung (optional)

---

### ADMIN-002: Turnier-Statistiken
**Priorität:** P2 | **Story Points:** 3

**Als** Turnierorganisator
**möchte ich** sehen, wie oft mein Turnier angesehen wurde
**damit** ich die Reichweite einschätzen kann

#### Akzeptanzkriterien
- [ ] Aufruf-Statistiken pro Turnier
- [ ] Metriken:
  - Gesamtaufrufe
  - Unique Visitors
  - Aufrufe pro Tag (Graph)
  - Peak-Zeitpunkt
- [ ] Zeitraum-Filter (7 Tage, 30 Tage, Gesamt)
- [ ] Datenschutzkonform (keine IP-Speicherung)

#### Statistik-Ansicht
```
┌─────────────────────────────────────────────────┐
│ 📊 Statistiken: U12 Hallenturnier               │
├─────────────────────────────────────────────────┤
│                                                  │
│ Gesamtaufrufe:      1.234                       │
│ Unique Besucher:      456                       │
│ Peak:               15.12. 14:00 (89 Aufrufe)   │
│                                                  │
│ Aufrufe letzte 7 Tage:                          │
│ ████████████████████████████████▌ 892           │
│                                                  │
│ [7 Tage] [30 Tage] [Gesamt]                     │
└─────────────────────────────────────────────────┘
```

#### Definition of Done
- [ ] Analytics-Events tracken
- [ ] Aggregierte Statistiken berechnen
- [ ] Visualisierung implementiert

---

### ADMIN-003: Benachrichtigungen
**Priorität:** P2 | **Story Points:** 3

**Als** Turnierorganisator
**möchte ich** Benachrichtigungen über wichtige Ereignisse erhalten
**damit** ich immer informiert bin

#### Akzeptanzkriterien
- [ ] Push-Benachrichtigungen (optional, per Opt-in)
- [ ] E-Mail-Benachrichtigungen (konfigurierbar)
- [ ] Ereignisse:
  - Helfer hat Einladung angenommen
  - Turnier wurde von X Personen aufgerufen
  - Alle Gruppenspiele abgeschlossen
  - Turnier beendet
- [ ] Benachrichtigungs-Center in der App
- [ ] Einzeln an/abschaltbar

#### Definition of Done
- [ ] Push-Notifications (PWA)
- [ ] E-Mail-Benachrichtigungen
- [ ] Preferences-UI

---

## Epic 6: Sicherheit & Datenschutz (SEC)

### SEC-001: Row Level Security
**Priorität:** P0 | **Story Points:** 5

**Als** Entwickler
**möchte ich** dass die Datenbank-Zugriffsregeln auf Zeilenebene implementiert sind
**damit** Benutzer nur ihre eigenen Daten sehen können

#### Akzeptanzkriterien
- [ ] RLS für alle Tabellen aktiviert
- [ ] Policies:
  - Benutzer sieht nur eigene Turniere
  - Öffentliche Turniere für alle sichtbar
  - Collaboratoren haben Zugriff auf geteilte Turniere
- [ ] Keine Daten-Leaks durch API
- [ ] Penetration-Test bestanden

#### RLS-Policies
```sql
-- Turniere: Eigene + Öffentliche + Geteilte
CREATE POLICY "tournament_select" ON tournaments FOR SELECT USING (
  owner_id = auth.uid() OR
  is_public = true OR
  id IN (SELECT tournament_id FROM collaborators WHERE user_id = auth.uid())
);

-- Matches: Nur von zugänglichen Turnieren
CREATE POLICY "match_select" ON matches FOR SELECT USING (
  tournament_id IN (
    SELECT id FROM tournaments WHERE
      owner_id = auth.uid() OR is_public = true OR
      id IN (SELECT tournament_id FROM collaborators WHERE user_id = auth.uid())
  )
);
```

#### Definition of Done
- [ ] RLS-Policies implementiert
- [ ] Sicherheits-Tests
- [ ] Kein direkter Tabellenzugriff ohne Policy

---

### SEC-002: DSGVO-Compliance
**Priorität:** P0 | **Story Points:** 3

**Als** Benutzer
**möchte ich** DSGVO-konforme Datenschutzpraktiken
**damit** meine Rechte gewahrt werden

#### Akzeptanzkriterien
- [ ] Datenschutzerklärung vorhanden
- [ ] Cookie-Banner (wenn nötig)
- [ ] Recht auf Datenexport (Art. 20)
- [ ] Recht auf Löschung (Art. 17)
- [ ] Recht auf Auskunft (Art. 15)
- [ ] Einwilligungen protokolliert
- [ ] Daten-Löschung löscht alles (keine Reste)

#### Definition of Done
- [ ] Datenschutzerklärung
- [ ] Löschfunktion vollständig
- [ ] Export-Funktion vollständig
- [ ] Audit-Log für Einwilligungen

---

## Zusammenfassung

### Story Points nach Epic

| Epic | Stories | Story Points |
|------|---------|--------------|
| AUTH (Authentifizierung) | 5 | 12 |
| SYNC (Cloud-Sync) | 5 | 26 |
| SHARE (Sharing) | 4 | 13 |
| EXPORT (Datenexport) | 2 | 5 |
| ADMIN (Administration) | 3 | 8 |
| SEC (Sicherheit) | 2 | 8 |
| **Gesamt** | **21** | **72** |

### Priorisierte Backlog-Reihenfolge

#### Sprint 1: Auth & Basis-Sync (P0)
1. AUTH-001: Google Login (3 SP)
2. AUTH-002: E-Mail Magic Link (3 SP)
3. AUTH-003: Gast-Modus (2 SP)
4. SEC-001: Row Level Security (5 SP)
5. SYNC-001: Automatischer Cloud-Sync (5 SP)

**Gesamt: 18 SP**

#### Sprint 2: Offline & Realtime (P0)
1. SYNC-002: Offline-Modus (8 SP)
2. SYNC-004: Echtzeit-Updates (5 SP)
3. SYNC-005: Daten-Migration (3 SP)

**Gesamt: 16 SP**

#### Sprint 3: Sharing (P0/P1)
1. SHARE-001: Öffentlicher Link (3 SP)
2. SHARE-002: Helfer einladen (5 SP)
3. SEC-002: DSGVO-Compliance (3 SP)

**Gesamt: 11 SP**

#### Sprint 4: Polish (P1/P2)
1. AUTH-004: Benutzerprofil (2 SP)
2. AUTH-005: Session-Verwaltung (2 SP)
3. SYNC-003: Konflikt-Auflösung (5 SP)
4. ADMIN-001: Archivierung (2 SP)

**Gesamt: 11 SP**

#### Sprint 5: Nice-to-Have (P2)
1. EXPORT-001: Daten-Export (2 SP)
2. EXPORT-002: Backup-Import (3 SP)
3. SHARE-003: Besitz übertragen (3 SP)
4. SHARE-004: Duplizierung (2 SP)
5. ADMIN-002: Statistiken (3 SP)
6. ADMIN-003: Benachrichtigungen (3 SP)

**Gesamt: 16 SP**

---

*Dokument erstellt: 21.12.2024*
*Version: 1.0*
