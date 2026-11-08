/**
 * Vier Regeln (Record „Im Einzelnen“) und die Kombinations-Tabelle @HT-033, Zeilen 1, 2, 3, 4, 7, 10, 11, 12 auf Logik-Ebene;
 * dazu @HT-009, @HT-011 und @HT-034 (Logik-Teil). Testskelett aus dem Gherkin.
 * Laptop = Rechner der Turnierleitung und Hallen-Lautsprecher; Handy = Toms Handy.
 * Regel 2 seit 07.11. („Hupe und Anzeige sagen dasselbe“): Der Lautsprecher plant immer nach dem Stand am Server wie der
 * Monitor, auch wenn der Laptop das Feld selbst leitet. Wer leitet, ändert am Stand nichts – die Ereignisse des leitenden
 * Geräts kommen über den Server an.
 * `bekanntSeit` über den Wechsel (Zeilen 10, 12) ist hier Eingabe und wird deshalb im Feldstand geprüft, der es bildet
 * (`feldStand.quelle.test.ts`, Zeilen 10 und 12; Nachschärfung H3c, N-1 aus H3b-4) – hier zählen Ton und Zeitpunkt.
 */
import { describe, expect, it } from 'vitest';
import { phaseViewOf } from '../../match/client/phaseView';
import { LEERES_GEDAECHTNIS, cockpitTonSchweigt, planeHallToene, type FeldStand } from '..';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A2, PAUSE_MS, T0, TAKT_VERSAETZE, ev, lauf, laufImTakt, server, stand, stateAus,
  zweiterAbschnitt,
} from './hallentonFixtures';

const LAUFZEIT_MS = 300;
const log11 = zweiterAbschnitt();
const ende11 = [...log11, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)];
const laeuft11 = stateAus(log11);
const beendet11 = stateAus(ende11);

/** Stand am Server: bis zur Ankunft der Nachricht läuft das Spiel, danach ist es beendet. */
function vomServer(jetzt: number, alterMs = 0): FeldStand {
  return jetzt < ENDE_A2 + LAUFZEIT_MS
    ? stand(laeuft11, CTX_11, server(alterMs), T0)
    : stand(beendet11, CTX_11, server(alterMs), ENDE_A2 + LAUFZEIT_MS);
}

/** @HT-033 Zeile 7: Feld 1 leitet das Handy (Spiel 11), Feld 2 der Laptop (Spiel 12 endet 0,5 s nach Spiel 11) – beide am Server. */
function zeile7Felder(): (jetzt: number) => FeldStand[] {
  const start12 = ENDE_A2 + 500 - (2 * ABSCHNITT_MS + PAUSE_MS);
  const laeuft12 = stateAus(zweiterAbschnitt(start12), CTX_12);
  const ende12 = ENDE_A2 + 500;
  const beendet12 = stateAus([...zweiterAbschnitt(start12), ev('MATCH_END', ende12, 2, 2 * ABSCHNITT_MS)], CTX_12);
  return (jetzt: number): FeldStand[] => [
    vomServer(jetzt),
    jetzt < ende12 + LAUFZEIT_MS
      ? stand(laeuft12, CTX_12, server(0), start12, 'feld-2')
      : stand(beendet12, CTX_12, server(0), ende12 + LAUFZEIT_MS, 'feld-2'),
  ];
}

/** Antworten je volle Sekunde; ab dem Wechsel 1,5 s keine (neue Abfrage nach der Übernahme), danach wieder je Sekunde. */
function wechselAlter(jetzt: number, wechsel: number): number {
  const takt = (t: number): number => t - Math.floor(t / 1000) * 1000;
  if (jetzt >= wechsel && jetzt < wechsel + 1500) {
    return jetzt - Math.floor(wechsel / 1000) * 1000;
  }
  return takt(jetzt);
}

const cockpitGrenze = phaseViewOf(laeuft11, CTX_11, ENDE_A2 - 10_000).limitAt ?? 0;

