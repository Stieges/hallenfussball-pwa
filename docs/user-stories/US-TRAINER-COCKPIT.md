# US-TRAINER-COCKPIT: Trainer-Cockpit & Torschützen-Erfassung

## Meta

| Feld | Wert |
|------|------|
| **ID** | US-TRAINER-COCKPIT |
| **Titel** | Trainer-Cockpit mit Team-spezifischem Zugang |
| **Priorität** | Hoch |
| **Aufwand** | ~15-20h (7 Phasen) |
| **Impact** | Hoch - Ermöglicht vollständige Spielstatistik |
| **Abhängigkeiten** | US-INVITE (Invite-System) |

---

## User Story

**Als** Trainer eines Teams
**möchte ich** über einen Einladungslink Zugang zu einem Team-spezifischen Cockpit haben,
**damit** ich Kader, Aufstellungen, Torschützen und weitere Spieldetails erfassen kann, während die Turnierleitung den Spielstand verwaltet.

---

## Kernkonzept

### Turnierleitung = Master

```
TURNIERLEITUNG (Single Source of Truth)
    │
    │ Erfasst: Spielstand, Timer
    │
    ▼
TRAINER-COCKPIT (Ergänzt Details)
    │
    │ Erfasst: Torschützen, Assists, Karten, Wechsel
    │
    ▼
VOLLSTÄNDIGE SPIELSTATISTIK
```

**Regeln:**
- TL erfasst Tore (Spielstand ist Master)
- Trainer ergänzt NUR Details (Schütze, Assist, Karten, etc.)
- Wenn TL Tor löscht → Trainer-Details werden automatisch entfernt
- Trainer kann NICHT Spielstand ändern

### Trainer-Scope
- Sieht nur Spiele seines Teams
- Kann Kader pflegen
- Kann Aufstellungen machen
- Erfasst: Torschützen, Assists, Wechsel, Karten, Notizen

### Zugang
- Einladungslink pro Team (separater Token-Typ)
- Kein Login erforderlich

---

## Akzeptanzkriterien

### AC-1: Trainer-Einladung
- [ ] Turnierleiter kann pro Team einen Trainer-Einladungslink generieren
- [ ] Link ist 30 Tage gültig
- [ ] Trainer kann optional Namen eingeben bei Annahme
- [ ] Link kann widerrufen werden

### AC-2: Trainer-Cockpit Zugang
- [ ] Trainer sieht nur Spiele seines Teams
- [ ] Trainer sieht Live-Spielstand (read-only)
- [ ] Trainer sieht Timer (read-only)
- [ ] Daten werden alle 500ms aktualisiert (wie TL)

### AC-3: Kader-Verwaltung
- [ ] Trainer kann Spieler zum Kader hinzufügen
- [ ] Spieler haben: Rückennummer, Name, Position (optional)
- [ ] Kader wird pro Team gespeichert
- [ ] Kader bleibt über Spiele hinweg erhalten

### AC-4: Aufstellung
- [ ] Trainer kann vor/während Spiel Aufstellung festlegen
- [ ] Aufstellung zeigt Spieler aus Kader
- [ ] Aufstellung wird pro Spiel gespeichert

### AC-5: Torschützen-Erfassung
- [ ] Bei neuem Tor erscheint Benachrichtigung im Trainer-Cockpit
- [ ] Trainer kann Torschützen aus aktueller Aufstellung wählen
- [ ] Optional: Assist-Spieler wählen
- [ ] Quick-Select via Rückennummer (große Buttons)

### AC-6: Wechsel-Erfassung
- [ ] Trainer kann Wechsel erfassen (Spieler rein/raus)
- [ ] Wechsel werden mit Spielminute gespeichert
- [ ] Wechsel-Log wird angezeigt

### AC-7: Karten-Erfassung
- [ ] Trainer kann Karten erfassen (Gelb, Gelb-Rot, Rot)
- [ ] Karten werden mit Spielminute und Spieler gespeichert
- [ ] Karten-Log wird angezeigt

