/**
 * Texte-Paket B (Usability-Prüfung): @OB-071, @OB-072, @DR-029 und der Platzhalter ohne Jahr (Nr. 13).
 * Geprüft wird der ausgelieferte Wortlaut der Übersetzungsdateien, nicht der Code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = join(__dirname, '..', 'locales');
type Json = string | { [key: string]: Json };

function load(lang: 'de' | 'en', file: string): Json {
  return JSON.parse(readFileSync(join(LOCALES, lang, file), 'utf8')) as Json;
}
function flatten(node: Json, prefix = ''): Array<[string, string]> {
  if (typeof node === 'string') { return [[prefix, node]]; }
  return Object.entries(node).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}
function pick(lang: 'de' | 'en', file: string, key: string): string {
  const hit = flatten(load(lang, file)).find(([k]) => k === key);
  if (!hit) { throw new Error(`Schlüssel fehlt: ${file} ${key}`); }
  return hit[1];
}

describe('@OB-071 Kein Hinweis schickt Olli zu einer Funktion, die es nicht gibt', () => {
  it.each(['de', 'en'] as const)('metadata.changeHint (%s) nennt weder Zurücksetzen noch den Gefahrenbereich als Weg', (lang) => {
    const text = pick(lang, 'admin.json', 'metadata.changeHint');
    expect(text).not.toMatch(/zurücksetzen|reset|danger zone|gefahrenbereich/i);
  });
});

describe('@OB-072 Die App spricht Olli durchgehend mit „du“ an', () => {
  const DRITTE_PERSON = /(^|[.!?] )Sie (bleiben|lassen|gehen)\b/g;
  const ANREDE = /\bSie\b|\bIhr(e[mnrs]?)?\b|\bIhnen\b/;

  it('keine deutsche Übersetzung enthält „Sie“, „Ihr…“ oder „Ihnen“ als Anrede', () => {
    const treffer: string[] = [];
    for (const file of readdirSync(join(LOCALES, 'de')).filter((f) => f.endsWith('.json'))) {
      for (const [key, value] of flatten(load('de', file))) {
        if (ANREDE.test(value.replace(DRITTE_PERSON, '$1'))) { treffer.push(`${file} ${key}`); }
      }
    }
    expect(treffer).toEqual([]);
  });

  it('Gegenbeispiel: „Sie bleiben auf diesem Gerät“ (Mehrzahl, dritte Person) bleibt erlaubt', () => {
    expect(ANREDE.test('Es warten Einträge. Sie bleiben auf diesem Gerät gespeichert.'.replace(DRITTE_PERSON, '$1'))).toBe(false);
    expect(ANREDE.test('Möchten Sie fortfahren?'.replace(DRITTE_PERSON, '$1'))).toBe(true);
  });

  it('die Warnung ohne Recht zum Korrigieren spricht mit „du“', () => {
    const quelle = readFileSync(join(__dirname, '..', '..', 'features', 'tournament-management', 'hooks', 'useCorrectionMode.ts'), 'utf8');
    expect(quelle).toContain('Du hast keine Berechtigung');
    expect(quelle).not.toMatch(/Sie haben keine/);
  });

  it('der Bereich mit Lösch- und Rücksetz-Aktionen heißt „Gefahrenbereich“, nirgends „Danger Zone“ oder „Kritische Aktionen“', () => {
    const admin = flatten(load('de', 'admin.json'));
    expect(pick('de', 'admin.json', 'dangerZone.title')).toBe('Gefahrenbereich');
    expect(pick('de', 'admin.json', 'sidebar.criticalActions')).toBe('Gefahrenbereich');
    expect(pick('de', 'admin.json', 'mobileHub.criticalActions')).toBe('Gefahrenbereich');
    expect(admin.filter(([, v]) => /danger zone|kritische aktionen/i.test(v))).toEqual([]);
    const konstanten = readFileSync(join(__dirname, '..', '..', 'features', 'tournament-admin', 'constants', 'admin.constants.ts'), 'utf8');
    expect(konstanten).toContain("label: 'Gefahrenbereich'");
    expect(konstanten).not.toContain("label: 'Kritische Aktionen'");
  });
});

describe('@DR-029 Unter „Exporte“ ist das Spielplan-PDF zu finden', () => {
  it.each([['de', 'Spielplan als PDF'], ['en', 'Schedule as PDF']] as const)('Abschnittstitel (%s)', (lang, titel) => {
    expect(pick(lang, 'admin.json', 'exports.summaryTitle')).toBe(titel);
  });
  it.each(['de', 'en'] as const)('die Beschreibung (%s) verspricht keine Statistiken, Tabellen oder Ergebnisse', (lang) => {
    expect(pick(lang, 'admin.json', 'exports.summaryDescription')).not.toMatch(/statisti|tabelle|table|ergebnis|result|bericht|report/i);
  });
});

describe('Nr. 13 Platzhalter ohne veraltetes Jahr', () => {
  it.each(['de', 'en'] as const)('Turniername-Platzhalter (%s) enthält keine Jahreszahl', (lang) => {
    expect(pick(lang, 'wizard.json', 'step3.tournamentNamePlaceholder')).not.toMatch(/\d{4}/);
  });
});
