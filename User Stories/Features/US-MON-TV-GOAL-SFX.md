# US-MON-TV-GOAL-SFX: Team-spezifische Tor-Sounds

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MON-TV-GOAL-SFX |
| **Priorität** | Low |
| **Status** | Open |
| **Erstellt** | 2025-12-15 |
| **Kategorie** | Monitor |
| **Impact** | Niedrig |

---

## User Story

**Als** Turnier-Organisator
**möchte ich** bei einem Tor eine individuell pro Mannschaft konfigurierbare Tonsequenz abspielen
**damit** Tore stimmungsvoll hervorgehoben werden und jede Mannschaft ihren eigenen Wiedererkennungs-Effekt hat

---

## Kontext

Optionale Erweiterung der Tor-Animation mit individuellen Sounds. Teams können ihre eigene Tor-Musik haben (z.B. Vereinshymne, Fangesang).

---

## Acceptance Criteria

### Konfiguration

1. **AC1:** Given ein Turnier ist angelegt, When ich in den Team-Einstellungen ein Team bearbeite, Then kann ich optional eine Tor-Tonsequenz auswählen oder hochladen.

### Kein Sound konfiguriert

2. **AC2:** Given ein Team keine eigene Tor-Tonsequenz konfiguriert hat, When das Team ein Tor erzielt, Then wird entweder ein Standard-Tor-Sound oder gar kein Ton abgespielt.

### Sound konfiguriert

3. **AC3:** Given ein Team eine eigene Tor-Tonsequenz konfiguriert hat, When das Team ein Tor erzielt, Then wird die Toranimation angezeigt und gleichzeitig die Tonsequenz abgespielt.

### Beide Teams mit Sound

4. **AC4:** Given beide Teams eigene Sounds haben, When Heimteam ein Tor erzielt, Then wird nur der Heimteam-Sound abgespielt. When Gastteam ein Tor erzielt, Then wird nur der Gastteam-Sound abgespielt.

### Kein Audio-Output

5. **AC5:** Given der Monitor ohne Audioausgabe oder stummgeschaltet ist, When ein Tor erzielt wird, Then wird die Toranimation trotzdem angezeigt (kein Fehler).

### Überlappung vermeiden

6. **AC6:** Given während einer laufenden Tonsequenz ein weiteres Tor erzielt wird, When möglich, Then wird die laufende Sequenz sauber beendet/überblendet.

### Änderung nach Konfiguration

7. **AC7:** Given ich ändere die Tor-Tonsequenz eines Teams, When später ein Tor erfasst wird, Then wird die neue Tonsequenz abgespielt.

### Feature nicht genutzt

8. **AC8:** Given ich nutze die Funktion nicht, When Tore angezeigt werden, Then funktioniert die visuelle Animation unverändert.

---

## UX-Hinweise

- Bereich 'Tor-Sound' in Team-Einstellungen: 'Kein spezieller Sound', 'Aus Liste wählen', 'Datei hochladen'
- Lautsprecher-Icon in Monitor-Ansicht zeigt aktiven Ton
- 'Test abspielen'-Button für Tor-Sound
- Dauer und Lautstärke begrenzen (max. 5-10 Sekunden)
- Bei mehreren Spielfeldern Überlagerungen vermeiden

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Verwandt** | US-MON-TV-GOAL |