### AC-8: Notizen
- [ ] Trainer kann Freitext-Notizen pro Spiel erfassen
- [ ] Notizen werden gespeichert

### AC-9: Statistik-Übersicht
- [ ] Trainer sieht Torschützen-Rangliste seines Teams
- [ ] Trainer sieht Karten-Übersicht
- [ ] Export-Möglichkeit (später)

---

## Technisches Konzept

### Neue Datenmodelle

#### Player

```typescript
// src/types/player.ts
interface Player {
  id: string;
  teamId: string;
  number: number;       // Rückennummer
  name: string;
  position?: 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
  isGoalkeeper?: boolean;
}

interface TeamRoster {
  teamId: string;
  players: Player[];
  updatedAt: string;
}
```

#### TrainerMatchData

```typescript
// src/types/trainerData.ts
interface LineupPlayer {
  playerId: string;
  number: number;
  name: string;
  position?: string;
  isStarter: boolean;
}

interface Lineup {
  matchId: string;
  teamId: string;
  players: LineupPlayer[];
}

interface Substitution {
  id: string;
  matchId: string;
  teamId: string;
  timestampSeconds: number;
  playerOut: { playerId: string; number: number; name: string };
  playerIn: { playerId: string; number: number; name: string };
}

interface Card {
  id: string;
  matchId: string;
  teamId: string;
  timestampSeconds: number;
  player: { playerId: string; number: number; name: string };
  cardType: 'yellow' | 'yellow-red' | 'red';
}

interface GoalDetail {
  eventId: string;      // Referenz auf TL-Event
  scorer: { playerId: string; number: number; name: string };
  assist?: { playerId: string; number: number; name: string };
  addedAt: string;
}

interface TrainerMatchData {
  matchId: string;
  teamId: string;
  lineup?: Lineup;
  substitutions: Substitution[];
  cards: Card[];
  goalDetails: GoalDetail[];
  notes?: string;
}
```

#### GoalEventPayload Erweiterung

```typescript
// Bestehender GOAL Event payload erweitern
interface GoalEventPayload {
  teamId: string;
  teamName: string;
  direction: 'INC' | 'DEC';

  // NEU: Optional vom Trainer ergänzt
  scorer?: { playerId: string; number: number; name: string };
  assist?: { playerId: string; number: number; name: string };
  detailsAddedBy?: 'trainer' | 'organizer';
}
```

### Trainer-Invite System

```typescript
// src/types/invites.ts - Erweitern
interface TrainerInviteToken {
  id: string;
  tournamentId: string;
  teamId: string;           // Das Team des Trainers
  teamName: string;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;        // +30 Tage
  acceptedByName?: string;
}
```

### URL-Schema

```
/trainer/{trainerInviteToken}     # Einladung annehmen
/tournament/{id}/trainer/{teamId} # Trainer-Cockpit
```

### Abgrenzung zu Helfer-Invite

| Aspekt | Helfer (US-INVITE) | Trainer |
|--------|-------------------|---------|
| Scope | Ganzes Turnier | Ein Team |
| Rechte | Timer/Ergebnisse | Nur Details |
| Sichtbarkeit | Alle Spiele | Nur Team-Spiele |
| Spielstand | Kann ändern | Read-only |

### Permission-System Erweiterung

```typescript
// src/hooks/usePermissions.ts
type UserRole =
  | 'organizer' | 'admin' | 'manager'
  | 'scorekeeper' | 'timekeeper'
  | 'trainer';  // NEU

// Trainer-Permissions
const trainerPermissions = [
  'view_team_schedule',
  'manage_roster',
  'add_goal_details',
  'manage_lineup',
  'record_substitutions',
  'record_cards',
  'add_match_notes',
];
```

### Synchronisations-Architektur

```
TURNIERLEITUNG (Master)
    │
    │ localStorage polling (500ms)
    │
    ▼
TRAINER-COCKPIT (Read-Only für Spielstand)
    │
    │ Eigener Storage für Details
    │
    ▼
TRAINER-DATEN
  - Roster (Kader)
  - Lineups (Aufstellungen)
  - GoalDetails (Schütze/Assist)
  - Substitutions (Wechsel)
  - Cards (Karten)
  - Notes (Notizen)
```

