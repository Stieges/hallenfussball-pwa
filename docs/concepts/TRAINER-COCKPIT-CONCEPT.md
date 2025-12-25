# Konzept: Trainer-Cockpit & Torschützen-Erfassung

**Erstellt:** 2025-12-24
**Status:** Konzept
**Geschätzter Aufwand:** 15-20h

---

## 1. Executive Summary

Das Trainer-Cockpit erweitert die Hallenfußball-PWA um eine dedizierte Ansicht für Team-Trainer. Im Gegensatz zu den bestehenden Helfer-Rollen (Zeitnehmer, Spielleiter) hat der Trainer eine **team-zentrierte Perspektive** und kann nur Details zu Spielen seines Teams erfassen. Die Turnierleitung bleibt Master für Spielstände.

### Kernprinzipien

| Prinzip | Beschreibung |
|---------|--------------|
| **TL = Master** | Turnierleitung erfasst Tore, ist Single Source of Truth für Spielstand |
| **Trainer = Details** | Trainer ergänzt nur: Schütze, Assist, Aufstellung, Wechsel, Karten |
| **Team-Scope** | Trainer sieht nur Spiele seines Teams |
| **Autark möglich** | Trainer kann auch ohne aktive TL arbeiten (dann selbst Tore erfassen) |

---

## 2. Abgrenzung: Trainer vs. Helfer (US-INVITE)

| Aspekt | Helfer (US-INVITE) | Trainer (NEU) |
|--------|-------------------|---------------|
| **Scope** | Gesamtes Turnier | Ein spezifisches Team |
| **Rechte** | Timer/Ergebnisse eingeben | Nur Details ergänzen |
| **Sichtbarkeit** | Alle Spiele (ggf. 1 Feld) | Nur Spiele des eigenen Teams |
| **Ergebnis-Eingabe** | Ja (je nach Rolle) | Nein (nur wenn TL nicht aktiv) |
| **Kader-Verwaltung** | Nein | Ja |
| **Invite-Typ** | `InviteToken` | `TrainerInviteToken` |

---

## 3. Datenmodell

### 3.1 Player Interface (NEU)

```typescript
// src/types/player.ts

/**
 * Spieler eines Teams
 * Wird im Trainer-Cockpit erfasst und für Torschützen/Assists verwendet
 */
export interface Player {
  id: string;                    // UUID
  teamId: string;                // Referenz zum Team
  number: number;                // Rückennummer (1-99)
  name: string;                  // Vor- + Nachname
  position?: PlayerPosition;     // Optional: Position
  isGoalkeeper?: boolean;        // Torwart-Markierung
  createdAt: string;             // ISO timestamp
}

export type PlayerPosition =
  | 'goalkeeper'
  | 'defender'
  | 'midfielder'
  | 'forward';

/**
 * Team-Kader (Roster)
 * Separat vom Team-Interface gespeichert
 */
export interface TeamRoster {
  teamId: string;
  players: Player[];
  updatedAt: string;
  updatedBy?: string;            // trainerId oder 'organizer'
}
```

### 3.2 Trainer-Daten pro Spiel

