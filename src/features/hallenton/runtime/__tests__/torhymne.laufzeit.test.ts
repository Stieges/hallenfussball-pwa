/**
 * H3c Torhymne in der Laufzeit (@HT-024, @HT-023): echte Laufzeit, echter Takt-Adapter, echter Spieler auf dem gefälschten
 * AudioContext (Audiozeit = Uhr), Stand am Server je Feld als Funktion der Zeit (ein Eintrag ist 300 ms später bekannt).
 * Gherkin: Feld 1 hat „Ton bei Tor“, Olli hat „Hymne A“ (8 s), „Hymne B“ (7 s) und „Hymne C“ (6 s) hochgeladen; Tom trägt
 * im Cockpit die Tore ein; der Rechner der Turnierleitung ist Hallen-Lautsprecher für Feld 1 (und Feld 2).
 * Abpfiff-Ton „Hupe 2“, Halbzeit-Ton „Hupe 3“.
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../../../../core/match';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, CTX_HF, ENDE_A1, ENDE_A2, PAUSE_MS, T0, anpfiff, ev, koRegeln, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { erzeugeHallTonSpieler, type Speicher } from '../hallTonSpieler';
import type { TorWahl } from '../torhymnenSteuerung';
import { HYMNE, Tab, feldAus, type Stufe } from './laufzeitTestlage';

const BEKANNT_NACH_MS = 300;
const TAKT_MS = 250;
const ABC: TorWahl = { felder: [1], hymnen: [HYMNE.a, HYMNE.b, HYMNE.c] };
const tor = (at: number, teamId = CTX_11.teamAId, section = 2): EngineEvent => ev('GOAL', at, section, null, { teamId });
const zweiteHalbzeit = zweiterAbschnitt();

async function lautsprecher(start: number, felder: (jetzt: number) => ReturnType<ReturnType<typeof feldAus>>[], o: { torWahl?: TorWahl; felderNr?: number[]; speicher?: Speicher | null } = {}): Promise<Tab> {
  const tab = new Tab({ start, felder: o.felderNr ?? [1], torWahl: o.torWahl ?? ABC, speicher: o.speicher });
  tab.ffs.staendeZu = felder;
  await tab.starte();
  return tab;
}

function speicher(): Speicher {
  const werte = new Map<string, string>();
  return { getItem: (k) => werte.get(k) ?? null, setItem: (k, v) => { werte.set(k, v); } };
}

/** Die Hymne beginnt, sobald das Tor im frischen Stand bekannt ist: 300 ms Laufzeit, höchstens ein Takt später. */
function erwarteBeginnNach(at: number, torAt: number): void {
  expect(at - torAt).toBeGreaterThanOrEqual(BEKANNT_NACH_MS);
  expect(at - torAt).toBeLessThanOrEqual(BEKANNT_NACH_MS + TAKT_MS + 10);
}

