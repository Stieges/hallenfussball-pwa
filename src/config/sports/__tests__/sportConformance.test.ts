/**
 * Sport Conformance Test
 *
 * Das ist das Schlussstück der Erweiterbarkeits-Struktur: Eine Sportart hinzufügen
 * kostet eine Konfigurationsdatei + einen Sprachblock (siehe
 * `docs/SPORTART-HINZUFUEGEN.md`) — und in dem Moment, in dem eine registrierte
 * Sportart etwas verlangt, das die App nicht einlösen kann, soll das HIER auffallen,
 * nicht erst live beim Nutzer.
 *
 * Läuft über jede Sportart in `sportRegistry` (heute football-indoor und
 * football-outdoor) und prüft drei Dinge:
 *
 *   (a) Keine registrierte Sportart verlangt eine Fähigkeit aus
 *       UNIMPLEMENTED_CAPABILITIES (siehe capabilities.ts).
 *   (b) Jede registrierte Sportart hat für jede Sprache (dynamisch aus
 *       src/i18n/locales/* ermittelt) die nötigen Begriffe — eigene Kontextvariante
 *       oder Rückfall auf den Basisschlüssel.
 *   (c) Die Voreinstellungen (defaults) liegen innerhalb der eigenen
 *       validation-Grenzen.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sportRegistry, UNIMPLEMENTED_CAPABILITIES, SportConfig } from '../index';

// =============================================================================
// (a) Keine registrierte Sportart verlangt eine unimplementierte Fähigkeit
// =============================================================================

/**
 * Liest ein Feld per Punkt-Pfad (z. B. "rules.isSetBased") aus einer SportConfig.
 */
function getByPath(config: SportConfig, fieldPath: string): unknown {
  return fieldPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, config);
}

/**
 * Für jedes Feld in UNIMPLEMENTED_CAPABILITIES: eine Prüfung, ob der konkrete Wert
 * einer SportConfig vom tatsächlichen (konstanten oder abgeleiteten) Verhalten der
 * App abweicht — d.h. ob die Sportart etwas verlangt/verspricht, das nicht
 * eingelöst wird.
 *
 * Die Referenz ist nicht "Feld ist truthy", sondern "was die App unabhängig vom
 * Feld tatsächlich tut" (siehe `missing`-Text je Eintrag in capabilities.ts):
 *
 *  - isSetBased-Familie: Die App wertet niemals satzbasiert aus — jeder Wert, der
 *    das verlangt (isSetBased: true, oder setsToWin/pointsPerSet/tiebreakPoints
 *    gesetzt), ist eine Abweichung.
 *  - terminology.scoreFormat: Die Score-Anzeige ist überall hart auf 'goals'
 *    ausgelegt — alles andere ist eine Abweichung.
 *  - hasDFBKeys/hasBambiniMode/hasRefereeAssignment/hasGoalAnimation/
 *    hasMatchTimer/hasPeriodTimer/hasShootout: Diese Komponenten/Optionen sind
 *    IMMER aktiv, unabhängig vom Flag — die App verhält sich, als wäre der Wert
 *    immer `true`. `false` ist damit die Abweichung (verspricht ein Ausblenden,
 *    das nie passiert).
 *  - hasOvertime/overtimeDuration: Das tatsächliche Verhalten kommt aus
 *    defaultTiebreaker/defaultTiebreakerDuration — eine Abweichung liegt vor,
 *    wenn diese "toten" Zweitfelder dem widersprechen.
 *  - defaults.allowDraw: Duplikat von rules.canDrawInGroupPhase (das seit Task 6
 *    tatsächlich ausgewertet wird) — eine Abweichung liegt vor, wenn beide Felder
 *    unterschiedliche Werte tragen (zwei Wahrheiten für dieselbe Frage).
 */