```typescript
// src/types/trainerData.ts

/**
 * Startaufstellung eines Teams für ein Spiel
 */
export interface Lineup {
  matchId: string;
  teamId: string;
  players: LineupPlayer[];
  formation?: string;            // z.B. "2-2-1" für Futsal
  createdAt: string;
  updatedAt: string;
}

export interface LineupPlayer {
  playerId: string;
  playerNumber: number;
  playerName: string;
  position?: PlayerPosition;
  isCaptain?: boolean;
}

/**
 * Spielerwechsel
 */
export interface Substitution {
  id: string;
  matchId: string;
  teamId: string;
  timestampSeconds: number;      // Spielminute als Sekunden
  playerOut: {
    playerId: string;
    playerNumber: number;
    playerName: string;
  };
  playerIn: {
    playerId: string;
    playerNumber: number;
    playerName: string;
  };
  createdAt: string;
}

/**
 * Karten (Gelb, Gelb-Rot, Rot)
 */
export type CardType = 'yellow' | 'yellow-red' | 'red';

export interface Card {
  id: string;
  matchId: string;
  teamId: string;
  timestampSeconds: number;
  player: {
    playerId: string;
    playerNumber: number;
    playerName: string;
  };
  cardType: CardType;
  reason?: string;               // Optional: Grund
  createdAt: string;
}

/**
 * Trainer-Notizen pro Spiel
 */
export interface MatchNotes {
  matchId: string;
  teamId: string;
  notes: string;                 // Freitext (max 2000 Zeichen)
  updatedAt: string;
}

/**
 * Aggregierte Trainer-Daten für ein Spiel
 */
export interface TrainerMatchData {
  matchId: string;
  teamId: string;
  lineup?: Lineup;
  substitutions: Substitution[];
  cards: Card[];
  goalDetails: Record<string, GoalDetail>; // eventId -> details
  notes?: MatchNotes;
  lastSyncedAt?: string;
}
```

### 3.3 GoalEventPayload Erweiterung

Das bestehende `MatchEvent` Interface wird erweitert:

```typescript
// Erweiterung in src/hooks/useLiveMatches.ts

/**
 * Erweiterte Payload-Struktur für GOAL Events
 * Abwärtskompatibel: scorer/assist sind optional
 */
export interface GoalEventPayload {
  teamId: string;
  teamName: string;
  direction: 'INC' | 'DEC';

  // NEU: Trainer-Details (optional, vom Trainer ergänzt)
  scorer?: {
    playerId: string;
    playerNumber: number;
    playerName: string;
  };
  assist?: {
    playerId: string;
    playerNumber: number;
    playerName: string;
  };

  // Markierung wer das Detail ergänzt hat
  detailsAddedBy?: 'trainer' | 'organizer';
  detailsAddedAt?: string;        // ISO timestamp
}
```

---

## 4. Trainer-Invite System

### 4.1 TrainerInviteToken

```typescript
// src/types/invites.ts - Erweitern

/**
 * Trainer-spezifisches Einladungs-Token
 * Unterschied zu InviteToken: Hat teamId statt field
 */
export interface TrainerInviteToken {
  id: string;                    // UUID
  tournamentId: string;
  teamId: string;                // Das Team für das der Trainer zuständig ist
  teamName: string;              // Team-Name (für Anzeige im Link)
  createdAt: string;
  expiresAt: string;             // Default: +30 Tage (länger als Helfer)
  status: 'pending' | 'accepted' | 'revoked';
  acceptedAt?: string;
  acceptedByName?: string;       // Name des Trainers

  // Zusätzliche Trainer-Infos
  trainerEmail?: string;         // Optional: Kontakt-Email
  trainerPhone?: string;         // Optional: Telefon
}

/**
 * Akzeptierte Trainer-Einladung (auf Gerät des Trainers)
 */
export interface AcceptedTrainerInvite {
  token: string;                 // Original Token ID
  tournamentId: string;
  teamId: string;
  teamName: string;
  tournamentName: string;
  acceptedAt: string;
  trainerName?: string;
}
```

### 4.2 URL-Schema

```
# Trainer-Einladungslink
https://hallenfussball.app/trainer/{trainerInviteToken}

# Beispiel:
https://hallenfussball.app/trainer/abc123-def456-ghi789

# Nach Annahme: Trainer-Cockpit
https://hallenfussball.app/tournament/{tournamentId}/trainer/{teamId}
```

