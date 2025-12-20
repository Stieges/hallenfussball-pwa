# US-INVITE: Einladungen & Turnier-Sharing

## Übersicht

**ID:** US-INVITE
**Priorität:** High
**Status:** Draft
**Erstellt:** 2025-12-20

---

## User Story

**Als** Turnier-Organisator
**möchte ich** verschiedene Personen zu meinem Turnier einladen können
**damit** Helfer bei der Zeitnahme unterstützen, Teams sich anmelden und Zuschauer den Spielplan verfolgen können.

---

## Einladungstypen

### 1. 👥 Helfer / Co-Organisatoren
**Zweck:** Unterstützung bei Zeitnahme, Ergebniseingabe, Spielleitung

| Berechtigung | Beschreibung |
|--------------|--------------|
| **Zeitnehmer** | Kann Timer starten/stoppen, Ergebnisse eingeben (nur zugewiesenes Feld) |
| **Spielleiter** | Kann alle Ergebnisse eingeben, SR zuweisen, Korrekturen vornehmen |
| **Vollzugriff** | Wie Spielleiter + Turnier-Einstellungen ändern |

**Technisch:** Generierter Link mit Token → Zugang ohne Login

### 2. ⚽ Teams / Trainer
**Zweck:** Team-Anmeldung, Kader-Eingabe, Team-Info

| Feature | Beschreibung |
|---------|--------------|
| **Anmelde-Link** | Teams können sich selbst registrieren |
| **Kader-Upload** | Spielernamen eingeben (für Torschützenliste) |
| **Team-Logo** | Eigenes Logo hochladen |
| **Kontaktdaten** | Trainer-Kontakt für Rückfragen |

**Technisch:** Öffentliches Formular mit Turnier-ID

### 3. 👀 Zuschauer / Eltern
**Zweck:** Live-Spielplan verfolgen, Ergebnisse sehen

| Feature | Beschreibung |
|---------|--------------|
| **Public Link** | Direkter Link zum öffentlichen Spielplan |
| **QR-Code** | Zum Ausdrucken/Aushängen in der Halle |
| **Live-Updates** | Automatische Aktualisierung der Ergebnisse |

**Technisch:** Bereits implementiert (PublicTournamentViewScreen)

---

## UI-Konzept

### Zugang zur Einladungsfunktion

**Option A:** Button im Turnier-Management Header
```
┌─────────────────────────────────────────────────────────────┐
│ ← Zurück   U11 Hallenturnier 2025              [👥 Einladen]│
├─────────────────────────────────────────────────────────────┤
│ [Spielplan] [Tabelle] [Ranking] [Cockpit] [Teams] [⚙️]     │
└─────────────────────────────────────────────────────────────┘
```

**Option B:** Eigener Tab "Teilen"
```
[Spielplan] [Tabelle] [Ranking] [Cockpit] [Teams] [Teilen] [⚙️]
```

### Einladungs-Dialog / Seite