const violationChecks: Record<string, (config: SportConfig) => boolean> = {
  'rules.isSetBased': (c) => c.rules.isSetBased,
  'features.isSetBased': (c) => c.features.isSetBased,
  'rules.setsToWin': (c) => c.rules.setsToWin !== undefined,
  'rules.pointsPerSet': (c) => c.rules.pointsPerSet !== undefined,
  'rules.tiebreakPoints': (c) => c.rules.tiebreakPoints !== undefined,
  'terminology.scoreFormat': (c) => c.terminology.scoreFormat !== 'goals',
  'features.hasDFBKeys': (c) => !c.features.hasDFBKeys,
  'features.hasBambiniMode': (c) => !c.features.hasBambiniMode,
  'features.hasRefereeAssignment': (c) => !c.features.hasRefereeAssignment,
  'features.hasGoalAnimation': (c) => !c.features.hasGoalAnimation,
  'features.hasMatchTimer': (c) => !c.features.hasMatchTimer,
  'features.hasPeriodTimer': (c) => !c.features.hasPeriodTimer,
  'rules.hasShootout': (c) => !c.rules.hasShootout,
  'rules.hasOvertime': (c) => {
    const impliesOvertime =
      c.rules.defaultTiebreaker === 'overtime-then-shootout' ||
      c.rules.defaultTiebreaker === 'goldenGoal';
    return c.rules.hasOvertime !== impliesOvertime;
  },
  'rules.overtimeDuration': (c) =>
    c.rules.overtimeDuration !== undefined &&
    c.rules.overtimeDuration !== c.rules.defaultTiebreakerDuration,
  'defaults.allowDraw': (c) => c.defaults.allowDraw !== c.rules.canDrawInGroupPhase,
};

describe('Sport Conformance: keine unimplementierte Fähigkeit wird verlangt', () => {
  it('deckt jedes Feld aus UNIMPLEMENTED_CAPABILITIES mit einer Prüfung ab', () => {
    // Wächter gegen stillen Drift: Kommt ein neues Feld in capabilities.ts dazu,
    // ohne dass hier eine Prüfung ergänzt wird, fällt DAS zuerst auf — statt dass
    // das neue Feld unbemerkt ungeprüft bleibt.
    const checkedFields = Object.keys(violationChecks).sort();
    const declaredFields = UNIMPLEMENTED_CAPABILITIES.map((c) => c.field).sort();
    expect(checkedFields).toEqual(declaredFields);
  });

  for (const [sportId, config] of sportRegistry) {
    it(`${sportId} verlangt keine unimplementierte Fähigkeit`, () => {
      for (const capability of UNIMPLEMENTED_CAPABILITIES) {
        const check = violationChecks[capability.field];
        const isViolated = check(config);
        const actualValue = getByPath(config, capability.field);

        if (isViolated) {
          throw new Error(
            `\`${sportId}\` setzt \`${capability.field}: ${JSON.stringify(actualValue)}\`, ` +
              `aber ${capability.requires} ist nicht implementiert: ${capability.missing} ` +
              `Entweder implementieren (und den Eintrag aus UNIMPLEMENTED_CAPABILITIES ` +
              `entfernen) oder die Sportart nicht registrieren.`
          );
        }
      }
    });
  }
});

// =============================================================================
// (b) Jede registrierte Sportart hat für jede Sprache die nötigen Begriffe
// =============================================================================

/**
 * Flacht ein verschachteltes JSON-Objekt zu einer Menge von Punkt-Pfaden auf den
 * Blattwerten ab, z. B. { terminology: { field_one: "Feld" } } → "terminology.field_one".
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const LOCALES_DIR = path.join(__dirname, '..', '..', '..', 'i18n', 'locales');

/**
 * Ermittelt die Sprachverzeichnisse zur Laufzeit (nicht fest verdrahtet) — analog
 * zu scripts/check-design-token-sync.cjs, damit eine dritte Sprache automatisch
 * mitgeprüft wird, sobald ihr Verzeichnis existiert.
 */