### 4.3 Einladungs-Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ ORGANISATOR                                                          │
│                                                                      │
│ 1. Öffnet "Teilen" im Turnier-Management                            │
│ 2. Wählt Sektion "Trainer einladen"                                 │
│ 3. Wählt Team aus Dropdown (z.B. "FC Bayern")                       │
│ 4. Klickt "Einladungslink erstellen"                                │
│ 5. Teilt Link via WhatsApp/Email                                    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TRAINER                                                              │
│                                                                      │
│ 1. Öffnet Einladungslink                                            │
│ 2. Sieht: "Du wurdest als Trainer für FC Bayern eingeladen"         │
│ 3. Gibt optional seinen Namen ein                                   │
│ 4. Klickt "Einladung annehmen"                                      │
│ 5. Token wird in localStorage gespeichert                           │
│ 6. Weiterleitung zum Trainer-Cockpit                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Permission-System Erweiterung

### 5.1 Neue Rolle: trainer

```typescript
// src/hooks/usePermissions.ts - Erweitern

export type UserRole =
  | 'organizer'
  | 'admin'
  | 'manager'
  | 'scorekeeper'
  | 'timekeeper'
  | 'trainer';    // NEU

export type Permission =
  // Bestehende Permissions...
  | 'view_schedule'
  | 'control_timer'
  | 'enter_score'
  // ...

  // NEU: Trainer-spezifische Permissions
  | 'view_team_schedule'       // Nur Spiele des eigenen Teams sehen
  | 'manage_roster'            // Kader verwalten
  | 'add_goal_details'         // Torschützen/Assists ergänzen
  | 'manage_lineup'            // Aufstellung verwalten
  | 'record_substitutions'     // Wechsel eintragen
  | 'record_cards'             // Karten eintragen
  | 'add_match_notes';         // Notizen schreiben

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Bestehende Rollen...

  trainer: [
    'view_team_schedule',
    'manage_roster',
    'add_goal_details',
    'manage_lineup',
    'record_substitutions',
    'record_cards',
    'add_match_notes',
  ],
};
```

### 5.2 Berechtigungsmatrix

| Berechtigung | Organizer | Spielleiter | Zeitnehmer | **Trainer** |
|--------------|:---------:|:-----------:|:----------:|:-----------:|
| Alle Spiele sehen | ✅ | ✅ | ✅ (1 Feld) | ❌ |
| Team-Spiele sehen | ✅ | ✅ | ✅ | ✅ |
| Timer steuern | ✅ | ✅ | ✅ | ❌ |
| Ergebnis eingeben | ✅ | ✅ | ✅ | ❌ |
| Kader verwalten | ✅ | ❌ | ❌ | ✅ |
| Torschützen ergänzen | ✅ | ❌ | ❌ | ✅ |
| Aufstellung setzen | ❌ | ❌ | ❌ | ✅ |
| Wechsel eintragen | ❌ | ❌ | ❌ | ✅ |
| Karten eintragen | ✅ | ✅ | ❌ | ✅ |

---

## 6. Synchronisations-Architektur

### 6.1 Datenfluss

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TURNIERLEITUNG (Master)                           │
│                                                                      │
│  - Startet/Beendet Spiele                                           │
│  - Erfasst Tore (+/-)                                               │
│  - Korrigiert Ergebnisse                                            │
│                                                                      │
│  Storage: liveMatches-{tournamentId}                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ localStorage
                                │ (polling alle 500ms)
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                    TRAINER-COCKPIT                                   │
│                                                                      │
│  - Liest LiveMatches (read-only für Spielstand)                     │
│  - Erkennt neue GOAL-Events                                         │
│  - Ergänzt Details zu Events                                        │
│  - Verwaltet Kader, Aufstellung, Wechsel, Karten                    │
│                                                                      │
│  Storage: trainer-details-{tournamentId}                            │
│           roster-{tournamentId}-{teamId}                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Konfliktauflösung: TL gewinnt immer

