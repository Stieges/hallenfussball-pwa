# Eine Sportart hinzufügen

> Ziel der Struktur (Daniel): „Momentan haben wir nur Fußball. Also muss die Struktur
> so sein, dass man sie erweitern kann, wenn etwas anderes hinzukommt."
>
> Eine Sportart hinzuzufügen kostet **eine Konfigurationsdatei plus einen
> Sprachblock je Locale** — nicht mehr. Dieses Dokument ist das Rezept dafür, in
> Schritten, mit Basketball als Vorlage (das Sprachblock-Muster liegt bereits in
> `sport.json`, aber ist bewusst **nicht registriert** — es dient hier nur als
> Beispiel).

## Voraussetzungen zum Verständnis

- Fachbegriffe (Feld/Tor/Halbzeit/Sieg/… inkl. Plural- und Sportart-Varianten)
  leben ausschließlich in `src/i18n/locales/{de,en}/sport.json` und werden über
  `useSportTerms`/`useSportConfig` aufgelöst — **nicht** in `src/config/sports/`.
- `src/config/sports/` ist frei von Sprache: nur Struktur, Zahlen, Flags, IDs.
- `src/config/sports/capabilities.ts` (`UNIMPLEMENTED_CAPABILITIES`) listet Felder,
  die `SportConfig` zwar deklariert, die aber **von keinem Code ausgewertet
  werden**. Siehe Abschnitt „Was heute nicht geht" unten.
- `src/config/sports/__tests__/sportConformance.test.ts` prüft automatisch jede
  registrierte Sportart gegen genau diese drei Punkte (Fähigkeiten, Terminologie,
  Validierungsgrenzen). Nach jedem Schritt unten: Test laufen lassen.

## Schritt 1: Konfigurationsdatei anlegen

Neue Datei `src/config/sports/basketball.ts` (Beispielname), strukturell an
`src/config/sports/football.ts` orientiert:

```ts
import { SportConfig } from './types';

export const basketballConfig: SportConfig = {
  id: 'basketball',
  icon: '🏀',
  category: 'ball',

  // Rein strukturell — keine deutschen/englischen Zeichenketten hier.
  terminology: {
    scoreFormat: 'goals', // siehe „Was heute nicht geht" — 'points' wäre unehrlich
  },

  defaults: {
    gameDuration: 10,
    breakDuration: 2,
    periods: 4, // Viertel
    periodBreak: 2,
    pointSystem: { win: 1, draw: 0, loss: 0 }, // Basketball kennt kein Unentschieden
    allowDraw: false,
    typicalTeamSize: 5,
    typicalFieldCount: 1,
    minRestSlots: 1,
    defaultFinalsPreset: 'top-4',
  },

  rules: {
    canDrawInGroupPhase: false, // Basketball: Unentschieden ausgeschlossen
    canDrawInFinals: false,
    hasOvertime: true,
    overtimeDuration: 5,
    hasShootout: false,
    defaultTiebreaker: 'overtime-then-shootout',
    defaultTiebreakerDuration: 5,
    isSetBased: false, // MUSS false bleiben — siehe „Was heute nicht geht"
  },

  features: {
    hasDFBKeys: false, // nur Fußball
    hasBambiniMode: true,
    hasRefereeAssignment: true,
    hasGoalAnimation: true,
    hasMatchTimer: true,
    hasPeriodTimer: true,
    isSetBased: false,
  },

  // Beschriftungen leben in sport.json (`ageClasses.<value>`). Entweder eine
  // eigene Liste definieren oder — wenn die Altersklassen identisch sind —
  // von einer bestehenden Config übernehmen, z. B.
  // `ageClasses: footballIndoorConfig.ageClasses` (siehe football.ts, wie es
  // footballOutdoorConfig bereits tut).
  ageClasses: [
    { value: 'U10', maxAge: 10 },
    { value: 'U12', maxAge: 12 },
    // ...
  ],

  validation: {
    minTeams: 3,
    maxTeams: 32,
    minFields: 1,
    maxFields: 6,
    minGameDuration: 5,
    maxGameDuration: 40,
  },
};
```

Wichtig: `defaults.gameDuration` muss innerhalb von
`validation.minGameDuration`/`maxGameDuration` liegen,
`defaults.typicalFieldCount` innerhalb von `validation.minFields`/`maxFields` —
der Konformitätstest (Schritt 4) prüft das automatisch.

## Schritt 2: In `src/config/sports/index.ts` registrieren

In `src/config/sports/index.ts` gibt es bereits die auskommentierte Zeile:

```ts
export const sportRegistry = new Map<SportId, SportConfig>([
  ['football-indoor', footballIndoorConfig],
  ['football-outdoor', footballOutdoorConfig],
  // Future sports will be added here:
  // ['handball', handballConfig],
  // ['basketball', basketballConfig],   ← diese Zeile aktivieren
  // ...
]);
```

Import ergänzen (`import { basketballConfig } from './basketball';`) und die
Zeile aktivieren. `SportId` in `types.ts` enthält `'basketball'` bereits als
möglichen Wert — für eine komplett neue Sportart (nicht in der Liste) muss der
Union-Type in `types.ts` zuerst erweitert werden.

## Schritt 3: Sprachblock je Locale ergänzen