function discoverLocales(): string[] {
  return fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function loadSportTerms(locale: string): Record<string, unknown> {
  const filePath = path.join(LOCALES_DIR, locale, 'sport.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('Sport Conformance: Terminologie-Abdeckung je Sprache', () => {
  const locales = discoverLocales();

  it('findet mindestens eine Sprache', () => {
    expect(locales.length).toBeGreaterThan(0);
  });

  it('hat für jede gefundene Sprache eine sport.json', () => {
    for (const locale of locales) {
      const filePath = path.join(LOCALES_DIR, locale, 'sport.json');
      expect(fs.existsSync(filePath), `${filePath} fehlt`).toBe(true);
    }
  });

  it('hat in jeder Sprache dieselben Basis-Schlüssel (Voraussetzung für den Rückfall)', () => {
    // Der Rückfall auf den Basisschlüssel (z.B. terminology.field_one) funktioniert
    // nur, wenn dieser Basisschlüssel in JEDER Sprache existiert — sonst bekommt
    // eine Sportart ohne eigene Kontextvariante in einer Sprache gar nichts.
    const keysByLocale = new Map<string, Set<string>>();
    for (const locale of locales) {
      keysByLocale.set(locale, new Set(flattenKeys(loadSportTerms(locale))));
    }

    const [referenceLocale, ...otherLocales] = locales;
    const referenceKeys = keysByLocale.get(referenceLocale)!;

    for (const locale of otherLocales) {
      const keys = keysByLocale.get(locale)!;
      const missingInLocale = [...referenceKeys].filter((k) => !keys.has(k));
      const missingInReference = [...keys].filter((k) => !referenceKeys.has(k));

      expect(
        missingInLocale,
        `sport.json (${locale}) fehlen Schlüssel aus ${referenceLocale}: ${missingInLocale.join(', ')}`
      ).toEqual([]);
      expect(
        missingInReference,
        `sport.json (${referenceLocale}) fehlen Schlüssel aus ${locale}: ${missingInReference.join(', ')}`
      ).toEqual([]);
    }
  });

  // Die Begriffsfamilien, die useSportConfig() tatsächlich über useSportTerms auflöst
  // (siehe getFieldName/getGoalName/getPeriodName/getMatchName/getTeamName in
  // useSportConfig.ts) — jede braucht mindestens die Basis-Pluralformen.
  const requiredTermFamilies = ['field', 'goal', 'period', 'match', 'team'];

  for (const [sportId] of sportRegistry) {
    it(`${sportId}: jede Sprache hat die Basis-Pluralformen für ${requiredTermFamilies.join(', ')}`, () => {
      for (const locale of locales) {
        const terms = loadSportTerms(locale) as {
          terminology?: Record<string, unknown>;
        };
        const terminology = terms.terminology ?? {};

        for (const family of requiredTermFamilies) {
          // Eigene Kontextvariante für diese Sportart ODER Rückfall auf Basisschlüssel.
          const hasOwnVariant =
            `${family}_${sportId}_one` in terminology && `${family}_${sportId}_other` in terminology;
          const hasFallback = `${family}_one` in terminology && `${family}_other` in terminology;

          expect(
            hasOwnVariant || hasFallback,
            `sport.json (${locale}) hat für "${sportId}" weder eine eigene Variante ` +
              `(${family}_${sportId}_one/_other) noch einen Basis-Rückfall (${family}_one/_other) ` +
              `für die Begriffsfamilie "${family}".`
          ).toBe(true);
        }
      }
    });
  }
});

// =============================================================================
// (c) Voreinstellungen liegen innerhalb der eigenen validation-Grenzen
// =============================================================================

describe('Sport Conformance: defaults liegen innerhalb der validation-Grenzen', () => {
  for (const [sportId, config] of sportRegistry) {
    it(`${sportId}: defaults.gameDuration liegt zwischen min-/maxGameDuration`, () => {
      const { defaults, validation } = config;
      expect(defaults.gameDuration).toBeGreaterThanOrEqual(validation.minGameDuration);
      expect(defaults.gameDuration).toBeLessThanOrEqual(validation.maxGameDuration);
    });

    it(`${sportId}: defaults.typicalFieldCount liegt zwischen min-/maxFields`, () => {
      const { defaults, validation } = config;
      expect(defaults.typicalFieldCount).toBeGreaterThanOrEqual(validation.minFields);
      expect(defaults.typicalFieldCount).toBeLessThanOrEqual(validation.maxFields);
    });

    it(`${sportId}: validation-Grenzen sind in sich konsistent (min <= max)`, () => {
      const { validation } = config;
      expect(validation.minTeams).toBeLessThanOrEqual(validation.maxTeams);
      expect(validation.minFields).toBeLessThanOrEqual(validation.maxFields);
      expect(validation.minGameDuration).toBeLessThanOrEqual(validation.maxGameDuration);
    });
  }
});