### Konfliktauflösung

- TL löscht Tor → Trainer-GoalDetails für dieses Event werden entfernt
- TL korrigiert Spielstand → Trainer sieht korrigierten Stand
- Trainer kann NICHT Spielstand ändern

### Storage-Keys

```typescript
// src/constants/storage.ts - Erweitern
STORAGE_KEYS = {
  // NEU:
  teamRoster: (tournamentId: string, teamId: string) =>
    `roster-${tournamentId}-${teamId}`,
  trainerMatchDetails: (tournamentId: string) =>
    `trainer-details-${tournamentId}`,
  trainerInvites: (tournamentId: string) =>
    `trainer-invites-${tournamentId}`,
  acceptedTrainerInvites: 'accepted-trainer-invites',
};
```

---

## UI-Mockups

### Trainer-Cockpit Hauptansicht

```
┌─────────────────────────────────────────┐
│ FC Bayern - Trainer-Cockpit             │
│ U11 Hallenturnier                       │
├─────────────────────────────────────────┤
│ [Spiele] [Kader] [Statistik]            │
├─────────────────────────────────────────┤
│                                         │
│ 🔴 LIVE - SPIEL 5                       │
│ FC Bayern 2:1 TSV 1860  ⏱️ 07:23        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ⚽ TOR! (6:45)                       │ │
│ │ Wer hat geschossen?                 │ │
│ │ [10] [7] [9] [11] [8] [5]          │ │
│ │ Assist? [Optional]                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ AUFSTELLUNG        [✏️]                 │
│ TW: [1] Paul Huber                      │
│ ...                                     │
│                                         │
│ WECHSEL            [+ Wechsel]          │
│ 5' ↔ [12] für [8]                       │
│                                         │
│ KARTEN             [+ Karte]            │
│ 8' 🟨 [10] Max Müller                   │
└─────────────────────────────────────────┘
```

### Torschützen Quick-Select

```
┌─────────────────────────────────────────┐
│ ⚽ TOR für FC Bayern! (6:45)            │
├─────────────────────────────────────────┤
│                                         │
│ Wer hat das Tor geschossen?             │
│                                         │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │ 10  │ │  7  │ │  9  │ │ 11  │        │
│ │Max M│ │Tim S│ │Leo K│ │Jan P│        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
│                                         │
│ ┌─────┐ ┌─────┐                        │
│ │  8  │ │  5  │  [Überspringen]        │
│ │Finn │ │Paul │                        │
│ └─────┘ └─────┘                        │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Assist? (optional)                      │
│ [Kein Assist] [Spieler wählen...]      │
│                                         │
└─────────────────────────────────────────┘
```

### Kader-Verwaltung

```
┌─────────────────────────────────────────┐
│ Kader - FC Bayern              [+ Neu]  │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [1]  Paul Huber        TW    [✏️][🗑️]│ │
│ ├─────────────────────────────────────┤ │
│ │ [5]  Leon Schmidt      DEF   [✏️][🗑️]│ │
│ ├─────────────────────────────────────┤ │
│ │ [7]  Tim Schneider     MF    [✏️][🗑️]│ │
│ ├─────────────────────────────────────┤ │
│ │ [9]  Leo König         ST    [✏️][🗑️]│ │
│ ├─────────────────────────────────────┤ │
│ │ [10] Max Müller        MF    [✏️][🗑️]│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   + Spieler hinzufügen                 │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Trainer-Einladung (TL-Sicht)

```
┌─────────────────────────────────────────┐
│ Trainer einladen                        │
├─────────────────────────────────────────┤
│                                         │
│ Team auswählen:                         │
│ [FC Bayern München        ▼]            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🔗 Einladungslink:                   │ │
│ │ hallenfussball.app/trainer/abc123   │ │
│ │                                     │ │
│ │ [Link kopieren] [QR-Code]           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Status: ⏳ Ausstehend                   │
│ Gültig bis: 23.01.2026                  │
│                                         │
│ [Link widerrufen]                       │
│                                         │
└─────────────────────────────────────────┘
```

---

## Komponenten-Struktur

### Neue Dateien

```
src/types/
├── player.ts                            # Player, TeamRoster
└── trainerData.ts                       # Lineup, Substitution, Card, etc.