Für **jede** Sprache unter `src/i18n/locales/<locale>/sport.json` (heute `de`,
`en`) die sportartabhängigen Varianten ergänzen — Basketball dient hier als
lebendes Beispiel, es ist bereits vollständig eingetragen:

```json
{
  "name_basketball": "Basketball",
  "terminology": {
    "field_basketball_one": "Court",
    "field_basketball_other": "Courts",
    "goal_basketball_one": "Korb",
    "goal_basketball_other": "Körbe",
    "period_basketball_one": "Viertel",
    "period_basketball_other": "Viertel",
    "goalAnimationText_basketball": "KORB!"
  }
}
```

Regel: **jede** Sprachdatei braucht entweder eine eigene Kontextvariante
(`<basis>_<sportId>_one`/`_other`) oder es reicht der Rückfall auf den
Basisschlüssel (`<basis>_one`/`_other`, z. B. `match_one`/`match_other` — für
"Spiel"/"Spiele" gilt in jeder Sportart dasselbe Wort, also keine eigene
Variante nötig). i18next löst das über den `context`-Parameter in
`useSportTerms`/`useSportConfig` automatisch auf.

Nicht vergessen: Wenn eine Variante in **einer** Sprache ergänzt wird, muss sie
(oder der Rückfall) auch in **jeder anderen** registrierten Sprache
funktionieren — der Konformitätstest prüft das dynamisch gegen alle
Verzeichnisse unter `src/i18n/locales/`, nicht gegen eine feste Liste.

## Schritt 4: Konformitätstest laufen lassen

```bash
npx vitest run src/config/sports/__tests__/sportConformance.test.ts
```

Der Test prüft für **jede registrierte** Sportart automatisch:

1. **Keine unimplementierte Fähigkeit verlangt** — gegen
   `UNIMPLEMENTED_CAPABILITIES` in `capabilities.ts` (siehe nächster Abschnitt).
   Bei Verstoß nennt die Fehlermeldung explizit, welches Feld, welchen Wert, was
   fehlt und was zu tun ist (implementieren + Eintrag entfernen, oder Sportart
   nicht registrieren).
2. **Terminologie vollständig** — für jede Sprache unter `src/i18n/locales/`
   müssen die Begriffsfamilien, die `useSportConfig` tatsächlich auflöst (Feld,
   Tor, Periode, Spiel, Mannschaft), entweder eine eigene Kontextvariante oder
   einen funktionierenden Basis-Rückfall haben.
3. **Defaults innerhalb der Validierungsgrenzen** — `gameDuration` und
   `typicalFieldCount` müssen innerhalb der eigenen `validation`-Grenzen liegen.

Wird der Test rot, sagt er, was zu tun ist — nicht nur, dass etwas fehlt.

## Was heute nicht geht

`src/config/sports/capabilities.ts` (`UNIMPLEMENTED_CAPABILITIES`) ist die
maßgebliche, maschinenlesbare Liste der Felder, die `SportConfig` zwar anbietet,
die aber **von keinem Code ausgewertet werden** — dort steht zu jedem Feld
präzise, was fehlt und was zu bauen wäre, um es einzulösen. Diese Liste hier
abzuschreiben würde über die Zeit auseinanderlaufen; stattdessen: **die Datei ist
die Quelle der Wahrheit**, der Konformitätstest wertet sie automatisch aus.

Kurz zusammengefasst, die Kategorien (Details je Feld in `capabilities.ts`):

- **Satzbasierte Wertung** (`rules.isSetBased`, `features.isSetBased`,
  `rules.setsToWin`, `rules.pointsPerSet`, `rules.tiebreakPoints`) — z. B. für
  Volleyball. Es gibt keine Satzverwaltung in `LiveMatch`/
  `MatchExecutionService`/Tabellenberechnung. Eine Sportart, die das braucht,
  darf heute **nicht** registriert werden.
- **Abweichendes Score-Anzeigeformat** (`terminology.scoreFormat`) — die
  Score-Anzeige ist überall hart auf das Tore-Format ausgelegt.
- **Sportart-abhängiges Ein-/Ausblenden von UI-Features**
  (`features.hasDFBKeys`, `hasBambiniMode`, `hasRefereeAssignment`,
  `hasGoalAnimation`, `hasMatchTimer`, `hasPeriodTimer`) — diese Komponenten
  sind heute für jede Sportart gleich sichtbar/aktiv, unabhängig vom Flag.
- **Tiebreaker-Flags als eigenständiges Signal** (`rules.hasOvertime`,
  `rules.overtimeDuration`, `rules.hasShootout`) — das tatsächliche Verhalten
  kommt aus `rules.defaultTiebreaker`/`defaultTiebreakerDuration`, nicht aus
  diesen Feldern.
- **Doppelte Wahrheit für Unentschieden** (`defaults.allowDraw`) — Duplikat von
  `rules.canDrawInGroupPhase`, das tatsächlich ausgewertet wird (siehe
  `MatchExecutionService`).

Woran man es merkt, wenn man versucht, eine Sportart mit einer dieser
Fähigkeiten zu registrieren: **der Konformitätstest wird rot** und nennt Feld,
gesetzten Wert und was fehlt. Das ist beabsichtigt — lieber der Test meldet
sich, als dass die App beim Nutzer still falsch rechnet.
