/**
 * H4-9 @HT-026 Rücksprung nach der Anmeldung: „Dann meldet er sich dort an wie auf dem Rechner der Turnierleitung. Und danach öffnet sich
 * derselbe Unterpunkt ‚Hallenton‘“. Erwartung aus dem Gherkin; dazu die Gegenbeispiele: nichts Fremdes, nur einmal, ohne Merker die Startseite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RUECKKEHR_FRIST_MS, RUECKKEHR_SCHLUESSEL, holeRueckkehr, istRueckkehrZiel, merkeRueckkehr } from '../loginRueckkehr';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';

const HALLENTON = '/tournament/hallencup-nord/admin/hallenton';

const speicherBinden = (): void => {
  const speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
};

beforeEach(speicherBinden);

describe('@HT-026 Rücksprung in den Unterpunkt „Hallenton“', () => {
  it('die Adresse des Unterpunkts wird gemerkt und nach der Anmeldung zurückgegeben', () => {
    merkeRueckkehr(HALLENTON);
    expect(holeRueckkehr()).toBe(HALLENTON);
  });
  it('Gegenbeispiel: nur einmal – danach ist der Merker weg (Startseite)', () => {
    merkeRueckkehr(HALLENTON);
    expect(holeRueckkehr()).toBe(HALLENTON);
    expect(holeRueckkehr()).toBeNull();
    expect(window.localStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull();
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
    expect(window.localStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull();
    window.localStorage.setItem(RUECKKEHR_SCHLUESSEL, JSON.stringify({ pfad: '//evil.example/', bis: Date.now() + 60_000 }));
    expect(holeRueckkehr()).toBeNull();
    expect(window.localStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull(); // auch der falsche Merker ist gelöscht
  });
  it('Magic-Link in einem neuen Tab: der Merker liegt im gemeinsamen Speicher und gilt 15 Minuten, danach nicht mehr', () => {
    vi.useFakeTimers();
    try {
      merkeRueckkehr(HALLENTON);
      vi.advanceTimersByTime(RUECKKEHR_FRIST_MS - 1000);
      expect(holeRueckkehr()).toBe(HALLENTON);
      merkeRueckkehr(HALLENTON);
      vi.advanceTimersByTime(RUECKKEHR_FRIST_MS + 1000);
      expect(holeRueckkehr()).toBeNull();
      expect(window.localStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it('Gegenbeispiel: ein unlesbarer oder untergeschobener Merker ohne Frist wird nicht befolgt', () => {
    window.localStorage.setItem(RUECKKEHR_SCHLUESSEL, 'kein json');
    expect(holeRueckkehr()).toBeNull();
    window.localStorage.setItem(RUECKKEHR_SCHLUESSEL, JSON.stringify({ pfad: HALLENTON }));
    expect(holeRueckkehr()).toBeNull();
    window.localStorage.setItem(RUECKKEHR_SCHLUESSEL, JSON.stringify({ pfad: 'https://evil.example/', bis: Date.now() + 60_000 }));
    expect(holeRueckkehr()).toBeNull();
  });
});

describe('@OB-087 Zeile 3 Rückkehr ins Cockpit des Felds', () => {
  const COCKPIT = '/tournament/hallencup-nord/live';
  it('das Cockpit des Turniers (mit Feld und Spiel) wird gemerkt und nach der Anmeldung zurückgegeben', () => {
    for (const ziel of [COCKPIT, `${COCKPIT}?f=2`, `${COCKPIT}?matchId=m-11`, `${COCKPIT}?f=2&matchId=m-11`]) {
      merkeRueckkehr(ziel);
      expect(holeRueckkehr(), ziel).toBe(ziel);
    }
  });
  it('Gegenbeispiele: manipulierte oder fremde Ziele werden nicht gemerkt und nicht befolgt', () => {
    const schlecht = [
      `${COCKPIT}?next=https://evil.example`, `${COCKPIT}?f=2&next=/x`, `${COCKPIT}?f=abc`, `${COCKPIT}?f=2&f=3`, `${COCKPIT}?matchId=a/b`,
      `${COCKPIT}?matchId=`, `${COCKPIT}?f=2?x=1`, `${COCKPIT}?redirect=//evil.example`, `${COCKPIT}#/evil`, `${COCKPIT}/extra`,
      `//evil.example${COCKPIT}`, `https://evil.example${COCKPIT}`, `/tournament/hallencup-nord/schedule`, `/tournament/hallencup-nord/standings?f=2`,
      '/tournament/new', `/tournament/x/admin?f=2`, `${COCKPIT}\\..\\x`,
    ];
    for (const ziel of schlecht) {
      expect(istRueckkehrZiel(ziel), ziel).toBe(false);
      merkeRueckkehr(ziel);
      expect(window.localStorage.getItem(RUECKKEHR_SCHLUESSEL), ziel).toBeNull();
    }
  });
});

