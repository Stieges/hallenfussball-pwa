/**
 * Namensraum `hallenton` (H4-4, G10): DE und EN haben dieselben Schlüssel und Platzhalter, die Wortlaute der Records stehen
 * wörtlich da, und kein Hallenton-Text benutzt das Wort „Sound“ (nur dieser Namensraum: das Glossar verbietet es nicht global).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import en from '../../../../i18n/locales/en/hallenton.json';

type Baum = { [k: string]: string | Baum };
function flach(baum: Baum, pfad = ''): Record<string, string> {
  return Object.entries(baum).reduce<Record<string, string>>((acc, [k, v]) => {
    const schluessel = pfad === '' ? k : `${pfad}.${k}`;
    return typeof v === 'string' ? { ...acc, [schluessel]: v } : { ...acc, ...flach(v, schluessel) };
  }, {});
}
const D = flach(de);
const E = flach(en);
const platzhalter = (s: string): string[] => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('Namensraum hallenton', () => {
  it('DE und EN haben genau dieselben Schlüssel', () => {
    expect(Object.keys(E).sort()).toEqual(Object.keys(D).sort());
  });

  it('jeder Schlüssel hat in beiden Sprachen dieselben Platzhalter, und kein Wert ist leer', () => {
    for (const k of Object.keys(D)) {
      expect(D[k].trim(), `de ${k}`).not.toBe('');
      expect(E[k].trim(), `en ${k}`).not.toBe('');
      expect(platzhalter(E[k]), k).toEqual(platzhalter(D[k]));
    }
  });

  it('@HT-057 @HT-015 Platzhalter {{feld}} in beiden Sprachen', () => {
    for (const k of ['geraet.abgemeldet', 'geraet.uebernommen', 'feld.titel', 'statuszeile.bereit']) {
      expect(D[k], `de ${k}`).toContain('{{feld}}');
      expect(E[k], `en ${k}`).toContain('{{feld}}');
    }
  });

  it('@HT-057 @HT-015 Wortlaute der Records, wörtlich', () => {
    expect(D['geraet.abgemeldet']).toBe('Die Turnierleitung hat dieses Gerät als Hallen-Lautsprecher für Feld {{feld}} abgemeldet.');
    expect(D['geraet.uebernommen']).toBe('Feld {{feld}} von einem anderen Gerät übernommen');
  });

  it('@HT-039 @HT-045 @HT-047 Pillen und Gründe wörtlich (Deutsch)', () => {
    expect(D['statuszeile.bereit']).toBe('Lautsprecher Feld {{feld}} bereit');
    expect(D['statuszeile.nichtBereit']).toBe('Lautsprecher Feld {{feld}} nicht bereit');
    expect(D['statuszeile.statusUnbekannt']).toBe('Lautsprecher: Status unbekannt');
    expect(D['statuszeile.schlafenGelegt']).toBe('Lautsprecher schlafen gelegt');
    expect(D['statuszeile.pruefen']).toBe('Prüfen');
    expect(D['feld.zustand.nichtBereit']).toBe('nicht bereit – {{grund}}');
    expect(D['feld.zustand.meldetSichNicht']).toBe('meldet sich nicht (zuletzt {{zeit}})');
    expect(D['feld.grund.tonNichtAktiviert']).toBe('Ton nicht aktiviert');
    expect(D['feld.grund.hintergrund']).toBe('Hintergrund');
    expect(D['feld.grund.schlafenGelegt']).toBe('schlafen gelegt');
    expect(D['feld.grund.lautstaerkeNull']).toBe('Lautstärke 0 %');
    expect(D['feld.grund.ausgangVerloren']).toBe('Ausgang verloren');
    expect(D['feld.grund.ausgangBestaetigen']).toBe('Ausgang bestätigen');
    expect(D['cockpit.titel']).toBe('Hallen-Lautsprecher aus – Ende selbst anzeigen');
  });

  it('G7 Wortlaute je Quelle: eigenes Gerät, keine Verbindung, schlafen gelegt, Hupe statt eigener Ton', () => {
    expect(D['statuszeile.tonNichtAktiv']).toBe('Ton nicht aktiv – hier klicken');
    expect(D['statuszeile.nichtBereitKeineVerbindung']).toBe('Lautsprecher Feld {{feld}} nicht bereit – keine Verbindung');
    expect(D['statuszeile.hupeStattEigenerTon']).toBe('Hupe 1 statt eigener Ton');
  });

  it('zwei verschiedene „unbekannt“: Zustand unbekannt (grundlos) und Status unbekannt (Verwaltung ohne Netz) haben getrennte Schlüssel und Texte', () => {
    expect(D['feld.zustand.zustandUnbekannt']).toBe('nicht bereit');
    expect(D['feld.zustand.statusUnbekannt']).toBe('Status unbekannt');
    expect(D['feld.zustand.zustandUnbekannt']).not.toBe(D['feld.zustand.statusUnbekannt']);
    expect(D['feld.zustand.zustandUnbekannt']).not.toMatch(/unbekannt/i);
  });

  it('G10 kein Wort „Sound“ im Namensraum (Scan über alle Werte, beide Sprachen)', () => {
    for (const [k, v] of [...Object.entries(D), ...Object.entries(E)]) {
      expect(v, k).not.toMatch(/sound/i);
    }
  });

  it('der Namensraum ist registriert (Ressourcen, Namensliste, Typen)', () => {
    const wurzel = join(__dirname, '../../../../i18n');
    const index = readFileSync(join(wurzel, 'index.ts'), 'utf8');
    const typen = readFileSync(join(wurzel, 'types.ts'), 'utf8');
    expect(index).toContain("'hallenton',");
    expect(index).toContain("locales/de/hallenton.json");
    expect(index).toContain("locales/en/hallenton.json");
    expect(index).toMatch(/hallenton: deHallenton/);
    expect(index).toMatch(/hallenton: enHallenton/);
    expect(typen).toContain('hallenton: typeof deHallenton');
  });
});