describe('@HT-033 Die vier Regeln entscheiden jede Kombination aus leitendem Gerät und Hallen-Lautsprecher', () => {
  it('@HT-033 Zeile 1: Handy leitet, Laptop ist Lautsprecher → Laptop im Gleichtakt mit dem Monitor, Handy piept', () => {
    const { gespielt } = lauf((jetzt) => [vomServer(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - cockpitGrenze)).toBeLessThanOrEqual(1000);
    // Handy ist kein Lautsprecher: dort gilt die Einstellung des Geräts
    expect(cockpitTonSchweigt('feld-1', [])).toBe(false);
  });

  it('@HT-033 Zeile 2: Laptop leitet und ist Lautsprecher → Laptop, einmal, nach dem Stand am Server wie der Monitor; Cockpit-Ton schweigt', () => {
    const { gespielt } = lauf((jetzt) => [vomServer(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - cockpitGrenze)).toBeLessThanOrEqual(1000);
    expect(cockpitTonSchweigt('feld-1', ['feld-1'])).toBe(true);
  });

  it('@HT-033 Zeile 3 / @HT-034: Handy ohne Netz hält kurz vor Schluss an → Laptop bei 00:00 wie der Monitor, nach Rückkehr des Netzes kein zweiter Abpfiff-Ton', () => {
    // Toms Handy hat 20 s vor dem Ende kein Netz mehr und hält 10 s vor dem Ende an; am Server läuft die Uhr weiter
    const halt = ENDE_A2 - 10_000;
    const netzZurueck = ENDE_A2 + 40_000;
    const weiter = netzZurueck + 5_000;
    const angehalten = [...log11, ev('PAUSE', halt, 2, null)];
    const nachgereicht = [...angehalten, ev('RESUME', weiter, 2, null)];
    const eigenesEnde = weiter + 10_000;
    const beendetNachEigenemStand = [...nachgereicht, ev('MATCH_END', eigenesEnde, 2, 2 * ABSCHNITT_MS)];
    const felder = (jetzt: number): FeldStand[] => {
      if (jetzt < netzZurueck) {
        return [stand(laeuft11, CTX_11, server(0), T0)];
      }
      if (jetzt < weiter + LAUFZEIT_MS) {
        return [stand(stateAus(angehalten), CTX_11, server(0), netzZurueck)];
      }
      if (jetzt < eigenesEnde + LAUFZEIT_MS) {
        return [stand(stateAus(nachgereicht), CTX_11, server(0), weiter + LAUFZEIT_MS)];
      }
      return [stand(stateAus(beendetNachEigenemStand), CTX_11, server(0), eigenesEnde + LAUFZEIT_MS)];
    };
    const { gespielt } = lauf(felder, ENDE_A2 - 20_000, eigenesEnde + 10_000, 100);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
  });

  it('@HT-033 Zeile 4: Laptop ohne Netz → kein Ton nach altem Stand, Warnung; Handy piept', () => {
    const verlorenUm = ENDE_A2 - 30_000;
    const felder = (jetzt: number) => [stand(laeuft11, CTX_11, server(jetzt - verlorenUm), T0)];
    expect(lauf(felder, ENDE_A2 - 5000, ENDE_A2 + 10_000).gespielt).toEqual([]);
    const plan = planeHallToene({ felder: felder(ENDE_A2), serverNow: ENDE_A2 }, LEERES_GEDAECHTNIS);
    expect(plan.warnungen).toEqual([{ feldId: 'feld-1', grund: 'keineVerbindung' }]);
    expect(cockpitTonSchweigt('feld-1', [])).toBe(false);
  });

  it('@HT-033 Zeile 7: F1 Handy, F2 Laptop, Laptop für beide → beide nach dem Stand am Server; gleichzeitig = ein Ton; Laptop-Cockpit F2 schweigt', () => {
    const felder = zeile7Felder();
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].felder).toEqual(['feld-1', 'feld-2']);
    expect(cockpitTonSchweigt('feld-2', ['feld-1', 'feld-2'])).toBe(true);
  });

  it('@HT-033 Zeile 10: Wechsel Handy → Laptop im Spiel → weiter genau ein Ton; Cockpit-Ton schweigt ab dem Wechsel', () => {
    // bis zum Wechsel (2 s vor dem Ende) Antworten je Sekunde mit Toms Stand; beim Wechsel setzen die Antworten 1,5 s aus
    // (neue Abfrage nach der Übernahme), danach liefert der Server denselben Stand mit den Einträgen des Laptops
    const wechsel = ENDE_A2 - 2000;
    const felder = (jetzt: number): FeldStand[] => [vomServer(jetzt, wechselAlter(jetzt, wechsel))];
    const { gespielt } = lauf(felder, ENDE_A2 - 5000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - cockpitGrenze)).toBeLessThanOrEqual(1000);
    expect(cockpitTonSchweigt('feld-1', ['feld-1'])).toBe(true); // der Laptop ist Lautsprecher
  });

  it('Gegenbeispiel (früher Zeile 10): Wechsel genau während des Endes → kein Doppelton', () => {
    // vor und nach dem Wechsel derselbe Stand am Server; nur das Alter der Antwort springt (neue Abfrage nach dem Wechsel)
    const wechsel = ENDE_A2 + 100;
    const felder = (jetzt: number): FeldStand[] => [vomServer(jetzt, jetzt < wechsel ? 200 : 0)];
    expect(lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 6000).gespielt).toHaveLength(1);
  });

  it('@HT-033 Zeile 11: Laptop leitet ohne Netz → kein Hallenton nach unsicherem Stand; Warnung wie Zeile 4', () => {
    // der Laptop pfeift ohne Netz an und leitet den zweiten Abschnitt; der Server kennt nur den Stand vor dem Netzverlust
    const verlorenUm = ENDE_A2 - 30_000;
    const felder = (jetzt: number) => [stand(laeuft11, CTX_11, server(jetzt - verlorenUm), T0)];
    expect(lauf(felder, ENDE_A2 - 5000, ENDE_A2 + 10_000).gespielt).toEqual([]);
    const plan = planeHallToene({ felder: felder(ENDE_A2), serverNow: ENDE_A2 }, LEERES_GEDAECHTNIS);
    expect(plan.warnungen).toEqual([{ feldId: 'feld-1', grund: 'keineVerbindung' }]);
    // Regel 3: der Lautsprecher ist nicht bereit (keine Verbindung) → das Cockpit am Laptop tönt
    expect(cockpitTonSchweigt('feld-1', [])).toBe(false);
  });

  it('@HT-033 Zeile 12: Wechsel Laptop → Handy im Spiel → weiter genau ein Ton, im Gleichtakt mit dem Monitor', () => {
    // Toms Handy übernimmt 3 s vor dem Ende; die Antworten setzen 1,5 s aus, der Stand am Server bleibt derselbe
    const wechsel = ENDE_A2 - 3000;
    const felder = (jetzt: number): FeldStand[] => [vomServer(jetzt, wechselAlter(jetzt, wechsel))];
    const { gespielt } = lauf(felder, ENDE_A2 - 5000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - cockpitGrenze)).toBeLessThanOrEqual(1000);
  });

  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-033 Zeilen 10 und 12, Versatz ${versatzMs} ms: Wechsel 2 s vor dem Ende mit Lücke in den Antworten → genau ein Ton`, () => {
      const wechsel = ENDE_A2 - 2000;
      expect(laufImTakt((jetzt) => [vomServer(jetzt, wechselAlter(jetzt, wechsel))], ENDE_A2 - 5000, ENDE_A2 + 6000, { versatzMs })).toHaveLength(1);
    });
  }
});

describe('@HT-033 Zeile 7 im 1-s-Takt des Einbaus', () => {
  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-033 Zeile 7, Versatz ${versatzMs} ms: beide nach dem Stand am Server, gleichzeitig = ein Ton`, () => {
      expect(laufImTakt(zeile7Felder(), ENDE_A2 - 3000, ENDE_A2 + 6000, { versatzMs })).toHaveLength(1);
    });
  }
});