```
┌─────────────────────────────────────────────────────────────┐
│                    Turnier teilen                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 ÖFFENTLICHER SPIELPLAN                                  │
│  ─────────────────────────────────────────                  │
│  Für Zuschauer, Eltern & Fans                               │
│                                                             │
│  ┌─────────┐  https://hallenfussball.app/t/abc123           │
│  │ QR-CODE │  [📋 Link kopieren] [📤 Teilen] [🖨️ Drucken]  │
│  │         │                                                │
│  └─────────┘  ☑️ Ergebnisse live anzeigen                   │
│               ☐ Tabelle ausblenden                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👥 HELFER EINLADEN                                         │
│  ─────────────────────────────────────────                  │
│  Für Zeitnehmer & Spielleiter                               │
│                                                             │
│  Rolle:  [▼ Zeitnehmer (Feld 1)    ]                        │
│          [▼ Zeitnehmer (Feld 2)    ]                        │
│          [▼ Spielleiter (alle Felder)]                      │
│          [▼ Vollzugriff           ]                         │
│                                                             │
│  [🔗 Einladungslink erstellen]                              │
│                                                             │
│  Aktive Einladungen:                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🟢 Zeitnehmer Feld 1    erstellt vor 2h   [🗑️ Löschen]│  │
│  │ 🟡 Spielleiter          Link noch nicht geöffnet      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚽ TEAM-ANMELDUNG                           [Coming Soon]  │
│  ─────────────────────────────────────────                  │
│  Teams können sich selbst anmelden                          │
│                                                             │
│  ☐ Team-Anmeldung aktivieren                                │
│  Anmeldeschluss: [Datum wählen]                             │
│  Max. Teams: [12]                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Helfer-Ansicht (nach Klick auf Einladungslink)

```
┌─────────────────────────────────────────────────────────────┐
│ 🏟️ U11 Hallenturnier 2025                                  │
│                                                             │
│ Du wurdest als ZEITNEHMER (Feld 1) eingeladen               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dein Name (optional):  [                    ]              │
│                                                             │
│  [✅ Einladung annehmen]                                    │
│                                                             │
│  Nach Annahme hast du Zugriff auf:                          │
│  • Timer für Feld 1 starten/stoppen                         │
│  • Ergebnisse für Feld 1 eingeben                           │
│  • Live-Spielplan ansehen                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### Öffentlicher Link & QR-Code
1. Given ich bin im Turnier-Management, When ich "Teilen" öffne, Then sehe ich den öffentlichen Link und QR-Code
2. Given der QR-Code wird angezeigt, When ich "Drucken" klicke, Then wird ein druckoptimiertes PDF mit QR-Code und Turnier-Info generiert
3. Given ich kopiere den öffentlichen Link, When ein Zuschauer ihn öffnet, Then sieht er den Live-Spielplan ohne Login

### Helfer einladen
4. Given ich wähle Rolle "Zeitnehmer Feld 1", When ich "Einladungslink erstellen" klicke, Then wird ein einzigartiger Token generiert
5. Given ein Helfer öffnet den Einladungslink, Then sieht er die Einladungs-Annahme-Seite mit Rolleninfo
6. Given ein Helfer akzeptiert die Einladung, Then wird sein Token im localStorage gespeichert und er hat Zugang zum Cockpit
7. Given ein Zeitnehmer (Feld 1) ist eingeloggt, Then sieht er NUR die Spiele von Feld 1 im Cockpit
8. Given ich als Organisator eine Einladung lösche, Then verliert der Helfer sofort den Zugang

### Einladungs-Management
9. Given ich habe mehrere Einladungen erstellt, Then sehe ich eine Liste aller aktiven Einladungen mit Status
10. Given eine Einladung wurde angenommen, Then wird der Status auf "Aktiv" gesetzt mit Zeitstempel
11. Given ich lösche eine Einladung, Then erscheint eine Bestätigung "Helfer verliert sofort Zugang"

### Sicherheit
12. Given ein Einladungstoken ist älter als 7 Tage und wurde nicht genutzt, Then wird er automatisch ungültig
13. Given jemand versucht einen ungültigen Token zu nutzen, Then sieht er "Einladung abgelaufen oder ungültig"
14. Given ein Helfer-Token wird genutzt, Then kann dieser NICHT die Turnier-Einstellungen ändern (außer Vollzugriff)

### Mein Team (Benutzerbereich)
15. Given ich bin im Benutzerbereich, When ich den Tab "Mein Team" öffne, Then sehe ich eine Liste meiner gespeicherten Helfer mit Name, Rolle und Altersklassen
16. Given ich klicke "Neues Team-Mitglied", When das Formular erscheint, Then kann ich Name, E-Mail, Telefon, Rolle und Altersklassen-Einschränkung eingeben
17. Given ich wähle eine Rolle aus, Then sehe ich eine Erklärung der Berechtigungen dieser Rolle
18. Given ich wähle spezifische Altersklassen (z.B. U11, U13), When ich speichere, Then kann dieser Helfer nur Turniere mit diesen Altersklassen sehen
19. Given ich habe Team-Mitglieder definiert, When ich ein neues Turnier erstelle/bearbeite, Then kann ich aus meinem Team schnell Helfer zuweisen
20. Given ein Team-Mitglied hat Altersklassen-Einschränkung, When ich es einem Turnier mit anderer Altersklasse zuweisen möchte, Then erhalte ich eine Warnung
21. Given ich bearbeite ein Team-Mitglied, When ich seine Altersklassen ändere, Then behält er Zugang zu Turnieren bei denen er bereits eingeladen wurde

