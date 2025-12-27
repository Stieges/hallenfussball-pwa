# US-PAGE-ANALYTICS: Seitenaufrufe Statistik

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-PAGE-ANALYTICS |
| **Priorität** | Low |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Admin |
| **Impact** | Niedrig |

---

## User Story

**Als** Turnierleiter
**möchte ich** sehen können, wie oft mein Turnier-Spielplan aufgerufen wurde
**damit** ich weiß, wie viele Leute das Turnier verfolgen

---

## Kontext

Einfache Besucherstatistik ohne komplexes Analytics:
- Anzahl Aufrufe der öffentlichen Ansicht
- Keine persönlichen Daten
- Reine Vanity-Metrik

### Herausforderung
Die App ist rein client-seitig (localStorage). Für echte Analytics bräuchte man:
- Ein Backend das Aufrufe zählt, ODER
- Einen Drittanbieter-Service (z.B. Plausible, Simple Analytics)

---

## Lösungsansätze

### Option A: Drittanbieter (empfohlen)

**Plausible Analytics** oder **Simple Analytics**:
- DSGVO-konform (kein Cookie-Banner nötig)
- Einfache Integration (1 Script-Tag)
- Kosten: ~9€/Monat für Plausible

```html
<script
  defer
  data-domain="turnier.app"
  src="https://plausible.io/js/script.js"
></script>
```

### Option B: Lokale Zählung (nur eigener Besuch)

Nur sichtbar für den Turnierleiter auf seinem Gerät:

```typescript
// Jeder Besuch der Public-View inkrementiert Zähler
function trackPublicView(tournamentId: string) {
  const key = `views_${tournamentId}`;
  const current = parseInt(localStorage.getItem(key) || '0');
  localStorage.setItem(key, String(current + 1));
}
```

**Problem:** Zählt nur Besuche auf DIESEM Gerät, nicht von anderen.

### Option C: Serverless Counter (Vercel Edge Functions)

Einfacher Zähler ohne echte Datenbank:

```typescript
// /api/view/[tournamentId].ts (Vercel Serverless Function)
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { tournamentId } = req.query;
  const key = `views:${tournamentId}`;

  const count = await kv.incr(key);

  res.json({ views: count });
}
```

**Kosten:** Vercel KV hat Free-Tier (30k requests/month).

---

## Acceptance Criteria

### AC1-3: Basis-Statistik

1. Given ich öffne mein Turnier als Turnierleiter, Then sehe ich "X Aufrufe" in der Übersicht.

2. Given ein Zuschauer öffnet die öffentliche Ansicht, Then wird der Zähler erhöht.

3. Given ich möchte Details sehen, Then kann ich ein einfaches Diagramm aufrufen (Aufrufe pro Tag).

### AC4-5: Datenschutz

4. Given Analytics aktiv ist, Then werden keine persönlichen Daten erfasst (keine IPs, keine Cookies).

5. Given ich möchte Analytics deaktivieren, Then gibt es einen Toggle in den Einstellungen.

---

## UI-Konzept

### Turnier-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│ Hallenturnier 2025                                          │
│ 16 Teams · 4 Gruppen · Läuft                                │
│                                                             │
│ 👁️ 142 Aufrufe seit Veröffentlichung                       │
│                                                             │
│ [Verwalten]  [Öffentliche Ansicht]  [Teilen]               │
└─────────────────────────────────────────────────────────────┘
```

### Detailansicht (optional)

```
┌─────────────────────────────────────────────────────────────┐
│ Besucherstatistik                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Gesamt: 142 Aufrufe                                        │
│                                                             │
│  Letzte 7 Tage:                                             │
│  Mo  Di  Mi  Do  Fr  Sa  So                                │
│  ██  ██  ██  ██  ██████████                                 │
│  12  8   15  10  32  45  20                                 │
│                                                             │
│  Spitze: Samstag (Turniertag)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Empfehlung

**Für MVP:** Option A (Plausible Analytics) - Einfach, datenschutzkonform, keine eigene Entwicklung.

**Falls kostenlos bleiben soll:** Option C mit Vercel KV für einfachen Counter ohne History.

---

## Aufwand

| Option | Aufwand | Kosten |
|--------|---------|--------|
| A: Plausible | 30 min Setup | ~9€/Monat |
| B: Lokal | 1 Stunde | Kostenlos (aber nutzlos) |
| C: Vercel KV | 2-3 Stunden | Kostenlos (Free-Tier) |

---

## Verwandte User Stories

- **PUBLIC-SCHEDULE:** Öffentliche Ansicht
- **US-SOCIAL-SHARING:** Mehr Aufrufe durch Teilen
