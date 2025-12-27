# Backend Migration Guide

Dieses Dokument beschreibt, wie die Hallenfußball PWA von localStorage auf ein Cloud-Backend umgestellt werden kann.

## Aktuelle Architektur

Die App verwendet aktuell **localStorage** für die Datenspeicherung. Die gesamte Datenzugriff-Logik ist im **API Service Layer** (`src/services/api.ts`) abstrahiert.

### Dateien:
- **`src/services/api.ts`**: API Service Layer (aktuell localStorage, später HTTP)
- **`src/hooks/useTournaments.ts`**: React Hook, der den API Service verwendet
- **`src/utils/storage.ts`**: ⚠️ DEPRECATED - Wird nicht mehr verwendet

## Migration zu Backend

### Schritt 1: Backend-API bereitstellen

Erstelle ein Backend mit folgenden Endpoints:

```
GET    /api/v1/tournaments           - Alle Turniere holen
GET    /api/v1/tournaments/:id       - Einzelnes Turnier holen
POST   /api/v1/tournaments           - Neues Turnier erstellen
PUT    /api/v1/tournaments/:id       - Turnier aktualisieren
DELETE /api/v1/tournaments/:id       - Turnier löschen
```

**Request/Response Format:**

```typescript
// Tournament Type
interface Tournament {
  id: string;
  status: 'draft' | 'published';
  // ... siehe src/types/tournament.ts
}

// Response Format
{
  "success": true,
  "data": Tournament | Tournament[],
  "error"?: string
}
```

### Schritt 2: API Service anpassen

Öffne `src/services/api.ts` und passe die Konfiguration an:

```typescript
const API_CONFIG = {
  BASE_URL: 'https://api.hallenfussball.de/v1',  // Deine Backend-URL
  USE_LOCAL_STORAGE: false,  // ⚠️ Auf false setzen!
};
```

### Schritt 3: Backend-Calls implementieren

Die auskommentierten Backend-Calls in `src/services/api.ts` aktivieren:

```typescript
export async function getAllTournaments(): Promise<Tournament[]> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/tournaments`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,  // Falls Auth benötigt
    },
  });

  if (!response.ok) throw new Error('Failed to fetch tournaments');
  const data = await response.json();
  return data.data; // Anpassen je nach Response-Format
}
```

### Schritt 4: Authentifizierung hinzufügen (Optional)

Falls User-Authentifizierung benötigt wird:

1. **Auth Service erstellen** (`src/services/auth.ts`)
2. **Token Management** (localStorage oder Cookie)
3. **Protected Routes** implementieren

```typescript
// Beispiel: Auth Service
export async function login(email: string, password: string) {
  const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  localStorage.setItem('auth_token', data.token);
  return data.user;
}

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}
```

### Schritt 5: Erweiterte Features

**Multi-User Support:**

Füge folgende Felder zum `Tournament` Type hinzu:

```typescript
interface Tournament {
  // ... bestehende Felder

  // Neu für Backend:
  userId: string;              // Ersteller
  organizerId?: string;        // Organisation
  visibility: 'public' | 'private' | 'organization';
  shareToken?: string;         // Sharing-Token
  collaborators?: string[];    // Bearbeiter
}
```

Siehe `BackendTournamentExtension` in `src/services/api.ts`.

## Testing

### Lokales Testing

1. **Backend lokal starten** (z.B. auf Port 3000)
2. **CORS konfigurieren** im Backend
3. **API_CONFIG anpassen**:
   ```typescript
   BASE_URL: 'http://localhost:3000/api/v1',
   USE_LOCAL_STORAGE: false,
   ```

### Production Deployment

1. Backend deployen (z.B. auf AWS, Google Cloud, Vercel)
2. Environment Variables konfigurieren
3. API_CONFIG über `.env` steuern:
   ```typescript
   BASE_URL: import.meta.env.VITE_API_URL,
   ```

## Rollback Plan

Falls Probleme auftreten:

```typescript
const API_CONFIG = {
  USE_LOCAL_STORAGE: true,  // Zurück zu localStorage
};
```

Keine weiteren Änderungen nötig - alle Komponenten funktionieren weiterhin!

## Checkliste

- [ ] Backend-API implementiert
- [ ] Endpoints getestet (Postman/Insomnia)
- [ ] CORS konfiguriert
- [ ] `API_CONFIG.USE_LOCAL_STORAGE = false` gesetzt
- [ ] Backend-Calls in `api.ts` aktiviert
- [ ] Error Handling getestet
- [ ] Loading States funktionieren
- [ ] Authentifizierung implementiert (falls benötigt)
- [ ] Environment Variables konfiguriert
- [ ] Production Deployment getestet

## Weitere Ressourcen

- [TypeScript Type Definitions](./src/types/tournament.ts)
- [API Service Layer](./src/services/api.ts)
- [React Hook](./src/hooks/useTournaments.ts)

## Support

Bei Fragen zur Backend-Integration:
- Code-Kommentare in `src/services/api.ts` lesen
- TypeScript Typen beachten
- Error Handling nicht vergessen!
