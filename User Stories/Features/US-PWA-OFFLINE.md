# US-PWA-OFFLINE: Offline-First PWA mit Server-Sync

## Übersicht

**ID:** US-PWA-OFFLINE
**Priorität:** High
**Status:** Draft
**Erstellt:** 2025-12-22
**Feature-Referenz:** Top 5 Analyse

---

## User Story

**Als** Turnierleiter oder Zuschauer in einer Sporthalle mit schlechtem Empfang
**möchte ich** die App auch offline nutzen können
**damit** ich den Spielplan sehen und Ergebnisse erfassen kann, auch wenn das Internet ausfällt

---

## Architektur-Entscheidung: Offline-First

```
┌─────────────────────────────────────────────────────────────────┐
│              OFFLINE-FIRST + SERVER-SYNC ARCHITEKTUR            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   App startet IMMER mit localStorage-Daten (instant)            │
│          ↓                                                      │
│   Hintergrund: Sync mit Server (wenn online)                    │
│          ↓                                                      │
│   Bei Konflikt: Definierte Merge-Strategie                      │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   ONLINE:                                               │  │
│   │   ┌──────────┐    ┌─────────────┐    ┌────────────┐    │  │
│   │   │ Datenbank│ ←→ │ localStorage│ →  │ App zeigt  │    │  │
│   │   │ (Server) │    │   (Cache)   │    │  Daten ✓   │    │  │
│   │   └──────────┘    └─────────────┘    └────────────┘    │  │
│   │        ↑               ↑                               │  │
│   │        └───── SYNC ────┘                               │  │
│   │                                                         │  │
│   │   OFFLINE:                                              │  │
│   │   ┌──────────┐    ┌─────────────┐    ┌────────────┐    │  │
│   │   │ Datenbank│ ✗  │ localStorage│ →  │ App zeigt  │    │  │
│   │   │ (Server) │    │   (Cache)   │    │  Daten ✓   │    │  │
│   │   └──────────┘    └─────────────┘    └────────────┘    │  │
│   │                        ↑                               │  │
│   │                   Sync-Queue                           │  │
│   │                   (wartet auf                          │  │
│   │                    Reconnect)                          │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   Kernprinzip: localStorage = Single Source of Truth (lokal)   │
│                Server = Backup + Multi-Device-Sync             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### Phase 1: PWA Basis (Service Worker)

#### AC1-4: PWA Installation

1. Given ich besuche die App im Browser, When ich "Zum Homescreen hinzufügen" wähle, Then wird die App als PWA installiert.

2. Given die App ist installiert, When ich sie öffne, Then startet sie im Vollbild-Modus ohne Browser-UI.

3. Given die App ist installiert, When ich offline bin und die App öffne, Then lädt sie aus dem Cache und zeigt die zuletzt bekannten Daten an.

4. Given ich bin auf iOS, Then sehe ich einen Hinweis "Zum Homescreen hinzufügen" mit Anleitung (Safari Share-Button).

#### AC5-8: Asset-Caching

5. Given ich habe die App einmal online besucht, Then sind alle JavaScript/CSS/HTML-Assets im Service Worker Cache.

6. Given ich bin offline, When ich die App öffne, Then lädt sie vollständig aus dem Cache (kein Spinner, kein Fehler).

7. Given ein neues App-Update ist verfügbar, When ich die App online öffne, Then wird der Cache automatisch aktualisiert.

8. Given der Cache-Speicher wird voll, Then werden alte, unbenutzte Caches automatisch gelöscht (LRU).

### Phase 2: Offline-Feedback

#### AC9-12: Benutzer-Feedback

9. Given ich bin offline, Then zeigt ein Banner "Offline - Änderungen werden lokal gespeichert".

10. Given ich war offline und bin wieder online, Then verschwindet das Banner und zeigt kurz "Verbindung wiederhergestellt".

11. Given ich versuche eine Online-only-Funktion (z.B. Link teilen via Web Share), Then erhalte ich einen Hinweis "Diese Funktion benötigt Internet".

12. Given ich bin offline und mache Änderungen, Then zeigt ein Badge die Anzahl ungesyncter Änderungen an.

### Phase 3: Server-Sync (für zukünftiges Backend)

#### AC13-17: Sync-Queue

13. Given ich erfasse ein Ergebnis und bin offline, Then wird die Änderung in localStorage UND in einer Sync-Queue gespeichert.

14. Given ich bin wieder online, Then werden alle Änderungen aus der Sync-Queue automatisch zum Server synchronisiert.

15. Given die Synchronisation schlägt fehl (Server-Error), Then bleibt die Änderung in der Queue und wird beim nächsten Versuch erneut gesendet.

16. Given alle Änderungen wurden synchronisiert, Then wird die Sync-Queue geleert und das Badge verschwindet.

17. Given ich schließe die App während Änderungen in der Queue sind, Then bleiben diese erhalten und werden beim nächsten Start synchronisiert.

#### AC18-22: Konflikt-Handling

18. Given zwei Geräte haben offline das gleiche Spiel bearbeitet, When beide online gehen, Then gewinnt die Änderung mit dem neueren Timestamp (Last-Write-Wins).

19. Given es gibt einen Konflikt, Then wird ein Log-Eintrag erstellt mit beiden Werten.

20. Given der Turnierleiter ist vor Ort (Gerät mit aktivem MatchCockpit), Then hat sein Gerät Priorität bei Konflikten.

21. Given ein Zuschauer-Gerät hat veraltete Daten, When es online geht, Then erhält es die aktuellen Server-Daten.

22. Given ich öffne ein Turnier und es gibt neuere Server-Daten, Then werden diese heruntergeladen und localStorage aktualisiert.

### Phase 4: Multi-Device-Rollen

#### AC23-26: Rollen-basierte Sync

23. Given ich bin Turnierleiter (Owner), Then werden meine Änderungen zum Server gepusht.

24. Given ich bin Zuschauer, Then erhalte ich nur Lese-Zugriff und synchronisiere nur vom Server herunter.

25. Given ich bin Zeitnehmer (Helfer), Then kann ich Ergebnisse für mein Feld erfassen und diese werden synchronisiert.

26. Given mehrere Zeitnehmer arbeiten parallel auf verschiedenen Feldern, Then gibt es keine Konflikte (jeder bearbeitet nur sein Feld).

---

## Technisches Konzept

### Vite PWA Plugin Setup

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'Hallenfußball Turnier-Manager',
        short_name: 'Turnier',
        description: 'Turnier-Management für Hallenfußball',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#00e676',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
```

