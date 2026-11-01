# 🈯 Terminologie

### Eine Quelle, drei Konsumenten

`src/i18n/glossary.json` ist die **normative** Quelle für strittige Fachbegriffe
(z.B. "Strafstoßschießen" statt "Elfmeterschießen") und für Kürzel. Jeder Eintrag
hat `de`, `en`, `forbidden_de`, `reason`, `i18nKey`; optional `forbidden_en`,
`kuerzel`, `tsLint` und `short` (siehe „Kürzel und Kurzformen“). Das Schema steht im
Kopfkommentar der Datei.

```
glossary.json
  ├── ESLint-Regel (eslint-rules/no-hardcoded-sport-terms.cjs)
  │     verhindert verbotene Synonyme + hartkodierte Fachbegriffe in src/**/*.{ts,tsx}
  ├── scripts/check-terminology.cjs (npm run terms:check)
  │     prüft Schlüssel-Parität zwischen allen Sprachen, verbotene Synonyme
  │     in Locale-Werten, und dass jeder Glossar-Eintrag seinen Schlüssel hat
  └── src/i18n/locales/{de,en}/sport.json
        führt die Begriffe tatsächlich — der Wert an glossary.i18nKey muss
        dem Feld "de" (verbindlich) entsprechen
```

### Bei Unsicherheit über einen Fachbegriff

1. **`glossary.json` nachschlagen**, bevor ein Fachwort hartkodiert oder in
   eine Sprachdatei geschrieben wird.
2. **Kein neues Synonym erfinden.** Existiert der Begriff schon im Glossar,
   `t('sport:<i18nKey>')` verwenden. Existiert er nicht, FRAGEN (wie bei
   Design Tokens) — nicht kommentarlos ein neues Wort einführen.
3. In Sprachdateien darf ein Wert auf `sport.json` verweisen statt den
   Begriff zu wiederholen: `"$t(sport:events.penaltyShootout)"`.

### Kürzel und Kurzformen (@OB-075, @OB-076, Daniel 01.11.2026)

**Regel:** Begriffe stehen ausgeschrieben („Halbfinale 1“, „Schiedsrichter 2“, „Gruppe A“, „gegen“, „nach
Strafstoßschießen“, „10 Minuten“). Eine **Kurzform** gibt es nur, wenn das Glossar sie erlaubt (`short`), und nur an dem
einen Ort, den `short.context` nennt:

| `short.context` | Wo | Beispiele |
|---|---|---|
| `tabellenkopf` | Kopf einer Tabellenspalte | `#`, `Sp.`/`P`, `S U N`/`W D L`, `Diff.`/`GD`, `Pkt.`/`Pts`, `Nr.`/`No.` |
| `ergebniszelle` | Ergebniszelle | `n. V.`/`a.e.t.` (nach Strafstoßschießen steht „2:2 (4:3)“, keine Kurzform) |
| `uhr` | Uhr-Beschriftung, Monitor | `Min.`/`min` |

Wie es umgesetzt wird:
- Kurzformen stehen **nur** im Namensraum `short` (`src/i18n/locales/{de,en}/short.json`), nie als Literal im Code und nie in
  einem anderen Namensraum. Der Prüfer (`npm run terms:check`) meldet jedes Kürzel aus `forbidden_de` (nur in `de`) und
  `forbidden_en` (nur in `en`) in jedem Sprachwert außerhalb von `short`, und er verlangt, dass `short.json` genau den
  `short`-Einträgen des Glossars entspricht.
- Im Tabellenkopf nutzt man `<ShortLabel term="played" />` (`ui/atoms`): sichtbar die Kurzform, als `title` und für Screenreader
  der ausgeschriebene Begriff (`sport:tabelle.*`). In PDF-Köpfen: `translate('short:tabellenkopf.…')`. In Texten, die eine
  Kurzform tragen müssen (Monitor „~5 Min.“): Verschachtelung `$t(short:uhr.minutes)`.
- Mehrere Wörter in einem Text („Referee 2“, „Group A“, Paarungen) kommen aus der Sprachdatei, nicht aus dem Code
  (`t('tournament:refereeOptions.numbered', { number })`, `<Versus />`); Minuten mit Zählform:
  `$t(sport:zeit.minuteCount, {"count": {{minutes}} })` („1 Minute“, „5 Minuten“).
- Die ESLint-Regel meldet Kürzel in `.ts/.tsx`-Literalen (Kürzel-Begriffe sind groß-/kleinschreibungssensibel und lösen keine
  „preferred“-Warnung aus). Ausnahmen mit Begründung: `tsLint: false` (interne `matchId` „P3“), Vereinskürzel, Rechtstexte, Fixtures.
- Neues Kürzel verbieten: Eintrag mit `kuerzel: true`, `forbidden_de`/`forbidden_en`, `i18nKey` (ausgeschriebene Form in
  `sport.json`) und – falls eine Kurzform erlaubt sein soll – `short` samt Eintrag in `short.json` und `SHORT_TERMS`
  (`ui/atoms/shortTerms.ts`; der Gleichlauftest `kurzformen.test.ts` prüft es).

### Neue Sprache hinzufügen

`scripts/check-terminology.cjs` erkennt Sprachverzeichnisse und Namespaces
dynamisch aus `src/i18n/locales/` — eine neue Sprache wird automatisch
mitgeprüft (Schlüssel-Parität), ohne das Skript anzufassen. Nur `glossary.json`
selbst kennt ausschließlich `de`/`en` als normative Felder; eine dritte Sprache
braucht dafür keine Erweiterung des Glossars, nur vollständige Schlüssel in
ihrer eigenen `sport.json` und `short.json`. Verbotene Kürzel und Kurzformen der
neuen Sprache bräuchten zusätzliche Felder (`forbidden_<sprache>`, `short.<sprache>`).

### Die Umlaut/ß-Falle

JavaScripts `\b` behandelt `ß`, `ä`, `ö`, `ü` NICHT als Wortzeichen. Ein
naives `\bStrafstoß\b` matcht deshalb mitten in "Strafstoßschießen". Sowohl
die ESLint-Regel als auch `check-terminology.cjs` verwenden stattdessen ein
Lookaround-Muster mit einer Zeichenklasse, die deutsche Buchstaben einschließt
(`wordBoundaryRegex`). Bei jeder neuen Wort-basierten Prüfung diese Funktion
wiederverwenden, keine neue `\b`-Regex schreiben.

### Verankerung

`npm run terms:check` läuft: lokal im Pre-Commit-Hook (nur bei Änderungen an
`src/i18n/`), in der CI (`unit-tests`-Job, unabhängig vom Hook) und als Vitest
unter `src/i18n/__tests__/terminology.test.ts` (läuft mit `npm test`).
