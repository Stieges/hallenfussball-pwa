/**
 * Vier Regeln (Record „Im Einzelnen“) und die Kombinations-Tabelle @HT-033, Zeilen 1, 2, 3, 4, 7, 10 (dazu 11 und 12,
 * ebenfalls auf Logik-Ebene prüfbar); dazu @HT-009, @HT-011 und @HT-034 (Logik-Teil). Testskelett aus dem Gherkin.
 * Laptop = Rechner der Turnierleitung und Hallen-Lautsprecher; Handy = Toms Handy.
 * Leitet der Laptop das Feld selbst, plant er nach dem eigenen Cockpit, sonst nach dem Stand am Server (Regel 2).
 */
import { describe, expect, it } from 'vitest';
import { phaseViewOf } from '../../match/client/phaseView';
import { LEERES_GEDAECHTNIS, cockpitTonSchweigt, planeHallToene, type FeldStand } from '..';
import {
  ABSCHNITT_MS, COCKPIT, CTX_11, CTX_12, ENDE_A2, PAUSE_MS, T0, TAKT_VERSAETZE, ev, lauf, laufImTakt, server, stand, stateAus,
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

/** Eigenes Cockpit: das Ende von selbst steht sofort im eigenen Stand. */
function vomCockpit(jetzt: number): FeldStand {
  return jetzt < ENDE_A2 ? stand(laeuft11, CTX_11, COCKPIT, T0) : stand(beendet11, CTX_11, COCKPIT, ENDE_A2);
}

/** @HT-033 Zeile 7: Feld 1 nach Server (Spiel 11), Feld 2 nach eigenem Cockpit (Spiel 12 endet 0,5 s nach Spiel 11). */
function zeile7Felder(): (jetzt: number) => FeldStand[] {
  // Spiel 12 auf Feld 2 endet 0,5 s nach Spiel 11
  const start12 = ENDE_A2 + 500 - (2 * ABSCHNITT_MS + PAUSE_MS);
  const laeuft12 = stateAus(zweiterAbschnitt(start12), CTX_12);
  const ende12 = ENDE_A2 + 500;
  const beendet12 = stateAus([...zweiterAbschnitt(start12), ev('MATCH_END', ende12, 2, 2 * ABSCHNITT_MS)], CTX_12);
  return (jetzt: number): FeldStand[] => [
    vomServer(jetzt),
    jetzt < ende12 ? stand(laeuft12, CTX_12, COCKPIT, start12, 'feld-2') : stand(beendet12, CTX_12, COCKPIT, ende12, 'feld-2'),
  ];
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

  it('@HT-033 Zeile 2: Laptop leitet und ist Lautsprecher → einmal, nach eigenem Stand; Cockpit-Ton schweigt', () => {
    const { gespielt } = lauf((jetzt) => [vomCockpit(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
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

  it('@HT-033 Zeile 7: F1 leitet das Handy, F2 der Laptop, Laptop für beide → F1 nach Server, F2 nach eigenem Stand; gleichzeitig = ein Ton', () => {
    const felder = zeile7Felder();
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].felder).toEqual(['feld-1', 'feld-2']);
    expect(cockpitTonSchweigt('feld-2', ['feld-1', 'feld-2'])).toBe(true);
  });

  it('@HT-033 Zeile 10: Wechsel Handy → Laptop im Spiel → weiter genau ein Ton; Cockpit-Ton schweigt ab dem Wechsel', () => {
    const wechsel = ENDE_A2 - 2000;
    const felder = (jetzt: number) => [jetzt < wechsel ? vomServer(jetzt) : vomCockpit(jetzt)];
    const { gespielt } = lauf(felder, ENDE_A2 - 5000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(cockpitTonSchweigt('feld-1', ['feld-1'])).toBe(true);
  });

  it('@HT-033 Zeile 10: Wechsel genau während des Endes (Ton schon nach Server gespielt) → kein zweiter Ton nach eigenem Stand', () => {
    const wechsel = ENDE_A2 + 100;
    const felder = (jetzt: number) => [jetzt < wechsel ? vomServer(jetzt) : vomCockpit(jetzt)];
    expect(lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 6000).gespielt).toHaveLength(1);
  });

  it('@HT-033 Zeile 11: Laptop leitet selbst ohne Netz → einmal nach eigenem Stand, keine Warnung „Keine Verbindung“', () => {
    // Grenze des Tests: `eigenesCockpit` kennt kein Netz – fachlich gleich Zeile 2; geprüft wird, dass ohne Server keine Warnung kommt
    const { gespielt } = lauf((jetzt) => [vomCockpit(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    const plan = planeHallToene({ felder: [vomCockpit(ENDE_A2 - 1000)], serverNow: ENDE_A2 - 1000 }, LEERES_GEDAECHTNIS);
    expect(plan.warnungen).toEqual([]);
  });

  it('@HT-033 Zeile 12: Wechsel Laptop → Handy im Spiel → weiter genau ein Ton, ab dem Wechsel im Gleichtakt mit dem Monitor', () => {
    const wechsel = ENDE_A2 - 2000;
    const felder = (jetzt: number) => [jetzt < wechsel ? vomCockpit(jetzt) : vomServer(jetzt)];
    const { gespielt } = lauf(felder, ENDE_A2 - 5000, ENDE_A2 + 6000);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - cockpitGrenze)).toBeLessThanOrEqual(1000);
    expect(cockpitTonSchweigt('feld-1', [])).toBe(false);
  });
});

describe('@HT-033 Zeile 7 im 1-s-Takt des Einbaus', () => {
  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-033 Zeile 7, Versatz ${versatzMs} ms: F1 nach Server, F2 nach eigenem Stand, gleichzeitig = ein Ton`, () => {
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

  it('@HT-011 errechnetes Ende erreicht, letzte Antwort älter als 3 s → kein Ton, Warnung „keine Verbindung“', () => {
    const felder = (jetzt: number) => [stand(laeuft11, CTX_11, server(jetzt - verlorenUm), T0)];
    expect(lauf(felder, ENDE_A2 - 2000, ENDE_A2 + 10_000).gespielt).toEqual([]);
    const plan = planeHallToene({ felder: felder(ENDE_A2), serverNow: ENDE_A2 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toEqual([]);
    expect(plan.warnungen).toEqual([{ feldId: 'feld-1', grund: 'keineVerbindung' }]);
  });

  it('@HT-011 Gegenprobe: letzte Antwort genau 3 s alt → der Ton kommt', () => {
    const plan = planeHallToene({ felder: [stand(laeuft11, CTX_11, server(3000), T0)], serverNow: ENDE_A2 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toHaveLength(1);
    expect(plan.warnungen).toEqual([]);
  });

  it('@HT-011 ein vorab geplanter Ton nennt, ab wann die letzte Antwort spätestens stammen muss (3 s vor dem Ton)', () => {
    const plan = planeHallToene({ felder: [stand(laeuft11, CTX_11, server(0), T0)], serverNow: ENDE_A2 - 60_000 }, LEERES_GEDAECHTNIS);
    expect(plan.toene[0].antwortNoetigAb).toBe(plan.toene[0].at - 3000);
    const eigen = planeHallToene({ felder: [stand(laeuft11, CTX_11, COCKPIT, T0)], serverNow: ENDE_A2 - 60_000 }, LEERES_GEDAECHTNIS);
    expect(eigen.toene[0].antwortNoetigAb).toBeNull();
  });
});
