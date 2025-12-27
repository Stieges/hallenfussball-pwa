# Multi-User Konzept: Hallenfußball-PWA

## Executive Summary

Dieses Dokument beschreibt die Architektur für die Multi-User-Fähigkeit der Hallenfußball-PWA mit:
- **Authentifizierung**: Google Login (1-Click)
- **Echtzeit-Datenbank**: Firestore oder Supabase
- **Offline-First**: Lokale Persistenz mit automatischem Sync
- **Hosting**: Vercel (Frontend) + Cloud-Backend

---

## 1. Technologie-Vergleich

### 1.1 Backend-as-a-Service Optionen

| Kriterium | Firebase | Supabase | Clerk + Neon |
|-----------|----------|----------|--------------|
| **Auth** | Firebase Auth | Supabase Auth | Clerk |
| **Datenbank** | Firestore (NoSQL) | PostgreSQL | Neon PostgreSQL |
| **Echtzeit** | Native | Native | Zusätzlich nötig |
| **Offline-Sync** | Native | Manuell | Manuell |
| **Google Login** | 1 Zeile Code | 1 Zeile Code | 3 Zeilen Code |
| **Free Tier** | Großzügig | Großzügig | Begrenzt |
| **Vendor Lock-in** | Hoch | Niedrig (Open Source) | Niedrig |
| **React-Integration** | Exzellent | Sehr gut | Sehr gut |
| **PWA Offline** | Automatisch | Manuell | Manuell |

### 1.2 Empfehlung: **Supabase** (Primär) oder **Firebase** (Alternative)

**Supabase Vorteile:**
- Open Source (kein Vendor Lock-in)
- PostgreSQL (relationale Daten ideal für Turniere)
- Row Level Security (RLS) für feingranulare Berechtigungen
- Self-Hosting möglich (adesso-konform)
- Realtime Subscriptions für Live-Updates

**Firebase Vorteile:**
- Beste Offline-Sync Unterstützung (automatisch)
- Schnellste Integration
- Bewährte Skalierbarkeit

---

## 2. Authentifizierung

### 2.1 Login-Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ANMELDEBILDSCHIRM                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  🏆 Hallenfußball Turnier-Manager          │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  🔵 Mit Google anmelden                     │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  📧 Mit E-Mail anmelden                     │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
│     ────────── oder ──────────                             │
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  👤 Als Gast fortfahren (nur lokal)         │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Benutzerrollen

| Rolle | Beschreibung | Berechtigungen |
|-------|--------------|----------------|
| **Gast** | Nicht angemeldet | Nur lokale Turniere, keine Cloud-Sync |
| **User** | Angemeldeter Benutzer | Eigene Turniere erstellen, bearbeiten, teilen |
| **Viewer** | Öffentlicher Zuschauer | Nur Lesen von öffentlichen Turnieren |
| **Collaborator** | Eingeladener Helfer | Ergebnisse eintragen für freigegebene Turniere |
| **Admin** | Turnier-Ersteller | Volle Kontrolle über eigene Turniere |

### 2.3 Supabase Auth Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Google Login (1-Click)
export const signInWithGoogle = () => {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};

