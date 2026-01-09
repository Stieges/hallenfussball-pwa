# Supabase Schema Documentation

> **Projekt:** Hallenfußball PWA
> **Supabase Project:** amtlqicosscsjnnthvzm
> **Stand:** Januar 2026

---

## 1. Tabellen-Übersicht

| Tabelle | Beschreibung | Primary Key |
|---------|--------------|-------------|
| `tournaments` | Turnier-Metadaten | `id` (uuid) |
| `teams` | Teams pro Turnier | `id` (uuid) |
| `matches` | Spiele (Gruppen + Playoffs) | `id` (uuid) |
| `match_events` | Tor-Events, Karten, etc. | `id` (uuid) |
| `team_players` | Spieler pro Team | `id` (uuid) |
| `monitors` | Monitor-Konfigurationen | `id` (uuid) |
| `monitor_sessions` | Aktive Monitor-Sessions | `id` (uuid) |
| `user_registrations` | Registrierungen mit Codes | `id` (uuid) |

---

## 2. Tabellen-Definitionen

### 2.1 tournaments

Haupttabelle für alle Turniere.

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),

  -- Metadaten
  title TEXT NOT NULL,
  date DATE NOT NULL,
  age_class TEXT,
  location TEXT,
  sport_id TEXT DEFAULT 'football-indoor',

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'finished', 'archived')),
  share_code TEXT UNIQUE,

  -- Konfiguration (JSON)
  config JSONB DEFAULT '{}',

  -- Privacy-Settings für Public View
  hide_scores_for_public BOOLEAN DEFAULT false,
  hide_rankings_for_public BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Wichtige Felder:**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `share_code` | TEXT | 6-stelliger Code für Public View (z.B. "ABC123") |
| `status` | TEXT | draft → published → active → finished → archived |
| `hide_scores_for_public` | BOOL | Bambini-Modus: Keine Ergebnisse in Public View |
| `hide_rankings_for_public` | BOOL | Bambini-Modus: Keine Tabellen in Public View |
| `config` | JSONB | Enthält: numberOfFields, groupPhaseGameDuration, etc. |

---

### 2.2 teams

Teams gehören zu einem Turnier.

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  short_name TEXT,
  group_letter TEXT,

  -- Optionale Metadaten
  club TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Wichtige Felder:**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `group_letter` | TEXT | 'A', 'B', 'C', 'D' oder NULL für Playoffs |
| `short_name` | TEXT | Kurzname für Displays (z.B. "SVW" für "SV Wacker") |

---

### 2.3 matches