describe('@HT-024 Auf Wunsch spielt der Hallen-Lautsprecher bei einem Tor eine Torhymne', () => {
  it('@HT-024 Tom trägt das erste Tor für SV Süd ein → der Hallen-Lautsprecher von Feld 1 spielt einmal „Hymne A“', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const tab = await lautsprecher(t1.at - 5000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }])(j)]);
    await tab.vor(15_000);
    const h = tab.hymnen();
    expect(h.map((x) => x.hymne)).toEqual(['a']);
    erwarteBeginnNach(h[0].at, t1.at);
    expect(h[0].bis - h[0].at).toBe(8000); // ganz gespielt
    expect(tab.toene()).toEqual([]);
    // über den Begrenzer, wie die übrigen Töne
    expect(tab.kontext.gains.at(-1)?.ziele).toEqual([expect.objectContaining({ threshold: { value: -3 }, ratio: { value: 20 } })]);
  });

  it('@HT-024 danach fallen das zweite und das dritte Tor → „Hymne B“, dann „Hymne C“ – der Reihe nach, nie zweimal hintereinander dieselbe', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const t2 = tor(t1.at + 12_000, CTX_11.teamBId);
    const t3 = tor(t2.at + 12_000);
    const stufen: Stufe[] = [
      { ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] },
      { ab: t2.at, log: [...zweiteHalbzeit, t1, t2] }, { ab: t3.at, log: [...zweiteHalbzeit, t1, t2, t3] },
    ];
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus(stufen)(j)]);
    await tab.vor(36_000);
    const h = tab.hymnen();
    expect(h.map((x) => x.hymne)).toEqual(['a', 'b', 'c']);
    [t1, t2, t3].forEach((t, i) => erwarteBeginnNach(h[i].at, t.at));
  });

  it('@HT-024 Tom nimmt das Tor zurück, während seine Hymne noch läuft → die Hymne bricht ab, und es ertönt kein weiterer Ton', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const zurueck = ev('RETRACT', t1.at + 3000, 2, null, { actor: 'leitung', targetId: t1.id });
    const stufen: Stufe[] = [
      { ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }, { ab: zurueck.at, log: [...zweiteHalbzeit, t1, zurueck] },
    ];
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus(stufen)(j)]);
    await tab.vor(20_000);
    const h = tab.hymnen();
    expect(h).toHaveLength(1);
    erwarteBeginnNach(h[0].bis, zurueck.at);
    expect(tab.toene()).toEqual([]);
  });

  it('@HT-024 während einer Hymne läuft die Spielzeit ab → die Hymne bricht sofort ab, und der Abpfiff-Ton ertönt pünktlich, genau einmal', async () => {
    const t1 = tor(ENDE_A2 - 4000);
    const tab = await lautsprecher(ENDE_A2 - 10_000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }])(j)]);
    await tab.vor(16_000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(tab.toene()[0].at).toBe(ENDE_A2);
    const h = tab.hymnen();
    expect(h).toHaveLength(1);
    expect(h[0].bis).toBe(ENDE_A2); // genau zum Beginn des Abpfiff-Tons
  });

  it('@HT-024 während einer Hymne läuft die Spielzeit der ersten Halbzeit ab → die Hymne bricht sofort ab, und der Halbzeit-Ton ertönt pünktlich', async () => {
    const t1 = tor(ENDE_A1 - 4000, CTX_11.teamAId, 1);
    const tab = await lautsprecher(ENDE_A1 - 10_000, (j) => [feldAus([{ ab: T0, log: anpfiff() }, { ab: t1.at, log: [...anpfiff(), t1] }])(j)]);
    await tab.vor(16_000);
    expect(tab.toene().map((t) => t.art)).toEqual(['halbzeit']);
    expect(tab.toene()[0].at).toBe(ENDE_A1);
    expect(tab.hymnen().map((x) => x.bis)).toEqual([ENDE_A1]);
  });

  it('@HT-024 Abpfiff von Hand während einer Hymne → die Hymne endet mit dem Abpfiff-Ton, der genau einmal ertönt', async () => {
    const t1 = tor(ENDE_A2 - 30_000);
    const vonHand = ev('MATCH_END', ENDE_A2 - 27_000, 2, 2 * ABSCHNITT_MS - 27_000);
    const stufen: Stufe[] = [
      { ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }, { ab: vonHand.at, log: [...zweiteHalbzeit, t1, vonHand] },
    ];
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus(stufen)(j)]);
    await tab.vor(15_000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(tab.hymnen().map((x) => x.bis)).toEqual([tab.toene()[0].at]);
  });

  it('@HT-024 auf Feld 2 fällt ein Tor, während die Hymne von Feld 1 noch läuft (Ton bei Tor auch für Feld 2) → die laufende Hymne spielt zu Ende, eine zweite startet nicht', async () => {
    const start12 = ENDE_A2 - (2 * ABSCHNITT_MS + PAUSE_MS) + 20_000;
    const f1Tor = tor(ENDE_A2 - 60_000);
    const f2Tor = tor(f1Tor.at + 3000, CTX_12.teamAId);
    const log12 = zweiterAbschnitt(start12);
    const f1 = feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: f1Tor.at, log: [...zweiteHalbzeit, f1Tor] }]);
    const f2 = feldAus([{ ab: T0, log: log12 }, { ab: f2Tor.at, log: [...log12, f2Tor] }], CTX_12, 'field-2');
    const tab = await lautsprecher(f1Tor.at - 2000, (j) => [f1(j), f2(j)], { felderNr: [1, 2], torWahl: { ...ABC, felder: [1, 2] } });
    await tab.vor(20_000);
    const h = tab.hymnen();
    expect(h.map((x) => x.hymne)).toEqual(['a']);
    expect(h[0].bis - h[0].at).toBe(8000); // zu Ende gespielt
  });

  it('@HT-024 das Tor in der Verlängerung mit Golden Goal fällt → nur der Abpfiff-Ton, keine Hymne', async () => {
    const anpfiffVl = T0 + 720_000;
    const regulaer = [
      ev('MATCH_START', T0, 1, null, { payload: { rules: koRegeln('goldenGoal') } }),
      ev('GOAL', T0 + 100_000, 1, 100_000, { teamId: CTX_HF.teamAId }),
      ev('SECTION_END', T0 + 300_000, 1, 300_000),
      ev('SECTION_START', T0 + 360_000, 2, null),
      ev('GOAL', T0 + 500_000, 2, 440_000, { teamId: CTX_HF.teamBId }),
      ev('MATCH_END', T0 + 660_000, 2, 600_000),
      ev('SECTION_START', anpfiffVl, 3, null),
    ];
    const goldenGoal = ev('GOAL', anpfiffVl + 70_000, 3, 670_000, { teamId: CTX_HF.teamAId });
    const tab = await lautsprecher(goldenGoal.at - 5000, (j) => [feldAus([{ ab: anpfiffVl, log: regulaer }, { ab: goldenGoal.at, log: [...regulaer, goldenGoal] }], CTX_HF)(j)]);
    await tab.vor(12_000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(tab.hymnen()).toEqual([]);
  });

  it('@HT-024 „Ton bei Tor“ für Feld 1 ist aus → bei einem Tor ertönt nichts', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }])(j)], { torWahl: { ...ABC, felder: [] } });
    await tab.vor(12_000);
    expect(tab.hymnen()).toEqual([]);
    expect(tab.toene()).toEqual([]);
  });

  it('@HT-024 „Ton bei Tor“ wird während des Spiels eingeschaltet → das nächste Tor tönt, das vorherige wird nicht nachgeholt', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const t2 = tor(t1.at + 10_000);
    const stufen: Stufe[] = [{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }, { ab: t2.at, log: [...zweiteHalbzeit, t1, t2] }];
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus(stufen)(j)], { torWahl: { ...ABC, felder: [] } });
    await tab.vor(5000, [{ um: t1.at + 2000, tu: () => tab.laufzeit.setzeTorWahl(ABC) }]);
    await tab.vor(10_000);
    expect(tab.hymnen().map((x) => x.hymne)).toEqual(['a']);
    erwarteBeginnNach(tab.hymnen()[0].at, t2.at);
  });
});