// E-Mail Magic Link
export const signInWithEmail = (email: string) => {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

---

## 3. Datenbank-Schema

### 3.1 Tabellenstruktur (PostgreSQL/Supabase)

```sql
-- ============================================
-- USERS (von Supabase Auth verwaltet)
-- ============================================
-- auth.users (automatisch von Supabase)

-- Erweitertes User-Profil
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TOURNAMENTS
-- ============================================
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Status & Visibility
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_public BOOLEAN DEFAULT FALSE,
  share_code TEXT UNIQUE, -- Kurzer Code für öffentliche URLs (z.B. "ABC123")

  -- Metadaten
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time_slot TIME,
  age_class TEXT,
  organizer TEXT,

  -- Location (JSONB für Flexibilität)
  location JSONB, -- { name, street, city, postalCode, country, coordinates }

  -- Konfiguration (JSONB für komplexe Strukturen)
  config JSONB NOT NULL, -- Enthält: mode, groupSystem, finalsConfig, refereeConfig, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indizes für Suche
  CONSTRAINT valid_share_code CHECK (share_code ~ '^[A-Z0-9]{6}$')
);

-- ============================================
-- TEAMS
-- ============================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  group_letter TEXT, -- 'A', 'B', etc.
  is_removed BOOLEAN DEFAULT FALSE,
  removed_at TIMESTAMPTZ,

  -- Reihenfolge für Drag & Drop
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tournament_id, name)
);

-- ============================================
-- MATCHES
-- ============================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

  -- Spielstruktur
  round INTEGER NOT NULL,
  field INTEGER NOT NULL,
  slot INTEGER, -- Time slot für Fair Scheduling
  match_number INTEGER, -- Fortlaufende Spielnummer

  -- Teams (können IDs oder Platzhalter sein)
  team_a TEXT NOT NULL, -- UUID oder "group-a-1st", "semi1-winner"
  team_b TEXT NOT NULL,

  -- Ergebnis
  score_a INTEGER,
  score_b INTEGER,

  -- Gruppenphase vs Finalrunde
  group_letter TEXT, -- NULL für Finalspiele
  is_final BOOLEAN DEFAULT FALSE,
  final_type TEXT CHECK (final_type IN ('final', 'thirdPlace', 'fifthSixth', 'seventhEighth')),
  label TEXT, -- "1. Halbfinale", "Finale", etc.

  -- Match Status (TL-RESULT-LOCK-01)
  match_status TEXT DEFAULT 'scheduled' CHECK (match_status IN ('scheduled', 'running', 'finished')),
  finished_at TIMESTAMPTZ,

  -- Timer-Persistenz
  timer_start_time TIMESTAMPTZ,
  timer_paused_at TIMESTAMPTZ,
  timer_elapsed_seconds INTEGER DEFAULT 0,

  -- Schiedsrichter
  referee INTEGER, -- SR-Nummer (1, 2, 3...)

  -- Zeitplanung
  scheduled_time TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MATCH CORRECTIONS (Audit Trail)
-- ============================================
CREATE TABLE public.match_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

  previous_score_a INTEGER NOT NULL,
  previous_score_b INTEGER NOT NULL,
  new_score_a INTEGER NOT NULL,
  new_score_b INTEGER NOT NULL,

  reason_type TEXT CHECK (reason_type IN ('input_error', 'referee_decision', 'protest_accepted', 'technical_error', 'other')),
  note TEXT,

  corrected_by UUID REFERENCES auth.users(id),
  corrected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TOURNAMENT COLLABORATORS (Sharing)
-- ============================================
CREATE TABLE public.tournament_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Für Einladungen ohne Account
  invite_email TEXT,
  invite_code TEXT UNIQUE,

  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'collaborator', 'admin')),

  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  UNIQUE(tournament_id, user_id),
  UNIQUE(tournament_id, invite_email)
);

-- ============================================
-- OFFLINE SYNC QUEUE
-- ============================================
CREATE TABLE public.sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Was wurde geändert?
  entity_type TEXT NOT NULL, -- 'tournament', 'match', 'team'
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),

  -- Payload der Änderung
  payload JSONB NOT NULL,

  -- Sync-Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,

  -- Client-Tracking
  client_timestamp TIMESTAMPTZ NOT NULL, -- Wann wurde die Änderung lokal gemacht?
  client_id TEXT -- Device-ID für Konflikt-Erkennung
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Profiles: Jeder kann lesen, nur eigenes bearbeiten
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tournaments: Komplexe Zugriffsregeln
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Lesen: Eigene ODER öffentliche ODER als Collaborator
CREATE POLICY "View own or public tournaments" ON tournaments
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_public = true
    OR id IN (
      SELECT tournament_id FROM tournament_collaborators
      WHERE user_id = auth.uid() OR invite_email = auth.email()
    )
  );

-- Erstellen: Nur angemeldete User
CREATE POLICY "Create own tournaments" ON tournaments
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Bearbeiten: Nur Owner oder Admin-Collaborator
CREATE POLICY "Update own or admin tournaments" ON tournaments
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT tournament_id FROM tournament_collaborators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Matches: Abhängig von Tournament-Berechtigung
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View matches of accessible tournaments" ON matches
  FOR SELECT USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE
        owner_id = auth.uid()
        OR is_public = true
        OR id IN (SELECT tournament_id FROM tournament_collaborators WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Update matches as owner or collaborator" ON matches
  FOR UPDATE USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE owner_id = auth.uid()
      UNION
      SELECT tournament_id FROM tournament_collaborators
      WHERE user_id = auth.uid() AND role IN ('collaborator', 'admin')
    )
  );

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================
-- Supabase Realtime ist automatisch für alle Tabellen aktiviert
-- Client subscribed auf: tournaments, matches, teams

-- Beispiel Realtime Setup:
-- supabase.channel('tournament-123')
--   .on('postgres_changes', {
--     event: '*',
--     schema: 'public',
--     table: 'matches',
--     filter: 'tournament_id=eq.123'
--   }, handleChange)
--   .subscribe()
```

### 3.2 Datenfluss-Diagramm

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA)                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   React State   │◄──►│  IndexedDB      │◄──►│  Sync Engine    │  │
│  │   (Zustand)     │    │  (Offline)      │    │                 │  │
│  └────────┬────────┘    └─────────────────┘    └────────┬────────┘  │
│           │                                              │           │
│           ▼                                              ▼           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Supabase Client SDK                          ││
│  │  • Auth (Google, E-Mail)                                        ││
│  │  • Realtime Subscriptions                                       ││
│  │  • Offline Queue                                                ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                    │                                 │
└────────────────────────────────────┼─────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Auth Service  │    │   PostgreSQL    │    │   Realtime      │  │
│  │   (Google SSO)  │    │   + RLS         │    │   Engine        │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Edge         │    │   Storage       │    │   Functions     │  │
│  │   Functions    │    │   (Logos, PDFs) │    │   (Cron Jobs)   │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Offline-First Architektur

