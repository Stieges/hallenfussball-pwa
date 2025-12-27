# US-SOCIAL-SHARING: Social Media Sharing

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-SOCIAL-SHARING |
| **Priorität** | Medium |
| **Status** | In Progress (60% Done) |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Viewer |
| **Impact** | Hoch |

---

## User Story

**Als** Turnierleiter oder Zuschauer
**möchte ich** Turnier-Links einfach über WhatsApp, Social Media oder andere Apps teilen können
**damit** mehr Leute vom Turnier erfahren und den Live-Spielplan verfolgen können

---

## Kontext

Die Web Share API ermöglicht natives Teilen auf mobilen Geräten. Dies ist besonders wichtig für:
- Eltern, die anderen Eltern den Link schicken
- Vereine, die auf Social Media werben
- Schnelles Teilen des eigenen Team-Links

### Ist-Zustand
- Nur manuelles Kopieren der URL möglich
- Kein QR-Code für schnelles Teilen
- Keine ansprechende Link-Vorschau (Open Graph)

---

## Acceptance Criteria

### AC1-4: Native Share API

1. Given ich bin auf einem mobilen Gerät, When ich den "Teilen" Button drücke, Then öffnet sich das native Share-Sheet (WhatsApp, iMessage, etc.).

2. Given ich teile den Turnier-Link, Then enthält die Nachricht:
   - Turnier-Name
   - Link zur öffentlichen Ansicht
   - Kurze Beschreibung (z.B. "Live-Spielplan")

3. Given ich bin auf einem Desktop ohne Web Share API, Then wird stattdessen ein Dialog mit Kopier-Button und Social-Media-Links angezeigt.

4. Given ich habe ein Team ausgewählt, When ich "Teilen" drücke, Then wird der Team-Filter in der URL mitgeteilt.

### AC5-7: QR-Code

5. Given ich öffne den Teilen-Dialog, Then sehe ich einen QR-Code der den aktuellen Link repräsentiert.

6. Given der QR-Code wird gescannt, Then öffnet sich direkt die (gefilterte) Turnier-Ansicht.

7. Given ich drucke den Spielplan, Then kann ich optional einen QR-Code zur Live-Ansicht einbetten.

### AC8-10: Open Graph Meta-Tags

8. Given jemand teilt den Turnier-Link auf WhatsApp/Facebook, Then wird eine ansprechende Vorschau angezeigt mit:
   - Turnier-Titel
   - "Live-Spielplan" als Beschreibung
   - Optional: Turnier-Logo oder App-Icon

9. Given der Link wird auf Twitter geteilt, Then werden Twitter-Card Meta-Tags verwendet.

10. Given ich ändere den Turnier-Namen, Then werden die Meta-Tags entsprechend aktualisiert.

---

## UI-Konzept

### Share-Button (Mobile)

```
┌─────────────────────────────────────────────────────────────┐
│ Hallenturnier 2025                                          │
│ Live-Spielplan                                   [↗ Teilen] │
├─────────────────────────────────────────────────────────────┤
│ ...                                                         │
```

### Share-Dialog (Desktop Fallback)

```
┌─────────────────────────────────────────────────────────────┐
│                    Link teilen                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ https://turnier.app/t/abc123/public                 │    │
│  │                                      [📋 Kopieren]  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────┐                                                │
│  │   ▓▓▓   │  Scannen für mobilen Zugriff                  │
│  │   ▓▓▓   │                                                │
│  │   ▓▓▓   │                                                │
│  └─────────┘                                                │
│                                                             │
│  Teilen via:                                                │
│  [📱 WhatsApp] [📘 Facebook] [🐦 Twitter] [📧 E-Mail]       │
│                                                             │
│                        [Schließen]                          │
└─────────────────────────────────────────────────────────────┘
```

### Team-spezifischer Share

```
┌─────────────────────────────────────────────────────────────┐
│ FC Bayern München - Spielplan                    [↗ Teilen] │
├─────────────────────────────────────────────────────────────┤
│ Teilt: https://turnier.app/t/abc123/public?team=fc-bayern   │
│ "Zeige alle Spiele von FC Bayern München"                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technisches Konzept

### Web Share API

```typescript
interface ShareData {
  title: string;
  text: string;
  url: string;
}

async function shareLink(data: ShareData): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
      return false;
    }
  }
  // Fallback: Show dialog
  return false;
}

// Usage
function shareTournament(tournament: Tournament, teamFilter?: string) {
  const url = new URL(window.location.origin);
  url.pathname = `/tournament/${tournament.id}/public`;
  if (teamFilter) {
    url.searchParams.set('team', teamFilter);
  }

  shareLink({
    title: tournament.title,
    text: 'Live-Spielplan verfolgen',
    url: url.toString(),
  });
}
```

### QR-Code Generation

```typescript
// Using qrcode library (lightweight)
import QRCode from 'qrcode';

async function generateQRCode(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 200,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });
}
```

### Open Graph Meta-Tags (index.html)

```html
<!-- Dynamisch per JavaScript setzen -->
<meta property="og:title" content="Hallenturnier 2025">
<meta property="og:description" content="Live-Spielplan verfolgen">
<meta property="og:url" content="https://turnier.app/t/abc123/public">
<meta property="og:type" content="website">
<meta property="og:image" content="https://turnier.app/og-image.png">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Hallenturnier 2025">
```

### Meta-Tag Update (SPA-kompatibel)

```typescript
function updateMetaTags(tournament: Tournament) {
  document.title = `${tournament.title} | Spielplan`;

  const metaTags = {
    'og:title': tournament.title,
    'og:description': 'Live-Spielplan verfolgen',
    'og:url': window.location.href,
  };

  Object.entries(metaTags).forEach(([property, content]) => {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  });
}
```

---

## Phasen

### Phase 1: Native Share (MVP)
- [ ] Share-Button in öffentlicher Ansicht
- [ ] Web Share API Integration
- [ ] Desktop-Fallback mit Copy-Button

### Phase 2: QR-Code
- [ ] QR-Code Generierung
- [ ] QR im Share-Dialog
- [ ] QR in Druckansicht (optional)

### Phase 3: Open Graph
- [ ] Meta-Tags im HTML
- [ ] Dynamisches Update per JavaScript
- [ ] Standard OG-Image erstellen

---

## Aufwand

| Phase | Geschätzter Aufwand |
|-------|---------------------|
| Phase 1 | 1-2 Stunden |
| Phase 2 | 1 Stunde |
| Phase 3 | 1-2 Stunden |

---

## Dependencies

- **qrcode** (npm) - ~30KB für QR-Generierung
- Keine Server-Änderung nötig für Phase 1+2
- Open Graph benötigt ggf. SSR für crawler (optional)

---

## Verwandte User Stories

- **US-VIEWER-FILTERS:** Team-Filter wird in URL übernommen
- **US-INVITE:** Einladungs-System
- **PUBLIC-SCHEDULE:** Öffentliche Ansicht