```typescript
// Pseudocode für useTrainerSync Hook

useEffect(() => {
  // Bei jeder Änderung der liveMatches prüfen:

  for (const trainerData of allTrainerData) {
    const match = liveMatches.get(trainerData.matchId);

    // Finde alle GOAL-Events die noch existieren
    const currentGoalIds = match.events
      .filter(e => e.type === 'GOAL' && e.payload.teamId === myTeamId)
      .map(e => e.id);

    // Entferne Trainer-Details für gelöschte Goals
    for (const [eventId] of trainerData.goalDetails) {
      if (!currentGoalIds.includes(eventId)) {
        // TL hat dieses Tor gelöscht/korrigiert
        trainerData.goalDetails.delete(eventId);
        console.log(`Goal ${eventId} von TL entfernt - Details bereinigt`);
      }
    }
  }
}, [liveMatches]);
```

### 6.3 Pending Goals Notification

Wenn die TL ein Tor erfasst, soll der Trainer sofort darüber informiert werden:

```typescript
// In useTrainerSync

const [pendingGoalDetails, setPendingGoalDetails] = useState<MatchEvent[]>([]);

useEffect(() => {
  // Prüfe auf neue Goals für mein Team
  const myTeamMatches = getMatchesForTeam(liveMatches, myTeamId);

  for (const match of myTeamMatches) {
    const newGoals = match.events.filter(e =>
      e.type === 'GOAL' &&
      e.payload.teamId === myTeamId &&
      !hasTrainerDetails(e.id)  // Noch keine Details erfasst
    );

    if (newGoals.length > 0) {
      setPendingGoalDetails(prev => [...prev, ...newGoals]);
      // UI zeigt Modal: "Neues Tor! Wer hat geschossen?"
    }
  }
}, [liveMatches]);
```

---

## 7. localStorage-Struktur

### 7.1 Neue Storage-Keys

```typescript
// src/constants/storage.ts - Erweitern

export const STORAGE_KEYS = {
  // Bestehende Keys...

  /** Team roster for a specific team */
  teamRoster: (tournamentId: string, teamId: string) =>
    `roster-${tournamentId}-${teamId}`,

  /** All rosters for a tournament */
  tournamentRosters: (tournamentId: string) =>
    `rosters-${tournamentId}`,

  /** Trainer details for matches (Torschützen, Aufstellung, etc.) */
  trainerMatchDetails: (tournamentId: string) =>
    `trainer-details-${tournamentId}`,

  /** Trainer invite tokens (Organisator-Seite) */
  trainerInvites: (tournamentId: string) =>
    `trainer-invites-${tournamentId}`,

  /** Accepted trainer invites (Trainer-Seite) */
  acceptedTrainerInvites: 'accepted-trainer-invites',
};
```

### 7.2 Beispiel-Datenstruktur

**Organisator-Gerät:**

```json
{
  "trainer-invites-tour123": [
    {
      "id": "inv-abc",
      "teamId": "team-bayern",
      "teamName": "FC Bayern",
      "status": "accepted",
      "acceptedByName": "Thomas Müller"
    }
  ],
  "roster-tour123-team-bayern": {
    "teamId": "team-bayern",
    "players": [
      { "id": "p1", "number": 10, "name": "Max Müller" },
      { "id": "p2", "number": 7, "name": "Tim Schmidt" }
    ]
  }
}
```

**Trainer-Gerät:**

```json
{
  "accepted-trainer-invites": [
    {
      "token": "inv-abc",
      "tournamentId": "tour123",
      "teamId": "team-bayern",
      "teamName": "FC Bayern",
      "tournamentName": "U11 Hallenturnier"
    }
  ],
  "roster-tour123-team-bayern": {
    "teamId": "team-bayern",
    "players": [...]
  },
  "trainer-details-tour123": {
    "match-456": {
      "matchId": "match-456",
      "teamId": "team-bayern",
      "lineup": {
        "players": [...]
      },
      "goalDetails": {
        "event-789": {
          "scorer": { "playerId": "p1", "playerNumber": 10, "playerName": "Max Müller" },
          "assist": { "playerId": "p2", "playerNumber": 7, "playerName": "Tim Schmidt" }
        }
      },
      "substitutions": [],
      "cards": []
    }
  }
}
```