### 4.1 Sync-Strategie

```typescript
// src/lib/offlineSync.ts

interface SyncQueueItem {
  id: string;
  entityType: 'tournament' | 'match' | 'team';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  clientTimestamp: Date;
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
}

class OfflineSyncEngine {
  private db: IDBDatabase;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.initIndexedDB();
    this.setupNetworkListeners();
  }

  // Speichert Änderung lokal + Queue
  async saveLocally<T>(
    entityType: string,
    entityId: string,
    data: T,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    // 1. In IndexedDB speichern
    await this.saveToIndexedDB(entityType, entityId, data);

    // 2. In Sync-Queue einfügen
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      entityType,
      entityId,
      operation,
      payload: data,
      clientTimestamp: new Date(),
      status: 'pending',
    };
    await this.addToSyncQueue(queueItem);

    // 3. Wenn online, sofort syncen
    if (this.isOnline) {
      this.processQueue();
    }
  }

  // Verarbeitet alle pending Items
  async processQueue(): Promise<void> {
    const pendingItems = await this.getPendingItems();

    for (const item of pendingItems) {
      try {
        await this.syncItem(item);
        await this.markAsSynced(item.id);
      } catch (error) {
        if (this.isConflict(error)) {
          await this.markAsConflict(item.id, error);
        } else {
          await this.markAsFailed(item.id, error);
        }
      }
    }
  }

  // Konflikt-Auflösung
  async resolveConflict(
    itemId: string,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void> {
    const item = await this.getQueueItem(itemId);

    switch (resolution) {
      case 'local':
        // Lokale Version erzwingen
        await this.forceSync(item);
        break;
      case 'remote':
        // Remote-Version übernehmen
        await this.fetchAndApplyRemote(item.entityType, item.entityId);
        break;
      case 'merge':
        // Merge-Dialog anzeigen
        // ... Merge-Logik
        break;
    }
  }
}
```

### 4.2 Offline-Indikatoren UI

```typescript
// src/components/OfflineIndicator.tsx

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingChanges === 0) return null;

  return (
    <div className="offline-banner">
      {!isOnline ? (
        <>
          <span>📴 Offline-Modus</span>
          <span>Änderungen werden gespeichert</span>
        </>
      ) : (
        <>
          <span>🔄 Synchronisiere...</span>
          <span>{pendingChanges} Änderungen ausstehend</span>
        </>
      )}
    </div>
  );
};
```

---

## 5. Hosting & Deployment