### Ergebnis-Korrektur (Berechtigung)
22. Given ein Spiel ist beendet UND ich bin Organisator/Spielleiter/Vollzugriff, When ich auf "Ergebnis korrigieren" klicke, Then öffnet sich der Korrektur-Dialog
23. Given ein Spiel ist beendet UND ich bin Zeitnehmer/Schreiber, Then sehe ich KEINEN "Ergebnis korrigieren" Button
24. Given ich habe Korrektur-Berechtigung, When ich den Korrektur-Dialog öffne, Then sehe ich Spielpaarung, Ursprungsergebnis, Eingabefelder für neues Ergebnis und Korrekturgrund-Dropdown
25. Given ich speichere eine Korrektur, Then wird mein Benutzername, Zeitstempel und Korrekturgrund in der `correctionHistory` des Spiels gespeichert
26. Given ein Helfer ohne Korrektur-Berechtigung versucht das Ergebnis zu ändern, Then erscheint "Keine Berechtigung für Ergebnis-Korrekturen"

---

## Mein Team (Benutzerbereich)

### Konzept
Neben den einmaligen Turnier-Einladungen kann der Organisator im **Benutzerbereich** ein **dauerhaftes Team** von Helfern pflegen. Diese Personen können dann schnell zu neuen Turnieren hinzugefügt werden.

### UI im Benutzerbereich

```
┌─────────────────────────────────────────────────────────────┐
│ ← Zurück              Profil & Einstellungen                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Profil] [Branding] [Standards] [Mein Team] [Datenschutz]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👥 MEIN TEAM                                               │
│  ─────────────────────────────────────────                  │
│  Helfer die regelmäßig bei deinen Turnieren unterstützen    │
│                                                             │
│  [+ Neues Team-Mitglied hinzufügen]                         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 👤 Max Mustermann                                     │  │
│  │    Rolle: Spielleiter                                 │  │
│  │    Altersklassen: Alle                                │  │
│  │    ✉️ max@example.com  📱 +49 123 456789              │  │
│  │                                    [✏️ Bearbeiten]    │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 👤 Lisa Schmidt                                       │  │
│  │    Rolle: Zeitnehmer                                  │  │
│  │    Altersklassen: 🏷️ U11  🏷️ U13                      │  │
│  │    ✉️ lisa@example.com                                │  │
│  │                                    [✏️ Bearbeiten]    │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 👤 Tom Weber                                          │  │
│  │    Rolle: Vollzugriff                                 │  │
│  │    Altersklassen: 🏷️ U15  🏷️ U17                      │  │
│  │    ✉️ tom@example.com                                 │  │
│  │                                    [✏️ Bearbeiten]    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ℹ️ Team-Mitglieder können schnell zu Turnieren            │
│     hinzugefügt werden. Die Altersklassen-Einschränkung    │
│     begrenzt, welche Turniere ein Helfer sehen darf.       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Team-Mitglied hinzufügen/bearbeiten

```
┌─────────────────────────────────────────────────────────────┐
│                 Team-Mitglied hinzufügen                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Name *              [Max Mustermann              ]         │
│                                                             │
│  E-Mail              [max@example.com             ]         │
│                                                             │
│  Telefon             [+49 123 456789              ]         │
│                                                             │
│  ─────────────────────────────────────────                  │
│                                                             │
│  Rolle *                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ○ Zeitnehmer                                        │    │
│  │   Timer starten/stoppen, Ergebnisse eingeben        │    │
│  │   (nur zugewiesenes Feld)                           │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ ● Spielleiter                                       │    │
│  │   Alle Ergebnisse eingeben, SR zuweisen,            │    │
│  │   Korrekturen vornehmen                             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ ○ Vollzugriff                                       │    │
│  │   Wie Spielleiter + Turnier-Einstellungen ändern    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ─────────────────────────────────────────                  │
│                                                             │
│  Altersklassen-Einschränkung (optional)                     │
│  ☑️ Keine Einschränkung (alle Turniere)                     │
│                                                             │
│  Oder spezifische Altersklassen:                            │
│  [U9 ] [U11] [U13] [U15] [U17] [Ü30] [Ü40]                  │
│         ✓     ✓                                             │
│                                                             │
│  ℹ️ Wenn Altersklassen ausgewählt sind, kann dieser         │
│     Helfer nur Turniere dieser Altersklassen sehen          │
│     und bearbeiten.                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│            [Abbrechen]              [💾 Speichern]          │
└─────────────────────────────────────────────────────────────┘
```

### Schnell-Zuweisung bei Turnier-Erstellung

Im Turnier-Wizard (oder im Management) erscheint dann:

```
┌─────────────────────────────────────────────────────────────┐
│  👥 HELFER ZUWEISEN                                         │
│  ─────────────────────────────────────────                  │
│                                                             │
│  Aus deinem Team (passend für U11):                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ☑️ Max Mustermann (Spielleiter)                       │  │
│  │ ☑️ Lisa Schmidt (Zeitnehmer)                          │  │
│  │ ☐ Tom Weber (Vollzugriff) ⚠️ nur U15, U17             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [+ Weiteren Helfer einladen] (einmaliger Link)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Rollen & Berechtigungen mit Altersklassen

