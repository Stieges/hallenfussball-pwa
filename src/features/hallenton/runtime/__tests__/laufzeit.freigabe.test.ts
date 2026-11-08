/**
 * H3b-2b Tonlaufzeit: Freigabe vor dem Ton (@HT-011 ↔ @HT-029, Plan „Freigabe vor dem Ton“; seit H3b-4 mit 5 s), Weckruf 3 s
 * vorher, „gespielt“ erst nach dem Beginn, eine Runde zur Zeit, Uhrsprung (@HT-010) und @HT-033 Zeilen 4, 11. Gefälschter Feldstand, echter Takt und
 * Spieler. Spiel 11 im zweiten Abschnitt, Ende `ENDE_A2`; Tom leitet am Handy (Stand am Server).
 */
import { describe, expect, it } from 'vitest';
import { ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A2, T0, anpfiff, ev, server, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { Tab, feldAus } from './laufzeitTestlage';

/** Antwort am Server je Sekunde, ab `netzWegAb` keine mehr (Alter wächst). */
function antwortenBis(netzWegAb: number) {
  return (jetzt: number) => {
    const letzte = Math.floor(Math.min(jetzt, netzWegAb) / 1000) * 1000;
    return server(jetzt - letzte);
  };
}

async function tabImSpiel(start: number, alter: number | ((jetzt: number) => number) = antwortenBis(Number.POSITIVE_INFINITY), log = zweiterAbschnitt()): Promise<Tab> {
  const tab = new Tab({ start });
  const feld = feldAus([{ ab: T0, log }], CTX_11, 'field-1', alter);
  tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  await tab.starte();
  return tab;
}

describe('Freigabe vor dem Ton (@HT-011 ↔ @HT-029)', () => {
  it('@HT-011 die Antwort für das Feld fehlt 250 ms vor dem Ton → der geplante Ton wird abgebrochen, kein Ton nach altem Stand', async () => {
    const tab = await tabImSpiel(ENDE_A2 - 10_000, antwortenBis(ENDE_A2 - 5600));
    await tab.vor(8000, [{ um: ENDE_A2 - 5600, tu: () => { tab.ffs.haengt = true; } }]); // Abfrage hängt: kein neuer Plan
    expect(tab.spieler.geplant()).toHaveLength(1); // der Weckruf 3 s vorher hat ihn eingeplant
    await tab.vor(8000);
    expect(tab.toene()).toEqual([]);
    expect(tab.abgebrochen()).toBe(1);
  });

  it('@HT-029 Restrisiko: setzt der Worker genau in den letzten 250 ms aus, spielt der schon geplante Ton', async () => {
    // letzte Antwort 5,1 s vor dem Ton: beim letzten Takt vor dem Aussetzer (≤ 4,7 s alt) plant der Planer ihn noch, zu `at`
    // wäre sie 5,1 s alt – nur die Freigabe im 250-ms-Fenster hätte ihn verhindert
    const letzteAntwort = ENDE_A2 - 5100;
    const tab = await tabImSpiel(ENDE_A2 - 10_000, (jetzt) => server(jetzt - Math.min(jetzt, letzteAntwort)));
    await tab.vor(12_000, [
      { um: letzteAntwort, tu: () => { tab.ffs.haengt = true; } },
      { um: ENDE_A2 - 400, tu: () => tab.takt.workerAussetzen() },
    ]);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(20);
  });

  it('@HT-032 Freigabe je Feld: Feld 2 ohne frische Antwort tönt nicht, Feld 1 mit frischer Antwort tönt', async () => {
    // Feld 2 (Ende 2 s nach Feld 1) bekommt ab ENDE_A2 − 3,5 s keine lesbare Antwort mehr; ab ENDE_A2 + 0,5 s wird keine Runde
    // mehr fertig – nur die Freigabe je Feld kann den Ton noch verhindern, das globale Alter (Feld 1) wäre frisch
    const tab = new Tab({ start: ENDE_A2 - 8000, felder: [1, 2] });
    const f1 = feldAus([{ ab: T0, log: zweiterAbschnitt() }], CTX_11, 'field-1', server(100));
    const start12 = T0 + 2000;
    const f2 = feldAus([{ ab: start12, log: zweiterAbschnitt(start12) }], CTX_12, 'field-2', antwortenBis(ENDE_A2 - 3500));
    tab.ffs.staendeZu = (jetzt) => [f1(jetzt), f2(jetzt)];
    await tab.starte();
    await tab.vor(16_000, [{ um: ENDE_A2 + 500, tu: () => { tab.ffs.haengt = true; } }]);
    expect(tab.toene()).toHaveLength(1);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    expect(tab.abgebrochen()).toBe(1);
  });

  it('@HT-033 Zeile 11: Laptop leitet ohne Netz, die Abfrage hängt → das Alter der Antwort wächst in jedem Takt, kein Ton nach altem Stand', async () => {
    const netzWeg = ENDE_A2 - 8000;
    const tab = await tabImSpiel(ENDE_A2 - 12_000, antwortenBis(netzWeg));
    await tab.vor(4100, [{ um: netzWeg, tu: () => { tab.ffs.haengt = true; } }]);
    const gelesen = tab.ffs.staendeAufrufe;
    await tab.vor(12_000);
    expect(tab.ffs.staendeAufrufe - gelesen).toBeGreaterThanOrEqual(47);
    expect(tab.toene()).toEqual([]);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('keineVerbindung');
  });
});

describe('Weckruf, Ersetzen und „gespielt“ (Einbau-Vertrag Punkte 2–4)', () => {
  it('Weckruf 3 s vor dem Ton: erst dann kommt der Ton zum Spieler – auch wenn ab 5 s vorher keine Runde mehr fertig wird', async () => {
    const tab = await tabImSpiel(ENDE_A2 - 10_000);
    await tab.vor(6900, [{ um: ENDE_A2 - 5000, tu: () => { tab.ffs.haengt = true; } }]);
    expect(tab.spieler.geplant()).toEqual([]);
    await tab.vor(200);
    expect(tab.spieler.geplant()).toHaveLength(1);
    tab.ffs.loesen();
    await tab.vor(6000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(20);
  });

  it('verschiebt sich das Ende (Pause), wird der geplante Ton abgebrochen und zum neuen Ende neu geplant – genau ein Ton', async () => {
    const log = zweiterAbschnitt();
    const pause = ev('PAUSE', ENDE_A2 - 2000, 2, 2 * ABSCHNITT_MS - 2000);
    const weiter = ev('RESUME', ENDE_A2 + 8000, 2, null);
    const tab = new Tab({ start: ENDE_A2 - 8000 });
    const feld = feldAus([{ ab: T0, log }, { ab: ENDE_A2 - 2000, log: [...log, pause] }, { ab: ENDE_A2 + 8000, log: [...log, pause, weiter] }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(22_000);
    expect(tab.abgebrochen()).toBe(1);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - (ENDE_A2 + 10_000))).toBeLessThanOrEqual(1000);
  });

  it('fällt der Ton aus dem Plan (Feld nicht mehr Lautsprecher-Feld), wird er abgebrochen', async () => {
    const tab = await tabImSpiel(ENDE_A2 - 6000);
    const feld = tab.ffs.staendeZu;
    await tab.vor(4500);
    expect(tab.spieler.geplant()).toHaveLength(1);
    tab.ffs.staendeZu = (jetzt) => (jetzt < ENDE_A2 - 1000 ? feld(jetzt) : []);
    await tab.vor(6000);
    expect(tab.toene()).toEqual([]);
  });

  it('ein abgebrochener Ton gilt nicht als gespielt: kommt die frische Antwort innerhalb von 5 s, ertönt das Ende einmal', async () => {
    const tab = await tabImSpiel(ENDE_A2 - 10_000, antwortenBis(ENDE_A2 - 5600));
    const frisch = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    await tab.vor(16_000, [
      { um: ENDE_A2 - 5600, tu: () => { tab.ffs.haengt = true; } },
      { um: ENDE_A2 + 2000, tu: () => { tab.ffs.staendeZu = (jetzt) => [frisch(jetzt)]; tab.ffs.loesen(); } },
    ]);
    expect(tab.abgebrochen()).toBe(1);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(tab.toene()[0].at - ENDE_A2).toBeGreaterThanOrEqual(2000);
    expect(tab.toene()[0].at - ENDE_A2).toBeLessThanOrEqual(2500);
  });

  it('der gespielte Ton geht ins Gedächtnis: ein zweiter Plan nach dem Beginn tönt nicht erneut', async () => {
    const tab = await tabImSpiel(ENDE_A2 - 4000);
    await tab.vor(30_000);
    expect(tab.toene()).toHaveLength(1);
  });

  it('läuft noch eine Runde, startet kein zweiter Aufruf von aktualisieren', async () => {
    const tab = await tabImSpiel(ENDE_A2 - 60_000);
    const vorher = tab.ffs.aufrufe;
    tab.ffs.haengt = true;
    await tab.vor(260);
    await tab.vor(2000);
    expect(tab.ffs.aufrufe).toBe(vorher + 1);
    tab.ffs.loesen();
    await tab.vor(1000);
    expect(tab.ffs.aufrufe).toBeGreaterThanOrEqual(vorher + 4);
  });
});

describe('@HT-010 Uhrsprung', () => {
  it('@HT-010 springt die Uhr des Rechners 2 s vor, wird abgeglichen und neu geplant – der Ton bleibt beim richtigen Ende', async () => {
    let versatz = 0;
    const tab = new Tab({ start: ENDE_A2 - 6000, serverVersatz: () => versatz, beiSync: () => { versatz = 0; } });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(8000, [{ um: ENDE_A2 - 1500, tu: () => { versatz = 2000; tab.wandVersatz = 2000; } }]);
    expect(tab.syncAufrufe).toBe(1);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(300);
  });
});

describe('@HT-033 Zeile 4 und N-2 im Ruhezustand', () => {
  it('@HT-033 Zeile 4: Laptop ohne Netz → kein Ton nach altem Stand, Feld 1 „keine Verbindung“', async () => {
    const tab = await tabImSpiel(ENDE_A2 - 20_000, antwortenBis(ENDE_A2 - 15_000));
    tab.ffs.gescheitert = true;
    await tab.vor(26_000);
    expect(tab.toene()).toEqual([]);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('keineVerbindung');
  });

  it('N-2 im Ruhezustand: kein Spiel angepfiffen, Antwort 5,5 s alt ohne gescheiterten Versuch → keine Warnung', async () => {
    const tab = new Tab({ start: T0 - 60_000 });
    const feld = feldAus([{ ab: T0 - 120_000, log: [] }], CTX_11, 'field-1', server(5500));
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(2000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('ready');
    tab.ffs.gescheitert = true;
    await tab.vor(500);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('keineVerbindung');
  });

  it('angepfiffen und Antwort älter als 5 s → Warnung auch ohne gemeldeten Fehlschlag (Abfrage hängt)', async () => {
    const tab = await tabImSpiel(T0 + 60_000, server(5500), anpfiff());
    await tab.vor(1000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('keineVerbindung');
  });
});