### 5.1 Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│   VERCEL (Frontend)   │       │  SUPABASE (Backend)   │
├───────────────────────┤       ├───────────────────────┤
│                       │       │                       │
│  • React PWA          │  ◄──► │  • PostgreSQL DB      │
│  • Static Assets      │       │  • Auth Service       │
│  • Edge Functions     │       │  • Realtime Engine    │
│  • CDN (Global)       │       │  • Storage (Files)    │
│                       │       │                       │
│  hallenfussball.app   │       │  *.supabase.co        │
│                       │       │                       │
└───────────────────────┘       └───────────────────────┘
```

### 5.2 Domain-Struktur

| Domain | Zweck |
|--------|-------|
| `hallenfussball.app` | Hauptanwendung |
| `t.hallenfussball.app/ABC123` | Öffentliche Turnier-Links (kurz) |
| `api.hallenfussball.app` | API (optional, für Erweiterungen) |

### 5.3 Kosten-Kalkulation

| Service | Free Tier | Geschätzte Nutzung | Kosten/Monat |
|---------|-----------|-------------------|--------------|
| **Vercel** | 100GB Bandwidth | ~10GB | $0 |
| **Supabase** | 500MB DB, 2GB Storage | ~100MB DB | $0 |
| **Domain** | - | .app Domain | ~$14/Jahr |
| **Summe** | - | - | **~$1.20/Monat** |

---

## 6. User Stories

### Epic: Benutzer-Authentifizierung (AUTH)

#### AUTH-001: Google Login
**Als** Turnierorganisator
**möchte ich** mich mit meinem Google-Konto anmelden können
**damit** ich keine neuen Zugangsdaten erstellen muss

**Akzeptanzkriterien:**
- [ ] "Mit Google anmelden" Button auf Login-Seite
- [ ] 1-Click Login ohne Passwort-Eingabe
- [ ] Automatische Profilübernahme (Name, Avatar)
- [ ] Weiterleitung zum Dashboard nach erfolgreicher Anmeldung
- [ ] Fehlerbehandlung bei abgelehnter Berechtigung

**Story Points:** 3

---

#### AUTH-002: E-Mail Magic Link
**Als** Benutzer ohne Google-Konto
**möchte ich** mich per E-Mail-Link anmelden können
**damit** ich die App auch ohne Google nutzen kann

**Akzeptanzkriterien:**
- [ ] E-Mail-Eingabefeld auf Login-Seite
- [ ] "Magic Link" wird per E-Mail versendet
- [ ] Link ist 24h gültig
- [ ] Automatische Anmeldung beim Klick auf Link
- [ ] Fallback für ungültige/abgelaufene Links

**Story Points:** 3

---

#### AUTH-003: Gast-Modus
**Als** Gelegenheitsnutzer
**möchte ich** die App ohne Anmeldung testen können
**damit** ich entscheiden kann, ob ich ein Konto erstelle

**Akzeptanzkriterien:**
- [ ] "Als Gast fortfahren" Option
- [ ] Alle Features verfügbar, aber nur lokal
- [ ] Hinweis-Banner: "Anmelden für Cloud-Sync"
- [ ] Möglichkeit, Gast-Daten nach Anmeldung zu migrieren
- [ ] Lokale Daten bleiben nach Browser-Schließen erhalten

**Story Points:** 2

---

#### AUTH-004: Benutzerprofil
**Als** angemeldeter Benutzer
**möchte ich** mein Profil bearbeiten können
**damit** mein Name korrekt bei Korrekturen angezeigt wird

**Akzeptanzkriterien:**
- [ ] Profil-Seite mit Anzeigename, E-Mail, Avatar
- [ ] Anzeigename änderbar
- [ ] Avatar-Upload (optional)
- [ ] Abmelden-Button
- [ ] Konto-Löschung (DSGVO)

**Story Points:** 2

---

### Epic: Cloud-Synchronisierung (SYNC)

#### SYNC-001: Automatischer Cloud-Sync
**Als** angemeldeter Benutzer
**möchte ich** dass meine Turniere automatisch in der Cloud gespeichert werden
**damit** ich von jedem Gerät darauf zugreifen kann

**Akzeptanzkriterien:**
- [ ] Turniere werden bei Änderung automatisch gespeichert
- [ ] Sync-Status-Indikator (✓ Gespeichert, ⏳ Speichert...)
- [ ] Turniere erscheinen auf anderen Geräten
- [ ] Letzte Synchronisierung wird angezeigt

**Story Points:** 5

---

#### SYNC-002: Offline-Modus
**Als** Turnierorganisator in einer Sporthalle ohne Internet
**möchte ich** Ergebnisse offline eingeben können
**damit** das Turnier nicht unterbrochen wird

**Akzeptanzkriterien:**
- [ ] Offline-Banner zeigt aktuellen Status
- [ ] Alle Eingaben werden lokal gespeichert
- [ ] Anzahl ausstehender Änderungen wird angezeigt
- [ ] Automatischer Sync wenn wieder online
- [ ] Keine Datenverluste bei Verbindungsabbruch

**Story Points:** 8

---

#### SYNC-003: Konflikt-Auflösung
**Als** Benutzer mit mehreren Geräten
**möchte ich** bei Konflikten entscheiden können welche Version gilt
**damit** keine wichtigen Daten verloren gehen

**Akzeptanzkriterien:**
- [ ] Konflikt-Warnung bei abweichenden Versionen
- [ ] Vergleichsansicht: Lokal vs. Remote
- [ ] Optionen: "Meine behalten", "Server übernehmen", "Zusammenführen"
- [ ] Konflikt-Historie einsehbar
- [ ] Automatische Auflösung bei nicht-kritischen Konflikten

**Story Points:** 5

---

#### SYNC-004: Echtzeit-Updates
**Als** Zuschauer eines laufenden Turniers
**möchte ich** Ergebnisse in Echtzeit sehen
**damit** ich keine wichtigen Spiele verpasse

**Akzeptanzkriterien:**
- [ ] Ergebnisse erscheinen ohne Seiten-Refresh
- [ ] Tabellen aktualisieren sich automatisch
- [ ] Visueller Hinweis bei neuen Ergebnissen
- [ ] "Live"-Badge bei laufenden Spielen
- [ ] < 2 Sekunden Latenz

**Story Points:** 5

---

### Epic: Turnier-Sharing (SHARE)

#### SHARE-001: Öffentlicher Turnier-Link
**Als** Turnierorganisator
**möchte ich** einen kurzen Link zu meinem Turnier teilen können
**damit** Zuschauer einfach darauf zugreifen können

**Akzeptanzkriterien:**
- [ ] "Teilen"-Button generiert Kurzlink (z.B. t.app/ABC123)
- [ ] Link ist per WhatsApp/QR-Code teilbar
- [ ] Öffentliche Ansicht ohne Login
- [ ] Nur-Lesen-Modus für Besucher
- [ ] Statistiken: Anzahl Aufrufe

**Story Points:** 3

---

#### SHARE-002: Mitarbeiter einladen
**Als** Turnierorganisator
**möchte ich** Helfer einladen können, die Ergebnisse eintragen
**damit** ich nicht alles alleine machen muss

**Akzeptanzkriterien:**
- [ ] "Helfer einladen" per E-Mail
- [ ] Einladungslink mit beschränkten Rechten
- [ ] Helfer können Ergebnisse eintragen
- [ ] Helfer können KEINE Einstellungen ändern
- [ ] Einladungen können widerrufen werden

**Story Points:** 5

---

#### SHARE-003: Turnier-Transfer
**Als** Turnierorganisator
**möchte ich** ein Turnier an jemand anderen übertragen können
**damit** die Person volle Kontrolle erhält

**Akzeptanzkriterien:**
- [ ] "Besitz übertragen" Option in Einstellungen
- [ ] Bestätigung durch neuen Besitzer erforderlich
- [ ] Alter Besitzer wird zum Collaborator
- [ ] Alle Daten bleiben erhalten
- [ ] Audit-Log der Übertragung

**Story Points:** 3

---

### Epic: Datenmigration (MIGRATE)

#### MIGRATE-001: LocalStorage zu Cloud
**Als** bestehender Gast-Benutzer
**möchte ich** meine lokalen Turniere in die Cloud migrieren
**damit** ich sie nicht verliere

**Akzeptanzkriterien:**
- [ ] Nach Login: "Lokale Turniere gefunden" Dialog
- [ ] Auswahlmöglichkeit welche Turniere migriert werden
- [ ] Fortschrittsanzeige während Migration
- [ ] Lokale Kopie wird nach erfolgreicher Migration gelöscht
- [ ] Fehlerbehandlung bei teilweiser Migration

**Story Points:** 3

---

#### MIGRATE-002: Export/Backup
**Als** Benutzer
**möchte ich** meine Daten exportieren können
**damit** ich ein lokales Backup habe

**Akzeptanzkriterien:**
- [ ] "Alle Daten exportieren" Button
- [ ] JSON-Export aller Turniere
- [ ] PDF-Export einzelner Turniere (besteht bereits)
- [ ] Verschlüsselungsoption für sensible Daten
- [ ] DSGVO-konformer Datenexport

**Story Points:** 2

---

### Epic: Administration (ADMIN)

#### ADMIN-001: Turnier-Archivierung
**Als** Benutzer mit vielen Turnieren
**möchte ich** alte Turniere archivieren können
**damit** mein Dashboard übersichtlich bleibt

**Akzeptanzkriterien:**
- [ ] "Archivieren" Option für abgeschlossene Turniere
- [ ] Archivierte Turniere in separatem Tab
- [ ] Archivierte Turniere weiterhin einsehbar
- [ ] "Wiederherstellen" Option
- [ ] Automatisches Archivieren nach X Tagen (konfigurierbar)

**Story Points:** 2

---

#### ADMIN-002: Nutzungsstatistiken
**Als** Turnierorganisator
**möchte ich** sehen wie oft mein Turnier angesehen wurde
**damit** ich die Reichweite einschätzen kann

**Akzeptanzkriterien:**
- [ ] Anzahl Besucher pro Turnier
- [ ] Zeitlicher Verlauf der Aufrufe
- [ ] Herkunft der Besucher (optional)
- [ ] Exportierbare Statistiken
- [ ] Datenschutzkonforme Erhebung

**Story Points:** 3

---

## 7. Implementierungs-Roadmap

### Phase 1: Fundament (2-3 Wochen)
1. Supabase-Projekt einrichten
2. Auth-Integration (Google + E-Mail)
3. Basis-Datenbankschema
4. Login/Logout Flow

### Phase 2: Cloud-Sync (2-3 Wochen)
1. CRUD-Operationen über Supabase
2. Realtime-Subscriptions
3. Migration bestehender LocalStorage-Daten
4. Sync-Status UI

### Phase 3: Offline-First (2 Wochen)
1. IndexedDB Integration
2. Sync-Queue Implementierung
3. Konflikt-Erkennung
4. Offline-Indikator

### Phase 4: Sharing & Collaboration (2 Wochen)
1. Öffentliche Turnier-Links
2. Collaborator-Einladungen
3. Berechtigungssystem
4. QR-Code Sharing

### Phase 5: Polish & Launch (1 Woche)
1. Performance-Optimierung
2. Error-Handling
3. Analytics-Integration
4. Dokumentation

---

## 8. Sicherheitsaspekte

### 8.1 Datenschutz (DSGVO)
- Nur notwendige Daten speichern
- Löschfunktion für alle Benutzerdaten
- Datenexport-Funktion
- Klare Datenschutzerklärung
- Consent für optionale Features

### 8.2 Authentifizierung
- OAuth 2.0 für Google Login
- Sichere Session-Tokens
- Rate Limiting für API-Aufrufe
- Brute-Force Schutz

### 8.3 Autorisierung
- Row Level Security (RLS) in Supabase
- Minimale Berechtigungen (Least Privilege)
- Audit-Logging für kritische Aktionen

---

## 9. Technische Entscheidungen

| Entscheidung | Gewählt | Alternativen | Begründung |
|--------------|---------|--------------|------------|
| Backend | Supabase | Firebase, Clerk+Neon | Open Source, PostgreSQL, Self-Hosting möglich |
| Auth | Supabase Auth | Auth0, Clerk | Integriert, kostenlos, Google OAuth |
| Realtime | Supabase Realtime | Socket.io, Pusher | Native Integration, keine Extra-Kosten |
| Offline | IndexedDB + Custom Sync | PouchDB, Dexie | Volle Kontrolle, weniger Dependencies |
| Hosting | Vercel | Netlify, Cloudflare Pages | Beste React/Vite Unterstützung, kostenlos |
| State | Zustand | Redux, Jotai | Bereits im Projekt, lightweight |

---

## 10. Nächste Schritte

1. **Entscheidung**: Supabase vs. Firebase
2. **Projekt-Setup**: Supabase-Projekt erstellen
3. **Sprint Planning**: User Stories priorisieren
4. **Prototyp**: Login-Flow implementieren
5. **Review**: Security-Audit der Architektur

---

*Dokument erstellt: 21.12.2024*
*Version: 1.0*