---

## 8. UI-Konzept

### 8.1 Trainer-Cockpit Hauptansicht

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Dashboard          FC Bayern - Trainer-Cockpit                    │
│                      U11 Hallenturnier 2025                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Spiele]  [Kader]  [Statistik]                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔴 LIVE - SPIEL 5                                                  │
│  ─────────────────────────────────────────────────────              │
│                                                                     │
│       FC Bayern         2 : 1         TSV 1860                      │
│                                                                     │
│                       ⏱️ 07:23                                      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ⚽ TOR! (6:45)                                  [Schließen]  │  │
│  │  ──────────────────────────────────────────────               │  │
│  │  Wer hat geschossen?                                          │  │
│  │                                                                │  │
│  │  [10] Max    [7] Tim     [9] Felix   [11] Nico               │  │
│  │  [8] Jan     [5] Jonas   [3] Lukas   [4] Ben                 │  │
│  │                                                                │  │
│  │  Ausgewählt: [10] Max Müller                                  │  │
│  │                                                                │  │
│  │  Assist?  [Kein Assist ▼]                                     │  │
│  │                                                                │  │
│  │                                [✓ Speichern]                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  AUFSTELLUNG (6 Spieler)                         [✏️ Bearbeiten]   │
│  ─────────────────────────────────────────────────────              │
│  TW: [1] Paul Huber                                                 │
│  VT: [3] Lukas Meier, [4] Ben Koch                                 │
│  MF: [7] Tim Schmidt (C), [10] Max Müller                          │
│  ST: [9] Felix Braun                                                │
│                                                                     │
│  WECHSEL                                         [+ Wechsel]        │
│  ─────────────────────────────────────────────────────              │
│  5' ↔ [12] Tom Klein für [8] Jan Wolf                              │
│                                                                     │
│  KARTEN                                          [+ Karte]          │
│  ─────────────────────────────────────────────────────              │
│  8' 🟨 [10] Max Müller - Foul                                       │
│                                                                     │
│  NOTIZEN                                         [✏️]               │
│  ─────────────────────────────────────────────────────              │
│  "Mehr über Außen spielen, Mitte ist zu eng"                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NÄCHSTE SPIELE                                                     │
│  ─────────────────────────────────────────────────────              │
│  Spiel 8: FC Bayern vs VfB Stuttgart (11:15 Uhr, Feld 2)           │
│  Spiel 12: SC Freiburg vs FC Bayern (12:30 Uhr, Feld 1)            │
│                                                                     │
│  VERGANGENE SPIELE                                                  │
│  ─────────────────────────────────────────────────────              │
│  ✓ Spiel 2: FC Bayern 3:1 Borussia Dortmund     [Details anzeigen] │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Kader-Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Spiele]  [Kader]  [Statistik]                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  KADER - FC BAYERN                           [+ Spieler hinzufügen] │
│  ─────────────────────────────────────────────────────              │
│                                                                     │
│  ┌─────┬──────────────────────────┬──────────────┬─────────────┐    │
│  │ Nr  │ Name                     │ Position     │             │    │
│  ├─────┼──────────────────────────┼──────────────┼─────────────┤    │
│  │  1  │ Paul Huber               │ Torwart      │ [✏️] [🗑️]  │    │
│  │  3  │ Lukas Meier              │ Verteidiger  │ [✏️] [🗑️]  │    │
│  │  4  │ Ben Koch                 │ Verteidiger  │ [✏️] [🗑️]  │    │
│  │  5  │ Jonas Weber              │ Verteidiger  │ [✏️] [🗑️]  │    │
│  │  7  │ Tim Schmidt (C)          │ Mittelfeld   │ [✏️] [🗑️]  │    │
│  │  8  │ Jan Wolf                 │ Mittelfeld   │ [✏️] [🗑️]  │    │
│  │  9  │ Felix Braun              │ Sturm        │ [✏️] [🗑️]  │    │
│  │ 10  │ Max Müller               │ Mittelfeld   │ [✏️] [🗑️]  │    │
│  │ 11  │ Nico Huber               │ Sturm        │ [✏️] [🗑️]  │    │
│  │ 12  │ Tom Klein                │ Mittelfeld   │ [✏️] [🗑️]  │    │
│  └─────┴──────────────────────────┴──────────────┴─────────────┘    │
│                                                                     │
│  10 Spieler registriert                                             │
│                                                                     │
│  ─────────────────────────────────────────────────────              │
│  💡 Tipp: Registriere deinen Kader BEVOR das Turnier beginnt,      │
│     um Torschützen schneller erfassen zu können.                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Torschützen Quick-Select Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                              [✕]    │
│                       ⚽ TOR ERFASSEN                                │
│                                                                     │
│  FC Bayern 2:1 TSV 1860                                             │
│  6:45 - Tor für FC Bayern                                           │
│                                                                     │
│  ─────────────────────────────────────────────────────              │
│                                                                     │
│  TORSCHÜTZE *                                                       │
│                                                                     │
│  Auf dem Platz:                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│  │  1   │ │  3   │ │  4   │ │  7   │ │  9   │ │ 10 ✓ │             │
│  │ Paul │ │Lukas │ │ Ben  │ │ Tim  │ │Felix │ │ Max  │             │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │
│                                                                     │
│  Auf der Bank:                                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                               │
│  │  5   │ │  8   │ │ 11   │ │ 12   │                               │
│  │Jonas │ │ Jan  │ │ Nico │ │ Tom  │                               │
│  └──────┘ └──────┘ └──────┘ └──────┘                               │
│                                                                     │
│  Ausgewählt: [10] Max Müller                                        │
│                                                                     │
│  ─────────────────────────────────────────────────────              │
│                                                                     │
│  ASSIST (optional)                                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ [7] Tim Schmidt                                         ▼     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ─────────────────────────────────────────────────────              │
│                                                                     │
│            [Abbrechen]              [✓ Speichern]                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Datei-Struktur