| Rolle | Berechtigungen | Altersklassen-Filter |
|-------|----------------|---------------------|
| **Zeitnehmer** | Timer, Ergebnis (1 Feld) | ✅ Gefiltert |
| **Schreiber** | Ergebnisse alle Felder | ✅ Gefiltert |
| **Spielleiter** | Alle Ergebnisse, SR, **Korrekturen** | ✅ Gefiltert |
| **Vollzugriff** | Alle Berechtigungen | ✅ Gefiltert |
| **Organisator** | Turnier-Besitzer (alle Rechte) | - |

### Detaillierte Berechtigungsmatrix

| Berechtigung | Zeitnehmer | Schreiber | Spielleiter | Vollzugriff | Organisator |
|--------------|:----------:|:---------:|:-----------:|:-----------:|:-----------:|
| Spielplan ansehen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timer steuern | ✅ (1 Feld) | ❌ | ✅ | ✅ | ✅ |
| Ergebnis eingeben | ✅ (1 Feld) | ✅ | ✅ | ✅ | ✅ |
| Schiedsrichter zuweisen | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Ergebnis korrigieren** | ❌ | ❌ | ✅ | ✅ | ✅ |
| Turnier bearbeiten | ❌ | ❌ | ❌ | ✅ | ✅ |
| Turnier löschen | ❌ | ❌ | ❌ | ❌ | ✅ |
| Helfer einladen | ❌ | ❌ | ❌ | ✅ | ✅ |

#### Ergebnis-Korrektur (`correct_results`)

Die Berechtigung `correct_results` erlaubt:
- Öffnen des Korrektur-Dialogs bei beendeten Spielen
- Eingabe eines neuen Ergebnisses mit Korrekturgrund
- Wird in der `correctionHistory` des Spiels mit Benutzername protokolliert

**Wer darf korrigieren:**
- Organisator (Turnier-Ersteller): Immer
- Spielleiter: Ja
- Vollzugriff: Ja
- Zeitnehmer/Schreiber: Nein (Button wird nicht angezeigt)

**Beispiel:**
- Lisa Schmidt (Zeitnehmer, U11 + U13) sieht im Dashboard nur U11- und U13-Turniere
- Tom Weber (Vollzugriff, U15 + U17) sieht nur U15- und U17-Turniere
- Max Mustermann (Spielleiter, Alle) sieht alle Turniere

---

## Technisches Konzept

### Token-Struktur