Alle Spiele eines Turniers.

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

  -- Teams
  team_a_id UUID REFERENCES teams(id),
  team_b_id UUID REFERENCES teams(id),

  -- Ergebnis
  score_a INTEGER,
  score_b INTEGER,

  -- Scheduling
  scheduled_time TIMESTAMPTZ,
  round INTEGER,
  field INTEGER,
  group_letter TEXT,

  -- Status
  match_status TEXT DEFAULT 'scheduled'
    CHECK (match_status IN ('scheduled', 'waiting', 'running', 'paused', 'finished', 'skipped')),

  -- Timer-Daten
  timer_start_time TIMESTAMPTZ,
  timer_elapsed_seconds INTEGER DEFAULT 0,

  -- Playoff-Flags
  is_final BOOLEAN DEFAULT false,
  phase TEXT DEFAULT 'groupStage',
  playoff_type TEXT, -- 'semi_final', 'third_place', 'final'

  -- Referee
  referee_team_id UUID REFERENCES teams(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Match-Status-Werte:**
| Status | Bedeutung | Typische Aktion |
|--------|-----------|-----------------|
| `scheduled` | Geplant, nicht gestartet | → "Spiel starten" |
| `waiting` | Teams bereit | → "Spiel starten" |
| `running` | Läuft gerade | → Tore eintragen, "Pausieren" |
| `paused` | Pausiert | → "Fortsetzen" |
| `finished` | Beendet | Keine weitere Interaktion |
| `skipped` | Übersprungen | Keine weitere Interaktion |

---

### 2.4 match_events

Ereignisse während eines Spiels.

```sql
CREATE TABLE match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

  -- Event-Typ
  type TEXT NOT NULL CHECK (type IN (
    'GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'PENALTY_MISS',
    'YELLOW_CARD', 'RED_CARD', 'SECOND_YELLOW',
    'TIME_PENALTY', 'SUBSTITUTION', 'NOTE'
  )),

  -- Zuordnung
  team_id UUID REFERENCES teams(id),
  player_id UUID REFERENCES team_players(id),

  -- Zeitpunkt
  timestamp_seconds INTEGER, -- Sekunde im Spiel

  -- Snapshot des Spielstands nach Event
  score_home INTEGER,
  score_away INTEGER,

  -- Zusatzdaten (JSON)
  payload JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Event-Typen:**
| Typ | Beschreibung | Payload |
|-----|--------------|---------|
| `GOAL` | Reguläres Tor | `{ jerseyNumber: 10, assistBy: 7 }` |
| `OWN_GOAL` | Eigentor | `{ jerseyNumber: 5 }` |
| `PENALTY_GOAL` | Elfmeter-Tor | `{ jerseyNumber: 9 }` |
| `PENALTY_MISS` | Elfmeter verschossen | `{ jerseyNumber: 9 }` |
| `YELLOW_CARD` | Gelbe Karte | `{ jerseyNumber: 3, reason: "Foul" }` |
| `RED_CARD` | Rote Karte | `{ jerseyNumber: 3, reason: "Tätlichkeit" }` |
| `SECOND_YELLOW` | Gelb-Rot | `{ jerseyNumber: 3 }` |
| `TIME_PENALTY` | Zeitstrafe | `{ duration: 120, reason: "..." }` |
| `SUBSTITUTION` | Wechsel | `{ playerIn: 12, playerOut: 7 }` |
| `NOTE` | Notiz | `{ text: "Trainer-Beschwerde" }` |

---

### 2.5 team_players

Spieler eines Teams.

```sql
CREATE TABLE team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  jersey_number INTEGER,
  position TEXT,

  is_captain BOOLEAN DEFAULT false,
  is_goalkeeper BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.6 monitors

Monitor-Konfigurationen für Großbildschirme.

```sql
CREATE TABLE monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  type TEXT DEFAULT 'scoreboard' CHECK (type IN ('scoreboard', 'schedule', 'standings')),

  -- Konfiguration
  config JSONB DEFAULT '{}',

  -- Welche Felder anzeigen (NULL = alle)
  field_filter INTEGER[],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.7 user_registrations

Registrierungscodes für neue Benutzer.

```sql
CREATE TABLE user_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code TEXT NOT NULL UNIQUE,
  email TEXT,
  user_id UUID REFERENCES auth.users(id),

  -- Quota
  max_tournaments INTEGER DEFAULT 10,

  -- Status
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,

  -- Metadaten
  created_by TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

**Hinweis:** Code-Validierung ist **case-insensitive**!

---

## 3. Beziehungen (ERD)

```
tournaments (1) ─────< (n) teams
     │
     │ (1)
     │
     └─────────< (n) matches
                    │
                    │ (1)
                    │
                    └─────< (n) match_events

teams (1) ─────< (n) team_players

tournaments (1) ─────< (n) monitors
```

---

## 4. Wichtige Abfragen

### 4.1 Turnier mit Share-Code laden

```sql
SELECT * FROM tournaments
WHERE share_code = 'ABC123';
```

### 4.2 Alle Teams eines Turniers

```sql
SELECT * FROM teams
WHERE tournament_id = '...'
ORDER BY group_letter, name;
```

### 4.3 Alle Spiele eines Turniers

```sql
SELECT
  m.*,
  ta.name AS team_a_name,
  tb.name AS team_b_name
FROM matches m
LEFT JOIN teams ta ON m.team_a_id = ta.id
LEFT JOIN teams tb ON m.team_b_id = tb.id
WHERE m.tournament_id = '...'
ORDER BY m.scheduled_time, m.round, m.field;
```

### 4.4 Events eines Spiels

```sql
SELECT * FROM match_events
WHERE match_id = '...'
ORDER BY timestamp_seconds;
```

### 4.5 Aktuelle Spiele (running)

```sql
SELECT * FROM matches
WHERE tournament_id = '...'
  AND match_status = 'running'
ORDER BY field;
```

---

## 5. Row Level Security (RLS)

### Policies für Public View

```sql
-- Öffentliche Turniere können von jedem gelesen werden
CREATE POLICY "Public tournaments readable"
ON tournaments FOR SELECT
USING (status IN ('published', 'active', 'finished'));

-- Teams öffentlicher Turniere sind lesbar
CREATE POLICY "Public teams readable"
ON teams FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_id
    AND t.status IN ('published', 'active', 'finished')
  )
);

-- Matches öffentlicher Turniere sind lesbar
CREATE POLICY "Public matches readable"
ON matches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_id
    AND t.status IN ('published', 'active', 'finished')
  )
);
```

---

## 6. Realtime Subscriptions

Für Live-Updates subscriben auf:

```typescript
// Turnier-Änderungen
supabase
  .channel('tournament-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'matches',
    filter: `tournament_id=eq.${tournamentId}`
  }, handleChange)
  .subscribe();

// Match-Events (Tore, Karten)
supabase
  .channel('match-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'match_events',
    filter: `match_id=eq.${matchId}`
  }, handleEvent)
  .subscribe();
```

---

## 7. Migration Notes

Die App unterstützt **Offline-First**:
- Daten werden primär in localStorage gespeichert
- Supabase-Sync erfolgt optional im Hintergrund
- Bei Konflikten: localStorage hat Priorität (optimistic)

**Storage Key:** `hallenfussball_tournaments`