describe('Regel 3: Cockpit-Ton schweigt am Lautsprecher', () => {
  it('auf dem Lautsprecher-Gerät schweigt der Cockpit-Ton nur für seine Felder, überall sonst gilt die Einstellung des Geräts', () => {
    expect(cockpitTonSchweigt('feld-1', ['feld-1', 'feld-2'])).toBe(true);
    expect(cockpitTonSchweigt('feld-3', ['feld-1', 'feld-2'])).toBe(false);
    expect(cockpitTonSchweigt('feld-1', [])).toBe(false);
  });
});

describe('@HT-009 Der Hallenton hängt nicht am Ton im Cockpit', () => {
  it('@HT-009 Tom hat den Abpfiff-Ton am Handy aus: am Handy kein Ton (Einstellung gilt), am Hallen-Lautsprecher einmal der Abpfiff-Ton', () => {
    // Toms Handy ist kein Lautsprecher → seine Einstellung „aus“ gilt; der Planer kennt diese Einstellung gar nicht
    expect(cockpitTonSchweigt('feld-1', [])).toBe(false);
    const { gespielt } = lauf((jetzt) => [vomServer(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 6000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
  });
});

describe('@HT-011 Ohne Verbindung warnt der Lautsprecher und tönt nicht nach veraltetem Stand', () => {
  const verlorenUm = ENDE_A2 - 30_000;

  it('@HT-011 errechnetes Ende erreicht, letzte Antwort älter als 5 s → kein Ton, Warnung „keine Verbindung“', () => {
    const felder = (jetzt: number) => [stand(laeuft11, CTX_11, server(jetzt - verlorenUm), T0)];
    expect(lauf(felder, ENDE_A2 - 2000, ENDE_A2 + 10_000).gespielt).toEqual([]);
    const plan = planeHallToene({ felder: felder(ENDE_A2), serverNow: ENDE_A2 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toEqual([]);
    expect(plan.warnungen).toEqual([{ feldId: 'feld-1', grund: 'keineVerbindung' }]);
  });

  it('@HT-011 letzte Antwort 4,9 s alt → der Ton kommt, keine Warnung', () => {
    const plan = planeHallToene({ felder: [stand(laeuft11, CTX_11, server(4900), T0)], serverNow: ENDE_A2 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toHaveLength(1);
    expect(plan.warnungen).toEqual([]);
  });

  it('@HT-011 letzte Antwort 5,1 s alt → kein Ton, Warnung „keine Verbindung“', () => {
    const plan = planeHallToene({ felder: [stand(laeuft11, CTX_11, server(5100), T0)], serverNow: ENDE_A2 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toEqual([]);
    expect(plan.warnungen).toEqual([{ feldId: 'feld-1', grund: 'keineVerbindung' }]);
  });

  it('@HT-011 ein vorab geplanter Ton nennt, ab wann die letzte Antwort spätestens stammen muss (5 s vor dem Ton)', () => {
    const plan = planeHallToene({ felder: [stand(laeuft11, CTX_11, server(0), T0)], serverNow: ENDE_A2 - 60_000 }, LEERES_GEDAECHTNIS);
    expect(plan.toene[0].antwortNoetigAb).toBe(plan.toene[0].at - 5000);
  });
});