```typescript
interface InviteToken {
  id: string;                    // UUID
  tournamentId: string;
  createdAt: string;             // ISO timestamp
  expiresAt: string;             // ISO timestamp (default: +7 Tage)
  role: InviteRole;
  field?: number;                // Nur für Zeitnehmer
  status: 'pending' | 'accepted' | 'revoked';
  acceptedAt?: string;
  acceptedByName?: string;       // Optional: Name des Helfers
}

type InviteRole =
  | 'timekeeper'      // Zeitnehmer (1 Feld)
  | 'scorekeeper'     // Ergebnis-Eingabe (alle Felder)
  | 'manager'         // Spielleiter (+ SR-Zuweisung, Korrekturen)
  | 'admin';          // Vollzugriff

// Berechtigungen pro Rolle
const ROLE_PERMISSIONS: Record<InviteRole, string[]> = {
  timekeeper: ['view_schedule', 'control_timer', 'enter_score_own_field'],
  scorekeeper: ['view_schedule', 'enter_score_all_fields'],
  manager: ['view_schedule', 'enter_score_all_fields', 'assign_referees', 'correct_results'],
  admin: ['*'],  // Alle Berechtigungen
};

// Team-Mitglied (persistente Helfer im Benutzerbereich)
interface TeamMember {
  id: string;                          // UUID
  name: string;
  email?: string;
  phone?: string;
  role: InviteRole;
  ageClassRestrictions?: string[];     // z.B. ['U11', 'U13'] oder undefined = alle
  createdAt: string;                   // ISO timestamp
  lastActiveAt?: string;               // Letzte Aktivität
}

// Verfügbare Altersklassen
const AGE_CLASSES = [
  'Bambini', 'F-Jugend', 'E-Jugend', 'D-Jugend', 'C-Jugend',
  'B-Jugend', 'A-Jugend', 'U9', 'U11', 'U13', 'U15', 'U17', 'U19',
  'Herren', 'Ü30', 'Ü40', 'Ü50', 'Frauen'
] as const;
```

### URL-Schema

```
# Öffentlicher Spielplan (bestehend)
https://hallenfussball.app/tournament/{tournamentId}/public

# Helfer-Einladung
https://hallenfussball.app/invite/{inviteToken}

# Team-Anmeldung (Zukunft)
https://hallenfussball.app/tournament/{tournamentId}/register
```

### localStorage Struktur

```typescript
// Beim Organisator: Einladungen pro Turnier
interface TournamentInvites {
  [tournamentId: string]: InviteToken[];
}

// Beim Organisator: Persistentes Team (im UserProfile)
interface UserProfile {
  // ... andere Felder ...
  team: TeamMember[];  // Persistente Helfer
}

// Beim Helfer (nach Annahme einer Einladung)
interface AcceptedInvite {
  token: string;
  tournamentId: string;
  role: InviteRole;
  field?: number;
  acceptedAt: string;
  ageClassRestrictions?: string[];  // Von TeamMember übernommen
}

// Filterlogik für Altersklassen
function canAccessTournament(invite: AcceptedInvite, tournament: Tournament): boolean {
  if (!invite.ageClassRestrictions || invite.ageClassRestrictions.length === 0) {
    return true; // Keine Einschränkung = alle Turniere
  }
  return invite.ageClassRestrictions.includes(tournament.ageClass);
}
```

### Komponenten

```
src/
├── features/
│   ├── invites/
│   │   ├── InviteShareScreen.tsx      # "Teilen" Tab/Dialog
│   │   ├── InviteAcceptScreen.tsx     # Einladung annehmen
│   │   ├── HelperCockpit.tsx          # Reduziertes Cockpit für Helfer
│   │   ├── QRCodeGenerator.tsx        # QR-Code Komponente
│   │   ├── InviteList.tsx             # Liste aktiver Einladungen
│   │   └── index.ts
│   └── user-profile/
│       ├── TeamTab.tsx                # "Mein Team" Tab im Profil
│       ├── TeamMemberForm.tsx         # Formular zum Hinzufügen/Bearbeiten
│       ├── TeamMemberCard.tsx         # Anzeige eines Team-Mitglieds
│       └── AgeClassSelector.tsx       # Multi-Select für Altersklassen
├── hooks/
│   ├── useInvites.ts                  # Einladungs-Logik
│   └── useTeamMembers.ts              # Team-Mitglieder CRUD
└── types/
    └── invites.ts                     # TypeScript-Typen (inkl. TeamMember)
```

---

## Phasen-Plan

### Phase 1: Basis-Sharing (MVP)
- [x] Öffentlicher Spielplan (bereits implementiert)
- [ ] QR-Code Generator mit Druck-Funktion
- [ ] "Link kopieren" und "Teilen" (Web Share API)
- [ ] Einstellungen: Ergebnisse/Tabelle ausblenden