describe('@HT-023 Die Lautstärke der Torhymne ist je Lautsprecher-Gerät einstellbar', () => {
  it('@HT-023 Olli stellt den Abpfiff-Ton auf 80 %, den Halbzeit-Ton auf 50 % und die Torhymne auf 40 % → Hymne mit 40 %, Abpfiff unberührt mit 80 %; nach dem Neuladen bleibt es', async () => {
    const geraeteSpeicher = speicher();
    const t1 = tor(ENDE_A2 - 4000);
    const tab = new Tab({ start: ENDE_A2 - 10_000, torWahl: ABC, speicher: geraeteSpeicher });
    tab.spieler.setzeLautstaerke('abpfiff', 80);
    tab.spieler.setzeLautstaerke('halbzeit', 50);
    tab.spieler.setzeLautstaerke('tor', 40);
    tab.ffs.staendeZu = (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }])(j)];
    await tab.starte();
    await tab.vor(16_000);
    expect(tab.hymnen().map((x) => x.gain)).toEqual([0.4]);
    expect(tab.toene().map((t) => [t.art, t.gain])).toEqual([['abpfiff', 0.8]]);
    // Neuladen der App: ein neuer Spieler mit demselben Gerätespeicher
    const neu = erzeugeHallTonSpieler({ erzeugeKontext: () => tab.kontext, ladeDaten: () => Promise.reject(new Error('egal')), speicher: geraeteSpeicher });
    expect([neu.lautstaerke('abpfiff'), neu.lautstaerke('halbzeit'), neu.lautstaerke('tor')]).toEqual([80, 50, 40]);
  });

  it('@HT-023 der Regler für die Torhymne wirkt auch auf eine gerade laufende Hymne', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }])(j)]);
    await tab.vor(4000);
    tab.spieler.setzeLautstaerke('tor', 25);
    await tab.vor(1000);
    expect(tab.hymnen().map((x) => x.gain)).toEqual([0.25]);
  });

  it('Gegenbeispiel: Torhymne auf 0 % → keine Hymne; der Lautsprecher bleibt bereit (nur der Abpfiff-Ton zählt für „volume_zero“)', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const tab = new Tab({ start: t1.at - 2000, torWahl: ABC });
    tab.spieler.setzeLautstaerke('tor', 0);
    tab.ffs.staendeZu = (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }])(j)];
    await tab.starte();
    await tab.vor(10_000);
    expect(tab.hymnen()).toEqual([]);
    expect(tab.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
  });
});