### Offline-Status Hook

```typescript
// src/hooks/useOnlineStatus.ts
import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;  // True wenn gerade reconnected
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Reset after showing "Reconnected" message
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
```

### Sync-Queue System

```typescript
// src/lib/syncQueue.ts
interface SyncQueueItem {
  id: string;
  action: 'CREATE_MATCH' | 'UPDATE_SCORE' | 'START_MATCH' | 'FINISH_MATCH' | 'UPDATE_TOURNAMENT';
  tournamentId: string;
  payload: any;
  timestamp: string;
  retryCount: number;
  synced: boolean;
}

const SYNC_QUEUE_KEY = 'hallenfussball_sync_queue';
const MAX_RETRIES = 5;

export function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'synced'>): void {
  const queue = getSyncQueue();
  queue.push({
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    retryCount: 0,
    synced: false,
  });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

  // Trigger sync if online
  if (navigator.onLine) {
    syncToServer();
  }
}

export function getSyncQueue(): SyncQueueItem[] {
  const stored = localStorage.getItem(SYNC_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getPendingSyncCount(): number {
  return getSyncQueue().filter(item => !item.synced).length;
}

export async function syncToServer(): Promise<void> {
  const queue = getSyncQueue().filter(item => !item.synced && item.retryCount < MAX_RETRIES);

  for (const item of queue) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });

      if (response.ok) {
        item.synced = true;
      } else if (response.status >= 500) {
        // Server error - retry later
        item.retryCount++;
      } else {
        // Client error (4xx) - don't retry, mark as synced to remove
        console.error('Sync failed permanently:', await response.text());
        item.synced = true;
      }
    } catch (err) {
      // Network error - retry later
      item.retryCount++;
    }
  }

  // Update queue
  const fullQueue = getSyncQueue();
  const updatedQueue = fullQueue.map(original =>
    queue.find(q => q.id === original.id) || original
  );
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));

  // Clean up synced items older than 24h
  cleanupSyncedItems();
}

function cleanupSyncedItems(): void {
  const queue = getSyncQueue();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cleaned = queue.filter(item =>
    !item.synced || new Date(item.timestamp).getTime() > cutoff
  );
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(cleaned));
}

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online - syncing queued changes...');
    syncToServer();
  });
}
```

### Offline Banner Component

```typescript
// src/components/OfflineBanner.tsx
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getPendingSyncCount } from '../lib/syncQueue';
import { theme } from '../styles/theme';

export const OfflineBanner: React.FC = () => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const pendingCount = getPendingSyncCount();

  if (isOnline && !wasOffline && pendingCount === 0) {
    return null;
  }

  const bannerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '8px 16px',
    textAlign: 'center',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    background: isOnline
      ? (wasOffline ? theme.colors.success : theme.colors.warning)
      : theme.colors.warning,
    color: '#000',
  };

  if (!isOnline) {
    return (
      <div style={bannerStyle}>
        <span>📡</span>
        <span>Offline-Modus</span>
        {pendingCount > 0 && (
          <span style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '12px',
          }}>
            {pendingCount} Änderung{pendingCount > 1 ? 'en' : ''} warten auf Sync
          </span>
        )}
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div style={bannerStyle}>
        <span>✓</span>
        <span>Verbindung wiederhergestellt</span>
        {pendingCount > 0 && <span>- Synchronisiere...</span>}
      </div>
    );
  }

  // Online with pending syncs
  if (pendingCount > 0) {
    return (
      <div style={{...bannerStyle, background: theme.colors.secondary}}>
        <span>🔄</span>
        <span>Synchronisiere {pendingCount} Änderung{pendingCount > 1 ? 'en' : ''}...</span>
      </div>
    );
  }

  return null;
};
```

