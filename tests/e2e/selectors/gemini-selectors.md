# Gemini Agent UI Selectors

> **Zielgruppe:** Gemini AI Agent für automatisierte E2E-Tests
> **Basis-URL:** `https://hallenfussball-pwa.vercel.app`

---

## 1. Authentication / Registrierung

### Login-Seite (`/`)

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Email-Feld | `#email` | ID | Email-Eingabe |
| Passwort-Feld | `#password` | ID | Passwort-Eingabe |
| Login-Button | `button[type="submit"]` | CSS | Login absenden |
| Registrierungs-Link | Text: "Registrieren" | Text | Wechsel zur Registrierung |

### Registrierungs-Seite

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Registrierungs-Titel | `#register-title` | ID | Bestätigt Registrierungs-Screen |
| Email-Feld | `#email` | ID | Email-Eingabe |
| Passwort-Feld | `#password` | ID | Passwort-Eingabe |
| Registrierungscode | `#registrationCode` | ID | Einladungscode (case-insensitive!) |
| Registrieren-Button | `button[type="submit"]` | CSS | Registrierung absenden |

**Hinweis:** Registrierungscode ist case-insensitive (z.B. "BETA2024" = "beta2024")

---

## 2. Dashboard / Turnierliste

### Nach erfolgreichem Login (`/`)

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Turnier-Card | `[data-testid="tournament-card-{id}"]` | data-testid | Turnier auswählen |
| Neues Turnier Button | Text: "Neues Turnier" | Text | Wizard starten |
| Import Button | Text: "Importieren" | Text | JSON-Import Dialog |

### Import-Dialog

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Datei-Input | `input[type="file"]` | CSS | JSON-Datei auswählen |
| Import-Bestätigung | Text: "Importieren" (Button) | Text | Import starten |

---

## 3. Turnier-Management (`/tournament/:id`)

### Navigation Tabs

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Spielplan Tab | Text: "Spielplan" | Text | Schedule-Ansicht |
| Tabellen Tab | Text: "Tabellen" | Text | Standings-Ansicht |
| Live Tab | Text: "Live" | Text | Live-Management |
| Teams Tab | Text: "Teams" | Text | Team-Verwaltung |
| Settings Tab | Text: "Einstellungen" | Text | Turnier-Settings |

### Spielplan-Ansicht (`/tournament/:id/schedule`)

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Match-Zeile | `[data-testid="match-row-{matchId}"]` | data-testid | Einzelnes Spiel |
| Match-Status | `[data-testid="match-status-{matchId}"]` | data-testid | Status-Badge |
| Zum Live-Cockpit | Klick auf Match-Zeile oder Button | - | Match-Cockpit öffnen |

---

## 4. Live-Cockpit (`/tournament/:id/match/:matchId`)

### Header & Status

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Timer-Display | `[data-testid="match-timer-display"]` | data-testid | Zeigt aktuelle Spielzeit |
| Status-Badge | `[data-testid="match-status-badge"]` | data-testid | running/paused/finished |
| Zurück-Button | `[aria-label="Zurück"]` | aria-label | Navigation zurück |

### Team-Anzeige

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Team A Name | `[data-testid="team-name-A"]` | data-testid | Heimteam-Name |
| Team B Name | `[data-testid="team-name-B"]` | data-testid | Auswärtsteam-Name |
| Score Team A | `[data-testid="score-A"]` | data-testid | Heimteam-Tore |
| Score Team B | `[data-testid="score-B"]` | data-testid | Auswärtsteam-Tore |

### Tor-Buttons

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Tor Team A | `[data-testid="goal-button-A"]` | data-testid | Tor für Heimteam |
| Tor Team B | `[data-testid="goal-button-B"]` | data-testid | Tor für Auswärtsteam |

### Match-Steuerung

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Spiel starten | `[aria-label="Spiel starten"]` | aria-label | Match von scheduled → running |
| Spiel pausieren | `[aria-label="Spiel pausieren"]` | aria-label | Match pausieren |
| Spiel fortsetzen | `[aria-label="Spiel fortsetzen"]` | aria-label | Match fortsetzen |
| Spiel beenden | `[aria-label="Spiel beenden"]` | aria-label | Match abschließen |

---

## 5. GoalScorerDialog (Torschützen-Eingabe)

> **Wichtig:** Öffnet sich automatisch nach Klick auf Tor-Button

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Dialog-Container | `[role="dialog"]` | role | Dialog-Root |
| Trikotnummer-Input | `input[type="number"]` | CSS | Nummer 0-99 eingeben |
| Quick-Select 1-11 | Buttons mit Nummern 1-11 | Text | Schnellauswahl |
| Ohne Nummer | Text: "Ohne Nummer" | Text | Tor ohne Trikotnummer |
| Bestätigen | Text: "Bestätigen" / "OK" | Text | Tor bestätigen |
| Abbrechen | Text: "Abbrechen" | Text | Dialog schließen |

**Auto-Dismiss:** Dialog schließt sich nach 10 Sekunden automatisch (Tor wird ohne Nummer erfasst)

---

## 6. Public View (`/live/:shareCode`)

### Für Zuschauer (readonly)

| Element | Selector | Typ | Beschreibung |
|---------|----------|-----|--------------|
| Turnier-Titel | `h1` | Tag | Turnier-Name |
| Navigation | `nav[aria-label="Public Navigation"]` | aria-label | Bottom-Nav |
| Tab Spiele | Text: "Spiele" | Text | Spielplan-Ansicht |
| Tab Tabellen | Text: "Tabellen" | Text | Standings-Ansicht |
| Tab Info | Text: "Info" | Text | Settings/QR-Code |

---

## 7. Match-Status-Werte

| Status | Bedeutung | Farbe |
|--------|-----------|-------|
| `scheduled` | Geplant, nicht gestartet | Grau |
| `waiting` | Wartet (Teams bereit) | Gelb |
| `running` | Läuft gerade | Grün |
| `paused` | Pausiert | Orange |
| `finished` | Beendet | Blau |
| `skipped` | Übersprungen | Grau durchgestrichen |

---

## 8. Typische User Flows

### Flow 1: Turnier importieren
```
1. Login → Dashboard
2. Klick "Importieren"
3. JSON-Datei auswählen
4. Import bestätigen
5. Turnier erscheint in Liste
```

### Flow 2: Match starten & Tore eintragen
```
1. Dashboard → Turnier-Card klicken
2. Spielplan Tab → Match auswählen
3. Im Cockpit: "Spiel starten" klicken
4. Tor-Button (A oder B) klicken
5. Trikotnummer eingeben oder "Ohne Nummer"
6. Bestätigen
7. Score aktualisiert sich
```

### Flow 3: Match beenden
```
1. Im Cockpit: "Spiel beenden" klicken
2. Bestätigungsdialog → Bestätigen
3. Status wechselt zu "finished"
4. Ergebnis ist final
```

---

## 9. Bekannte Einschränkungen

1. **Timer läuft weiter:** Timer stoppt bei Pause, läuft aber bei Spielende weiter bis explizit beendet
2. **GoalScorerDialog Timeout:** Nach 10s Auto-Schließung wird Tor ohne Nummer erfasst
3. **Public View readonly:** Keine Interaktion möglich, nur Anzeige
4. **Offline-Verhalten:** localStorage wird als Fallback genutzt wenn Supabase nicht erreichbar

---

## 10. Debug-Hinweise

- **Console-Logs:** Im Produktions-Build deaktiviert
- **Network-Tab:** Supabase-Requests prüfen für Sync-Status
- **localStorage:** `hallenfussball_tournaments` enthält lokale Daten
