# 🈯 Terminologie

### Eine Quelle, drei Konsumenten

`src/i18n/glossary.json` ist die **normative** Quelle für strittige deutsche
Fachbegriffe (z.B. "Strafstoßschießen" statt "Elfmeterschießen"). Jeder Eintrag
hat `de`, `en`, `forbidden_de`, `reason`, `i18nKey`.

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

### Neue Sprache hinzufügen

`scripts/check-terminology.cjs` erkennt Sprachverzeichnisse und Namespaces
dynamisch aus `src/i18n/locales/` — eine neue Sprache wird automatisch
mitgeprüft (Schlüssel-Parität), ohne das Skript anzufassen. Nur `glossary.json`
selbst kennt ausschließlich `de`/`en` als normative Felder; eine dritte Sprache
braucht dafür keine Erweiterung des Glossars, nur vollständige Schlüssel in
ihrer eigenen `sport.json`.

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