src/screens/
├── TrainerInviteAcceptScreen.tsx        # Einladung annehmen
└── TrainerCockpitScreen.tsx             # Haupt-Screen

src/features/trainer-cockpit/
├── TrainerCockpit.tsx                   # Container
├── components/
│   ├── TeamMatchList.tsx                # Spiele des Teams
│   ├── LiveMatchView.tsx                # Aktuelles Spiel
│   ├── GoalDetailModal.tsx              # Torschützen-Erfassung
│   ├── RosterManager.tsx                # Kader-Verwaltung
│   ├── PlayerForm.tsx                   # Spieler hinzufügen/bearbeiten
│   ├── LineupEditor.tsx                 # Aufstellung
│   ├── SubstitutionLog.tsx              # Wechsel-Liste
│   └── CardLog.tsx                      # Karten-Liste
├── hooks/
│   ├── useTrainerData.ts                # Trainer-Daten CRUD
│   ├── useTrainerSync.ts                # Sync mit TL
│   └── useTeamRoster.ts                 # Kader-Management
└── index.ts

src/features/invites/
└── TrainerInviteGenerator.tsx           # Trainer-Links generieren
```

### Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/invites.ts` | TrainerInviteToken hinzufügen |
| `src/constants/storage.ts` | Neue Storage-Keys |
| `src/hooks/usePermissions.ts` | trainer Rolle hinzufügen |
| `src/App.tsx` | Neue Routes |
| `src/features/invites/InviteShareScreen.tsx` | Trainer-Sektion |
| `src/hooks/useLiveMatches.ts` | GoalEventPayload erweitern |
| `src/components/match-cockpit/panels/EventsList.tsx` | Schützen anzeigen |

---

## Implementierungsphasen

### Phase 1: Basis-Infrastruktur (2h)
- [ ] Types: player.ts, trainerData.ts
- [ ] Storage-Keys erweitern
- [ ] Permission-System: trainer Rolle

### Phase 2: Trainer-Invite (2h)
- [ ] TrainerInviteToken zu invites.ts
- [ ] TrainerInviteGenerator Komponente
- [ ] TrainerInviteAcceptScreen

### Phase 3: Kader-Verwaltung (2h)
- [ ] useTeamRoster Hook
- [ ] RosterManager Komponente
- [ ] PlayerForm Komponente

### Phase 4: Trainer-Cockpit Basis (3h)
- [ ] TrainerCockpitScreen
- [ ] TeamMatchList Komponente
- [ ] LiveMatchView Komponente

### Phase 5: Torschützen-Erfassung (3h)
- [ ] useTrainerSync Hook
- [ ] GoalDetailModal Komponente
- [ ] Integration mit Events

### Phase 6: Erweiterte Features (3h)
- [ ] LineupEditor Komponente
- [ ] SubstitutionLog Komponente
- [ ] CardLog Komponente

### Phase 7: Integration (2h)
- [ ] App.tsx Routes
- [ ] InviteShareScreen Trainer-Sektion
- [ ] EventsList Schützen-Anzeige

---

## Offene Punkte

1. **Statistik-Export**: Format und Umfang noch zu definieren
2. **Mehrere Trainer pro Team**: Aktuell nur einer - später erweitern?
3. **Offline-Fähigkeit**: Trainer-Daten lokal cachen?

---

## Abgrenzung

**In Scope:**
- Trainer-Einladung pro Team
- Kader-Verwaltung
- Aufstellungen
- Torschützen & Assists
- Wechsel & Karten
- Notizen

**Out of Scope:**
- Spielstand ändern (nur TL)
- Andere Teams sehen
- Turnier-Einstellungen ändern
- Multi-Trainer pro Team (vorerst)