### 9.1 Neue Dateien (17)

```
src/
├── types/
│   ├── player.ts                               # Player, TeamRoster
│   └── trainerData.ts                          # Lineup, Substitution, Card, etc.
│
├── screens/
│   ├── TrainerInviteAcceptScreen.tsx           # Einladung annehmen
│   └── TrainerCockpitScreen.tsx                # Haupt-Screen
│
├── features/
│   ├── trainer-cockpit/
│   │   ├── index.ts
│   │   ├── TrainerCockpit.tsx                  # Container-Komponente
│   │   │
│   │   ├── components/
│   │   │   ├── TeamMatchList.tsx               # Liste der Team-Spiele
│   │   │   ├── MatchCard.tsx                   # Einzelnes Spiel
│   │   │   ├── LiveMatchView.tsx               # Live-Spielansicht
│   │   │   ├── GoalDetailModal.tsx             # Torschützen-Modal
│   │   │   ├── RosterManager.tsx               # Kader verwalten
│   │   │   ├── PlayerForm.tsx                  # Spieler hinzufügen
│   │   │   ├── LineupEditor.tsx                # Aufstellung festlegen
│   │   │   ├── SubstitutionLog.tsx             # Wechsel eintragen
│   │   │   ├── CardLog.tsx                     # Karten eintragen
│   │   │   └── MatchNotesEditor.tsx            # Notizen
│   │   │
│   │   └── hooks/
│   │       ├── useTrainerData.ts               # Trainer-Daten CRUD
│   │       ├── useTrainerSync.ts               # Sync mit TL
│   │       └── useTeamRoster.ts                # Kader-Verwaltung
│   │
│   └── invites/
│       ├── TrainerInviteGenerator.tsx          # Trainer-Einladung erstellen
│       └── TrainerInviteList.tsx               # Liste der Trainer-Einladungen
```

