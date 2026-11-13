/**
 * H4-9 @HT-026 Rücksprung nach der Anmeldung: „Dann meldet er sich dort an wie auf dem Rechner der Turnierleitung. Und danach öffnet sich
 * derselbe Unterpunkt ‚Hallenton‘“. Erwartung aus dem Gherkin; dazu die Gegenbeispiele: nichts Fremdes, nur einmal, ohne Merker die Startseite.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUECKKEHR_SCHLUESSEL, holeRueckkehr, istRueckkehrZiel, merkeRueckkehr } from '../loginRueckkehr';

const HALLENTON = '/tournament/hallencup-nord/admin/hallenton';

beforeEach(() => window.sessionStorage.clear());

describe('@HT-026 Rücksprung in den Unterpunkt „Hallenton“', () => {
  it('die Adresse des Unterpunkts wird gemerkt und nach der Anmeldung zurückgegeben', () => {
    merkeRueckkehr(HALLENTON);
    expect(holeRueckkehr()).toBe(HALLENTON);
  });
  it('Gegenbeispiel: nur einmal – danach ist der Merker weg (Startseite)', () => {
    merkeRueckkehr(HALLENTON);
    expect(holeRueckkehr()).toBe(HALLENTON);
    expect(holeRueckkehr()).toBeNull();
    expect(window.sessionStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull();
  });
  it('Gegenbeispiel: ohne Merker nichts (die Anmeldung führt wie bisher zur Startseite)', () => {
    expect(holeRueckkehr()).toBeNull();
  });
  it('auch andere Seiten des Admin-Centers, nicht aber fremde oder fremd aussehende Adressen', () => {
    expect(istRueckkehrZiel('/tournament/abc/admin')).toBe(true);
    expect(istRueckkehrZiel('/tournament/abc/admin/dashboard')).toBe(true);
    for (const schlecht of ['https://evil.example/tournament/abc/admin/hallenton', '//evil.example/tournament/abc/admin', '/login', '/', '/tournament/abc', '/live/ABC123', 'javascript:alert(1)', '/tournament/abc/admin\\..\\x', '']) {
      expect(istRueckkehrZiel(schlecht), schlecht).toBe(false);
    }
  });
  it('Gegenbeispiel: eine fremde Adresse wird nicht gemerkt, und ein untergeschobener Merker wird nicht befolgt', () => {
    merkeRueckkehr('https://evil.example/');
    expect(window.sessionStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull();
    window.sessionStorage.setItem(RUECKKEHR_SCHLUESSEL, '//evil.example/');
    expect(holeRueckkehr()).toBeNull();
    expect(window.sessionStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull(); // auch der falsche Merker ist gelöscht
  });
  it('App.tsx führt die Anmeldung zurück: onSuccess der Anmeldeseite fragt `holeRueckkehr()` und fällt auf „/“ zurück', () => {
    const quelle = readFileSync(join(__dirname, '../../../../App.tsx'), 'utf8');
    const stelle = quelle.slice(quelle.indexOf('<LoginScreen'));
    expect(stelle.slice(0, 400)).toContain("onSuccess={() => void navigate(holeRueckkehr() ?? '/')}");
  });
});
