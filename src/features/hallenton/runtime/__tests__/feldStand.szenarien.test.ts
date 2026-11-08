/**
 * H3b-2a Feldstand: Szenarien aus `docs/anforderungen/2026-10-15_hallenton.md` (Gherkin-Wortlaut) – @HT-004, @HT-005,
 * @HT-006, @HT-007, @HT-010, @HT-011, @HT-034, @HT-051. Spiel 11 auf Feld 1 (2 × 6 min, Kern-Fixtures), Tom leitet es auf
 * seinem Handy, der Rechner der Turnierleitung ist Hallen-Lautsprecher. Probe mit dem echten Planer (`planeHallToene`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phaseViewOf } from '../../../../core/match/client/phaseView';
import {
  ABSCHNITT_MS, CTX_11, ENDE_A1, ENDE_A2, T0, TAKT_VERSAETZE, anpfiff, ev, stateAus, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { Lage, probe } from './feldStandTestlage';

const laufend = { match_status: 'running' };

function lageImZweitenAbschnitt(start: number): Lage {
  const lage = new Lage({ start });
  lage.setzeSpiel(CTX_11.matchId, laufend);
  lage.sende(CTX_11, zweiterAbschnitt());
  return lage;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('@HT-004 Der Hallenton liegt höchstens etwa 1 Sekunde neben dem Cockpit-Ton', () => {
  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-004 Versatz ${versatzMs} ms: Toms Handy hat Netz → genau ein Abpfiff-Ton, höchstens 1 s neben Toms Cockpit und der 00:00 am Monitor`, async () => {
      const lage = lageImZweitenAbschnitt(ENDE_A2 - 20_000);
      const cockpitEnde = phaseViewOf(stateAus(zweiterAbschnitt()), CTX_11, ENDE_A2 - 20_000).limitAt ?? 0;
      const { gespielt } = await probe(lage, ENDE_A2 + 6000, [], versatzMs);
      expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
      expect(cockpitEnde).toBe(ENDE_A2);
      expect(Math.abs(gespielt[0].at - cockpitEnde)).toBeLessThanOrEqual(1000);
    });
  }
});

describe('@HT-005 Angehaltene Uhr kurz vor Schluss verschiebt den Hallenton mit', () => {
  // Spiel 11 steht im zweiten Abschnitt bei 5:50; Tom hält die Uhr bei 5:52 für 20 Sekunden an
  const bei552 = ENDE_A2 - 8000;
  const pause = ev('PAUSE', bei552, 2, null);
  const weiter = ev('RESUME', bei552 + 20_000, 2, null);
  const cockpitEnde = phaseViewOf(stateAus([...zweiterAbschnitt(), pause, weiter]), CTX_11, bei552 + 20_000).limitAt ?? 0;

  async function lauf(versatzMs = 0) {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 10_000);
    const beobachtet: { status?: string; abfragenWaehrendPause: number } = { abfragenWaehrendPause: 0 };
    let zuBeginn = 0;
    const ergebnis = await probe(lage, cockpitEnde + 6000, [
      { um: bei552, tu: () => lage.sende(CTX_11, [pause]) },
      { um: bei552 + 1500, tu: () => { beobachtet.status = lage.stand()?.state.status; zuBeginn = lage.sb.abfragenAuf('match_events').length; } },
      { um: bei552 + 19_500, tu: () => { beobachtet.abfragenWaehrendPause = lage.sb.abfragenAuf('match_events').length - zuBeginn; } },
      { um: bei552 + 20_000, tu: () => lage.sende(CTX_11, [weiter]) },
    ], versatzMs);
    return { ...ergebnis, beobachtet };
  }

  it('@HT-005 der Stand übernimmt das Anhalten: nach höchstens 1 s steht die Uhr auch am Lautsprecher', async () => {
    const { beobachtet } = await lauf();
    expect(beobachtet.status).toBe('paused');
  });

  it('@HT-005 während der angehaltenen 20 Sekunden ertönt kein Ton', async () => {
    const { gespielt } = await lauf();
    expect(gespielt.filter((t) => t.at >= bei552 && t.at <= bei552 + 20_000)).toEqual([]);
  });

  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-005 Versatz ${versatzMs} ms: der Abpfiff-Ton ertönt höchstens 1 s vor oder nach dem Abpfiff-Ton in Toms Cockpit`, async () => {
      const { gespielt } = await lauf(versatzMs);
      expect(cockpitEnde).toBe(ENDE_A2 + 20_000);
      expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
      expect(Math.abs(gespielt[0].at - cockpitEnde)).toBeLessThanOrEqual(1000);
    });
  }

  it('@HT-005 enger Takt: während die Uhr angehalten ist, fragt der Lautsprecher jede Sekunde nach', async () => {
    const { beobachtet } = await lauf();
    // 18 s zwischen den beiden Beobachtungen → mindestens 17 Sammelabfragen im 1-s-Takt (5-s-Takt ergäbe höchstens 4)
    expect(beobachtet.abfragenWaehrendPause).toBeGreaterThanOrEqual(17);
  });
});

describe('@HT-006 Eine korrigierte Uhr verschiebt den Hallenton', () => {
  // Spiel 11 steht im zweiten Abschnitt bei 4:30, Tom korrigiert auf 4:00
  const bei430 = ENDE_A2 - 90_000;
  const korrektur = ev('CLOCK_ADJUST', bei430, 2, ABSCHNITT_MS + 240_000);
  const cockpitEnde = phaseViewOf(stateAus([...zweiterAbschnitt(), korrektur]), CTX_11, bei430).limitAt ?? 0;

  it('@HT-006 der Abpfiff-Ton ertönt erst, wenn die korrigierte Spielzeit abläuft, und höchstens 1 s neben Toms Cockpit', async () => {
    const lage = lageImZweitenAbschnitt(bei430 - 5000);
    const { gespielt } = await probe(lage, cockpitEnde + 5000, [{ um: bei430, tu: () => lage.sende(CTX_11, [korrektur]) }], 300);
    expect(cockpitEnde).toBe(ENDE_A2 + 30_000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - cockpitEnde)).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-007 Endet ein Abschnitt früher von Hand, ertönt kein zweiter Ton zur alten Zeit', () => {
  // Spiel 11 steht im ersten Abschnitt bei 5:40; Tom wählt „Halbzeit“ und bestätigt (am Server sofort bekannt)
  const bestaetigt = T0 + 340_000;
  const halbzeit = ev('SECTION_END', bestaetigt, 1, 340_000);

  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-007 Versatz ${versatzMs} ms: Halbzeit-Ton höchstens 1 s nach Toms Bestätigung, bei 6:00 kein weiterer Ton`, async () => {
      const lage = new Lage({ start: T0 + 330_000 });
      lage.setzeSpiel(CTX_11.matchId, laufend);
      lage.sende(CTX_11, anpfiff());
      const { gespielt } = await probe(lage, ENDE_A1 + 10_000, [{ um: bestaetigt, tu: () => lage.sende(CTX_11, [halbzeit]) }], versatzMs);
      expect(gespielt.map((t) => t.art)).toEqual(['halbzeit']);
      expect(gespielt[0].at - bestaetigt).toBeGreaterThanOrEqual(0);
      expect(gespielt[0].at - bestaetigt).toBeLessThanOrEqual(1000);
    });
  }

  it('@HT-007 der nächste Takt kommt höchstens 1 s später, und das Ende steht dann im Stand', async () => {
    const lage = new Lage({ start: T0 + 330_000 });
    lage.setzeSpiel(CTX_11.matchId, laufend);
    lage.sende(CTX_11, anpfiff());
    await lage.runde();
    expect(lage.fs.naechsterAbfrageTaktMs()).toBe(1000);
    lage.vor(bestaetigt - lage.uhr.jetzt());
    lage.sende(CTX_11, [halbzeit]);
    await lage.runde(); // noch keine 1 s seit der letzten Abfrage: nichts Neues
    lage.vor(1000);
    await lage.runde();
    expect(lage.stand()?.state.status).toBe('section_break');
    expect(lage.stand()?.state.breakStartedAt).toBe(bestaetigt);
  });
});

describe('@HT-010 Eine falsch gehende Uhr am Lautsprecher-Gerät verschiebt den Ton nicht', () => {
  it('@HT-010 die Uhr des Rechners geht 20 Sekunden vor: Abpfiff-Ton höchstens 1 s neben Toms Cockpit, alle Zeiten in Serverzeit', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 20_000);
    vi.spyOn(Date, 'now').mockImplementation(() => lage.uhr.jetzt() + 20_000);
    const { gespielt } = await probe(lage, ENDE_A2 + 6000, [], 300);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    const jetzt = lage.uhr.jetzt();
    expect(lage.fs.letzteAntwortAt()).toBeLessThanOrEqual(jetzt);
    expect(lage.fs.letzteAntwortAt()).toBeGreaterThan(jetzt - 2000);
    expect(lage.stand()?.bekanntSeit).toBeLessThanOrEqual(jetzt);
  });
});

describe('@HT-011 Ohne Verbindung warnt der Lautsprecher und tönt nicht nach veraltetem Stand', () => {
  // der Rechner verliert um 14:02, 30 Sekunden vor dem Ende, die Verbindung
  async function lauf() {
    const verloren = ENDE_A2 - 30_000;
    const lage = lageImZweitenAbschnitt(verloren);
    await lage.runde();
    lage.sb.netz = 'fehler';
    const vorher = lage.sb.abfragenAuf('match_events').length;
    const alter: number[] = [];
    const ergebnis = await probe(lage, ENDE_A2 + 6000, [
      { um: ENDE_A2 - 10_000, tu: () => { alter.push(lage.stand()?.antwortAlterMs ?? -1); } },
      { um: ENDE_A2, tu: () => { alter.push(lage.stand()?.antwortAlterMs ?? -1); } },
    ]);
    return { ...ergebnis, lage, verloren, alter, versuche: lage.sb.abfragenAuf('match_events').length - vorher };
  }

  it('@HT-011 wenn das errechnete Ende erreicht ist und die letzte Antwort älter als 5 s ist, ertönt kein Ton', async () => {
    const { gespielt, plaene } = await lauf();
    expect(gespielt).toEqual([]);
    expect(plaene[plaene.length - 1].warnungen).toEqual([{ feldId: 'field-1', grund: 'keineVerbindung' }]);
  });

  it('@HT-011 letzteAntwortAt bleibt stehen, antwortAlterMs wächst', async () => {
    const { lage, verloren, alter } = await lauf();
    expect(lage.fs.letzteAntwortAt()).toBe(verloren);
    expect(alter).toEqual([20_000, 30_000]);
  });

  it('@HT-011 ohne Antwort fragt der Lautsprecher eng nach (N-2), damit er nach der Rückkehr des Netzes schnell wieder tönt', async () => {
    const { versuche } = await lauf();
    // 36 s ohne Antwort → etwa eine Abfrage je Sekunde
    expect(versuche).toBeGreaterThanOrEqual(34);
  });
});

describe('@HT-034 Hält Tom ohne Netz kurz vor Schluss an, tönt der Lautsprecher bei 00:00 wie der Monitor', () => {
  // Toms Handy hat 20 s vor dem Ende kein Netz mehr und hält 10 s vor dem Ende an; der Server kennt die Pause nicht
  const halt = ENDE_A2 - 10_000;
  const netzZurueck = ENDE_A2 + 40_000;
  const weiter = netzZurueck + 5000;
  const eigenesEnde = weiter + 10_000;
  const pause = ev('PAUSE', halt, 2, null);
  const resume = ev('RESUME', weiter, 2, null);
  const ende = ev('MATCH_END', eigenesEnde, 2, 2 * ABSCHNITT_MS);

  async function lauf() {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 20_000);
    const beobachtet: { status?: string; alter?: number } = {};
    const ergebnis = await probe(lage, eigenesEnde + 10_000, [
      { um: halt + 2000, tu: () => { beobachtet.status = lage.stand()?.state.status; beobachtet.alter = lage.stand()?.antwortAlterMs; } },
      { um: netzZurueck, tu: () => lage.sende(CTX_11, [pause]) },
      { um: weiter, tu: () => lage.sende(CTX_11, [resume]) },
      { um: eigenesEnde, tu: () => lage.sende(CTX_11, [ende]) },
    ], 300);
    return { ...ergebnis, beobachtet };
  }

  it('@HT-034 der Stand des Lautsprechers ist der Stand am Server: ohne Toms Pause, die Uhr läuft weiter', async () => {
    const { beobachtet } = await lauf();
    expect(beobachtet.status).toBe('running');
    expect(beobachtet.alter).toBeLessThanOrEqual(1000);
  });

  it('@HT-034 der Abpfiff-Ton ertönt höchstens 1 s neben der 00:00 am Monitor; nach Rückkehr des Netzes kein zweiter Abpfiff-Ton', async () => {
    const monitorNull = phaseViewOf(stateAus(zweiterAbschnitt()), CTX_11, ENDE_A2 - 20_000).limitAt ?? 0;
    const { gespielt } = await lauf();
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - monitorNull)).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-051 Eine Korrektur über die Grenze hinaus ergibt einen Ton, sobald sie ankommt', () => {
  // Spiel 11 steht im zweiten Abschnitt bei 5:40 von 6:00, Tom korrigiert auf 6:20
  const korrigiertAt = ENDE_A2 - 20_000;
  const korrektur = ev('CLOCK_ADJUST', korrigiertAt, 2, 2 * ABSCHNITT_MS + 20_000);
  const ankunft = korrigiertAt + 400;

  async function lauf() {
    const lage = lageImZweitenAbschnitt(korrigiertAt - 5000);
    const bekannt: number[] = [];
    const merke = () => {
      const seit = lage.stand()?.bekanntSeit;
      if (seit !== undefined) {
        bekannt.push(seit);
      }
    };
    const ergebnis = await probe(lage, ENDE_A2 + 10_000, [
      { um: ankunft, tu: () => lage.sende(CTX_11, [korrektur]) },
      { um: ankunft + 1500, tu: merke },
      { um: ankunft + 6000, tu: merke },
    ], 50);
    return { ...ergebnis, bekannt };
  }

  it('@HT-051 einmal der Abpfiff-Ton, sobald die Korrektur ankommt (höchstens 1 s später), und kein zweiter Ton', async () => {
    const { gespielt } = await lauf();
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(gespielt[0].at).toBeGreaterThanOrEqual(ankunft);
    expect(gespielt[0].at - ankunft).toBeLessThanOrEqual(1000);
  });

  it('@HT-051 bekanntSeit ist der Zeitpunkt, zu dem die Korrektur ankam, und bleibt danach stehen', async () => {
    const { bekannt, gespielt } = await lauf();
    expect(bekannt).toHaveLength(2);
    expect(bekannt[0]).toBe(gespielt[0].at); // dieselbe Antwort brachte die Korrektur und den Ton
    expect(bekannt[1]).toBe(bekannt[0]);
  });
});