### 9.2 Zu ändernde Dateien (7)

| Datei | Änderung |
|-------|----------|
| `src/types/invites.ts` | TrainerInviteToken hinzufügen |
| `src/constants/storage.ts` | Neue Storage-Keys |
| `src/hooks/usePermissions.ts` | 'trainer' Rolle und Permissions |
| `src/App.tsx` | Neue Routes für /trainer/* |
| `src/features/invites/InviteShareScreen.tsx` | Trainer-Einladung Sektion |
| `src/hooks/useLiveMatches.ts` | GoalEventPayload erweitern |
| `src/components/match-cockpit/panels/EventsList.tsx` | Torschützen-Anzeige |

---

## 10. Implementierungsphasen

### Phase 1: Basis-Infrastruktur (2h)

- [ ] `src/types/player.ts` erstellen
- [ ] `src/types/trainerData.ts` erstellen
- [ ] `src/constants/storage.ts` erweitern
- [ ] `src/hooks/usePermissions.ts` - trainer Rolle hinzufügen

### Phase 2: Trainer-Invite Flow (2h)

- [ ] TrainerInviteToken zu `invites.ts` hinzufügen
- [ ] `TrainerInviteGenerator.tsx` erstellen
- [ ] `TrainerInviteAcceptScreen.tsx` erstellen
- [ ] AcceptedTrainerInvites Verwaltung

### Phase 3: Kader-Verwaltung (2h)

- [ ] `useTeamRoster.ts` Hook erstellen
- [ ] `RosterManager.tsx` Komponente
- [ ] `PlayerForm.tsx` Komponente

### Phase 4: Trainer-Cockpit Basis (3h)

- [ ] `TrainerCockpitScreen.tsx` erstellen
- [ ] `TrainerCockpit.tsx` Container
- [ ] `TeamMatchList.tsx` - Spiele-Übersicht
- [ ] `LiveMatchView.tsx` - Live-Spiel Ansicht

### Phase 5: Torschützen-Erfassung (3h)

- [ ] `useTrainerSync.ts` Hook für Live-Sync
- [ ] `GoalDetailModal.tsx` - Quick-Select UI
- [ ] GoalEventPayload Erweiterung in useLiveMatches
- [ ] Pending Goals Detection

### Phase 6: Erweiterte Features (3h)

- [ ] `LineupEditor.tsx` - Aufstellung setzen
- [ ] `SubstitutionLog.tsx` - Wechsel erfassen
- [ ] `CardLog.tsx` - Karten erfassen
- [ ] `MatchNotesEditor.tsx` - Notizen

### Phase 7: Integration (2h)

- [ ] Routes in `App.tsx` hinzufügen
- [ ] Trainer-Sektion in `InviteShareScreen.tsx`
- [ ] Torschützen-Anzeige in `EventsList.tsx`
- [ ] Tests & Bugfixes

---

## 11. Offene Fragen / Entscheidungen

### 11.1 Multi-Device Sync

**Problem:** Wenn Trainer und Organisator auf verschiedenen Geräten arbeiten, wie synchronisieren sich die Daten?

**Aktuelle Lösung:** localStorage polling (500ms). Funktioniert nur wenn beide im selben Browser-Tab-Kontext sind.

**Zukünftig:** Backend mit WebSocket-Sync.

### 11.2 Kader-Ownership

**Frage:** Wer "besitzt" den Kader - Organisator oder Trainer?

**Entscheidung:** Beide können bearbeiten. Letzter Edit gewinnt. `updatedBy` Feld zeigt wer zuletzt geändert hat.

### 11.3 Offline-Fähigkeit

**Anforderung:** Trainer sollte auch offline arbeiten können (schlechtes WLAN in Halle).

**Lösung:** Alle Trainer-Daten lokal speichern. Bei Reconnect mit TL-Daten abgleichen (TL gewinnt bei Konflikten).

---

## 12. Verwandte User Stories

- **US-INVITE** - Helfer-Einladungssystem (Basis für Trainer-Invite)
- **US-TL-RESULT-LOCK** - Ergebnis-Sperre nach Spielende
- **US-EVENT-TIMESTAMPS** - Zeitstempel für Events (relevant für Torschützen)

---

## Anhang: Beispiel-Code

### A. useTrainerSync Hook (Kernlogik)

```typescript
// src/features/trainer-cockpit/hooks/useTrainerSync.ts

export function useTrainerSync(tournamentId: string, teamId: string) {
  const { liveMatches } = useLiveMatches(tournamentId);
  const [trainerData, setTrainerData] = useLocalStorage<TrainerMatchData[]>(
    STORAGE_KEYS.trainerMatchDetails(tournamentId),
    []
  );
  const [pendingGoals, setPendingGoals] = useState<MatchEvent[]>([]);

  // Filter: Nur Spiele meines Teams
  const teamMatches = useMemo(() => {
    return Array.from(liveMatches.values()).filter(
      match => match.homeTeam.id === teamId || match.awayTeam.id === teamId
    );
  }, [liveMatches, teamId]);

  // Erkennung neuer Tore
  useEffect(() => {
    const newPendingGoals: MatchEvent[] = [];

    for (const match of teamMatches) {
      const myGoals = match.events.filter(e =>
        e.type === 'GOAL' &&
        e.payload.teamId === teamId &&
        e.payload.direction === 'INC'
      );

      for (const goal of myGoals) {
        const hasDetails = trainerData.some(td =>
          td.matchId === match.id &&
          td.goalDetails[goal.id]
        );

        if (!hasDetails) {
          newPendingGoals.push(goal);
        }
      }
    }

    setPendingGoals(newPendingGoals);
  }, [teamMatches, trainerData, teamId]);

  // Konfliktauflösung: Entferne Details für gelöschte Tore
  useEffect(() => {
    setTrainerData(prev => {
      return prev.map(td => {
        const match = liveMatches.get(td.matchId);
        if (!match) return td;

        const currentGoalIds = new Set(
          match.events
            .filter(e => e.type === 'GOAL' && e.payload.teamId === teamId)
            .map(e => e.id)
        );

        const cleanedGoalDetails = { ...td.goalDetails };
        for (const eventId of Object.keys(cleanedGoalDetails)) {
          if (!currentGoalIds.has(eventId)) {
            delete cleanedGoalDetails[eventId];
          }
        }

        return { ...td, goalDetails: cleanedGoalDetails };
      });
    });
  }, [liveMatches, teamId]);

  const addGoalDetail = useCallback((
    matchId: string,
    eventId: string,
    scorer: Player,
    assist?: Player
  ) => {
    setTrainerData(prev => {
      const existing = prev.find(td => td.matchId === matchId);
      const detail: GoalDetail = {
        scorer: {
          playerId: scorer.id,
          playerNumber: scorer.number,
          playerName: scorer.name,
        },
        assist: assist ? {
          playerId: assist.id,
          playerNumber: assist.number,
          playerName: assist.name,
        } : undefined,
        detailsAddedBy: 'trainer',
        detailsAddedAt: new Date().toISOString(),
      };

      if (existing) {
        return prev.map(td =>
          td.matchId === matchId
            ? { ...td, goalDetails: { ...td.goalDetails, [eventId]: detail } }
            : td
        );
      } else {
        return [...prev, {
          matchId,
          teamId,
          goalDetails: { [eventId]: detail },
          substitutions: [],
          cards: [],
        }];
      }
    });

    // Entferne aus pending
    setPendingGoals(prev => prev.filter(g => g.id !== eventId));
  }, [teamId]);

  return {
    teamMatches,
    pendingGoals,
    trainerData,
    addGoalDetail,
    // ... weitere Funktionen
  };
}
```