### Data-Layer Integration

```typescript
// src/hooks/useTournamentData.ts
import { addToSyncQueue } from '../lib/syncQueue';

export function useTournamentData() {
  // ... existing localStorage logic ...

  const updateScore = useCallback((matchId: string, homeScore: number, awayScore: number) => {
    // 1. Sofort in localStorage speichern (für lokale Anzeige)
    const updatedTournament = applyScoreUpdate(tournament, matchId, homeScore, awayScore);
    saveTournament(updatedTournament);

    // 2. In Sync-Queue für Backend
    addToSyncQueue({
      action: 'UPDATE_SCORE',
      tournamentId: tournament.id,
      payload: { matchId, homeScore, awayScore },
    });
  }, [tournament]);

  return { tournament, updateScore, /* ... */ };
}
```

---

## Vercel Konfiguration

```json
// vercel.json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

---

## Phasen-Plan

### Phase 1: PWA Basis (MVP) - 3-4h
- [ ] `vite-plugin-pwa` installieren und konfigurieren
- [ ] `manifest.json` mit Icons erstellen
- [ ] Service Worker für Asset-Caching
- [ ] PWA-Icons in verschiedenen Größen (192, 512)
- [ ] iOS "Add to Homescreen" Anleitung

### Phase 2: Offline-UX - 2h
- [ ] `useOnlineStatus` Hook
- [ ] `OfflineBanner` Komponente
- [ ] Offline-Feedback in UI integrieren
- [ ] Graceful degradation für Online-only Features

### Phase 3: Sync-Queue (Backend-ready) - 4-6h
- [ ] `syncQueue.ts` Modul
- [ ] Integration in Data-Layer Hooks
- [ ] Pending-Changes Badge/Counter
- [ ] Auto-Sync bei Reconnect
- [ ] Retry-Logik mit Backoff

### Phase 4: Server-Integration (wenn Backend existiert) - 8-12h
- [ ] API-Endpoints für Sync
- [ ] Konflikt-Erkennung (Timestamp-basiert)
- [ ] Last-Write-Wins Strategie
- [ ] Rollen-basierte Sync (Owner vs Viewer)
- [ ] Pull-to-Refresh für manuelle Sync

---

## Aufwand-Schätzung

| Phase | Aufwand | Abhängigkeit |
|-------|---------|--------------|
| Phase 1 | 3-4h | - |
| Phase 2 | 2h | Phase 1 |
| Phase 3 | 4-6h | Phase 2 |
| Phase 4 | 8-12h | Backend existiert |

**Gesamt ohne Backend:** 9-12 Stunden
**Gesamt mit Backend:** 17-24 Stunden

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Sync-Konflikte | Mittel | Mittel | Last-Write-Wins + Logging |
| Queue wächst zu groß | Niedrig | Niedrig | Max-Size Limit, Cleanup |
| Service Worker Update-Probleme | Mittel | Mittel | autoUpdate + Reload-Prompt |
| localStorage-Limit | Niedrig | Hoch | Warnung bei >4MB |

---

## Checkliste nach Implementierung

### Phase 1
- [ ] App installierbar auf Android (Chrome)
- [ ] App installierbar auf iOS (Safari)
- [ ] App startet offline
- [ ] Assets laden aus Cache

### Phase 2
- [ ] Offline-Banner erscheint bei Verbindungsverlust
- [ ] "Reconnected" Feedback bei Wiederverbindung
- [ ] Online-only Features zeigen Hinweis

### Phase 3
- [ ] Änderungen gehen in Sync-Queue
- [ ] Badge zeigt Pending-Count
- [ ] Auto-Sync bei Reconnect funktioniert
- [ ] Queue überlebt App-Neustart

### Phase 4
- [ ] Server empfängt Sync-Requests
- [ ] Konflikte werden korrekt gehandhabt
- [ ] Multi-Device-Sync funktioniert
- [ ] Viewer erhält Updates

---

## Verwandte User Stories

- **US-INVITE:** Multi-User Rollen
- **US-SOCIAL-SHARING:** Sharing funktioniert nur online
- **US-MONITOR-OPTIMIZATION:** Monitor muss offline funktionieren