### Phase 2: Helfer-System
- [ ] Einladungslinks generieren mit Rollen
- [ ] Einladung-Annehmen-Flow
- [ ] Reduziertes Helfer-Cockpit
- [ ] Einladungs-Management (Liste, Löschen)

### Phase 2b: Mein Team (Benutzerbereich)
- [ ] TeamTab im Benutzerbereich
- [ ] Team-Mitglieder hinzufügen/bearbeiten/löschen
- [ ] Rollen-Auswahl mit Berechtigungs-Erklärung
- [ ] Altersklassen-Einschränkung (Multi-Select)
- [ ] Schnell-Zuweisung bei Turnier-Erstellung
- [ ] Filter im Dashboard für eingeschränkte Helfer

### Phase 3: Team-Anmeldung (Zukunft)
- [ ] Anmelde-Formular
- [ ] Kader-Eingabe
- [ ] Team-Logo-Upload
- [ ] Anmeldeschluss-Logik

### Phase 4: Backend-Integration (Zukunft)
- [ ] Echtzeit-Sync für mehrere Helfer
- [ ] Push-Notifications
- [ ] Konflikt-Auflösung bei gleichzeitiger Bearbeitung

---

## UX-Empfehlungen

1. **One-Click-Share:** Großer "Teilen"-Button der sofort Web Share API nutzt (Mobile)
2. **QR-Vorschau:** QR-Code immer sichtbar, nicht hinter Klick versteckt
3. **Rollen-Erklärung:** Bei Helfer-Einladung kurze Erklärung was die Rolle darf
4. **Status-Feedback:** Klare Anzeige ob Einladung angenommen wurde
5. **Offline-Hinweis:** Warnung wenn Helfer offline ist (keine Sync möglich)
6. **Druck-Optimierung:** QR-Code Poster mit Turnier-Logo, Datum, Ort

---

## Einschränkungen (ohne Backend)

| Feature | Mit localStorage | Mit Backend |
|---------|------------------|-------------|
| Mehrere Geräte gleichzeitig | ⚠️ Konfliktgefahr | ✅ Echtzeit-Sync |
| Helfer-Status live sehen | ❌ | ✅ |
| Push wenn Ergebnis eingegeben | ❌ | ✅ |
| Token widerrufen (sofort) | ⚠️ Erst bei nächstem Laden | ✅ Sofort |

**Empfehlung:** Phase 1+2 ohne Backend, Phase 3+4 mit Backend planen.

---

## Mockups

### QR-Code Druck-Poster

```
┌─────────────────────────────────────────┐
│                                         │
│        🏟️ U11 HALLENTURNIER            │
│           FC Musterstadt                │
│                                         │
│      ┌─────────────────────┐            │
│      │                     │            │
│      │      [QR-CODE]      │            │
│      │                     │            │
│      │                     │            │
│      └─────────────────────┘            │
│                                         │
│      📅 15.03.2025 | 09:00 Uhr         │
│      📍 Sporthalle am Sportpark        │
│                                         │
│   Scanne den Code für den              │
│   LIVE-SPIELPLAN                        │
│                                         │
│   hallenfussball.app/t/abc123          │
│                                         │
└─────────────────────────────────────────┘
```

### Helfer-Cockpit (Zeitnehmer Feld 1)

```
┌─────────────────────────────────────────────────────────────┐
│ 🏟️ U11 Hallenturnier         👤 Zeitnehmer (Feld 1)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AKTUELLES SPIEL - FELD 1                                   │
│  ─────────────────────────────────────────                  │
│                                                             │
│       FC Bayern        2 : 1        TSV 1860                │
│                                                             │
│                      ┌──────────┐                           │
│                      │  07:23   │                           │
│                      └──────────┘                           │
│                                                             │
│        [⏸️ Pause]    [✅ Beenden]                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  NÄCHSTES SPIEL                                             │
│  Spiel #4: SC Freiburg vs VfB Stuttgart (in 5 Min)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Verwandte User Stories

- **US-USER-PROFILE:** Profildaten für Kontakt-Anzeige
- **MON-PUBLIC-01:** Öffentlicher Spielplan (bereits implementiert)
- **MON-LIVE-INDICATOR-01:** Live-Badge für laufende Spiele