describe('@HT-024 Gegenbeispiele in der Laufzeit', () => {
  const t1 = tor(ENDE_A2 - 60_000);
  const mitTor = [...zweiteHalbzeit, t1];

  it('das Tor steht schon im ersten bekannten Stand → keine Hymne', async () => {
    const tab = await lautsprecher(t1.at + 1000, (j) => [feldAus([{ ab: t1.at, log: mitTor }])(j)]);
    await tab.vor(10_000);
    expect(tab.hymnen()).toEqual([]);
  });

  it('Neuladen mitten im Spiel: keine Hymne für die alten Tore, das nächste Tor tönt mit „Hymne A“ (der Zähler beginnt vorn)', async () => {
    const t2 = tor(t1.at + 40_000);
    const stufen: Stufe[] = [{ ab: t1.at, log: mitTor }, { ab: t2.at, log: [...mitTor, t2] }];
    const vorher = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, ...stufen])(j)]);
    await vorher.vor(3000);
    expect(vorher.hymnen().map((x) => x.hymne)).toEqual(['a']);
    vorher.laufzeit.stop();
    // die App wird 30 s nach Tor 1 neu geladen
    const neu = await lautsprecher(t1.at + 30_000, (j) => [feldAus(stufen)(j)]);
    await neu.vor(15_000);
    expect(neu.hymnen().map((x) => x.hymne)).toEqual(['a']);
    erwarteBeginnNach(neu.hymnen()[0].at, t2.at);
  });

  it('die letzte Antwort des Servers ist 5,1 s alt → keine Hymne (Regel 2, kein Ton nach unsicherem Stand)', async () => {
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }], CTX_11, 'field-1', 5100)(j)]);
    await tab.vor(10_000);
    expect(tab.hymnen()).toEqual([]);
  });

  it('Gegenprobe: die letzte Antwort ist 4,9 s alt → Hymne', async () => {
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }], CTX_11, 'field-1', 4900)(j)]);
    await tab.vor(10_000);
    expect(tab.hymnen()).toHaveLength(1);
  });

  it('Strafstöße im Strafstoßschießen → keine Hymne', async () => {
    const endeReg = T0 + 660_000;
    let log: EngineEvent[] = [
      ev('MATCH_START', T0, 1, null, { payload: { rules: koRegeln('shootout') } }),
      ev('GOAL', T0 + 100_000, 1, 100_000, { teamId: CTX_HF.teamAId }),
      ev('SECTION_END', T0 + 300_000, 1, 300_000),
      ev('SECTION_START', T0 + 360_000, 2, null),
      ev('GOAL', T0 + 500_000, 2, 440_000, { teamId: CTX_HF.teamBId }),
      ev('MATCH_END', endeReg, 2, 600_000),
    ];
    const stufen: Stufe[] = [{ ab: endeReg, log }];
    for (let i = 0; i < 2; i += 1) {
      const at = endeReg + 10_000 + i * 5000;
      log = [...log, ev('SHOOTOUT_KICK', at, 2, null, { teamId: CTX_HF.teamAId, payload: { scored: true } })];
      stufen.push({ ab: at, log });
    }
    const tab = await lautsprecher(endeReg + 5000, (j) => [feldAus(stufen, CTX_HF)(j)]);
    await tab.vor(15_000);
    expect(tab.hymnen()).toEqual([]);
  });

  it('eine Hymne ist länger als 10 s (14 s) → harter Stopp nach 10 s', async () => {
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }])(j)], { torWahl: { felder: [1], hymnen: [HYMNE.lang] } });
    await tab.vor(16_000);
    const h = tab.hymnen();
    expect(h.map((x) => x.hymne)).toEqual(['lang']);
    expect(h[0].bis - h[0].at).toBe(10_000);
  });

  it('eine Hymne lädt nicht → sie wird übersprungen, die nächste spielt; kein Zustand „custom_sound_failed“', async () => {
    const t2 = tor(t1.at + 12_000);
    const stufen: Stufe[] = [{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }, { ab: t2.at, log: [...mitTor, t2] }];
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus(stufen)(j)], { torWahl: { felder: [1], hymnen: [HYMNE.kaputt, HYMNE.b] } });
    await tab.vor(24_000);
    expect(tab.hymnen().map((x) => x.hymne)).toEqual(['b', 'b']); // nur eine spielbar: immer diese
    expect(tab.spieler.zustand()).toBe('ready');
    expect(tab.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
  });

  it('keine Hymne lädt → kein Tor-Ton, kein Rückfall auf eine Hupe', async () => {
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }])(j)], { torWahl: { felder: [1], hymnen: [HYMNE.kaputt] } });
    await tab.vor(10_000);
    expect(tab.hymnen()).toEqual([]);
    expect(tab.toene()).toEqual([]);
    expect(tab.spieler.zustand()).toBe('ready');
  });

  it('Ausschalten während einer Hymne → die Hymne verstummt sofort', async () => {
    const tab = await lautsprecher(t1.at - 2000, (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }])(j)]);
    await tab.vor(4000);
    const aus = tab.uhr.jetzt();
    tab.laufzeit.stop();
    await tab.vor(1000);
    expect(tab.hymnen().map((x) => x.bis)).toEqual([aus]);
  });

  it('ein nicht aktivierter Tab lädt keine Hymnen (keine Last für wartende Tabs)', async () => {
    const geladen: string[] = [];
    const tab = new Tab({ start: t1.at - 2000, torWahl: ABC });
    const laden = tab.spieler.hymnen.laden.bind(tab.spieler.hymnen);
    tab.spieler.hymnen.laden = (urls) => {
      geladen.push(...urls);
      return laden(urls);
    };
    await tab.starte({ aktivieren: false });
    await tab.vor(1000);
    expect(geladen).toEqual([]);
    await tab.laufzeit.tonAktivieren();
    expect(geladen).toEqual(ABC.hymnen);
  });
});
