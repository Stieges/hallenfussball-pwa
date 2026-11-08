/**
 * @HT-024 Torhymne – Logik-Ebene (`planeTorhymne`, `naechsteHymne`). Testskelett aus dem Gherkin: Feld 1 hat „Ton bei Tor“,
 * Olli hat „Hymne A“, „Hymne B“ und „Hymne C“ hochgeladen (je 8 s). Spiel 11 (SV Süd gegen FC Nord, 2 × 6 Minuten) auf
 * Feld 1, Spiel 12 auf Feld 2; Halbfinale 1 mit Golden Goal. Der Rechner der Turnierleitung ist Hallen-Lautsprecher; ein
 * Eintrag im Cockpit ist 300 ms später am Rechner bekannt (Stand am Server, Regel 2).
 * Die Zeile „Olli eine Hymne mit 14 Sekunden hochladen will“ prüft `torhymnePruefung.test.ts` (Anzeige und Hochladen: H4).
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent, MatchContext } from '../../match';
import {
  LEERES_TOR_GEDAECHTNIS, NACHHOLEN_MAX_MS, naechsteHymne, planeTorhymne, type FeldStand, type LaufendeHymne, type TorGedaechtnis,
} from '..';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, CTX_HF, ENDE_A1, ENDE_A2, PAUSE_MS, T0, anpfiff, ev, koRegeln, stand, stateAus, zweiterAbschnitt,
} from './hallentonFixtures';

const LAUFZEIT_MS = 300;
const TAKT_MS = 250;
const HYMNEN = ['hymne-a', 'hymne-b', 'hymne-c'];
const HYMNE_MS = 8000;
const SUED = CTX_11.teamAId;

type Stufe = { ab: number; log: EngineEvent[] };

/** Stand am Server je Zeit aus Stufen; `alter` ist das Alter der letzten Antwort. */
function ausServer(stufen: Stufe[], ctx: MatchContext = CTX_11, feldId = 'feld-1', alter: (jetzt: number) => number = () => 200) {
  const states = stufen.map((s) => ({ ab: s.ab, state: stateAus(s.log, ctx) }));
  return (jetzt: number): FeldStand => {
    let aktuell = states[0];
    for (const s of states) {
      if (jetzt >= s.ab + LAUFZEIT_MS) {
        aktuell = s;
      }
    }
    return stand(aktuell.state, ctx, alter(jetzt), aktuell.ab + LAUFZEIT_MS, feldId);
  };
}

interface Ereignis { art: 'start' | 'abbruch' | 'ende'; at: number; hymne?: string; feldId?: string; torId?: string }

/**
 * Einbau-Nachbau: alle 250 ms `planeTorhymne`; eine gestartete Hymne klingt `HYMNE_MS` (höchstens 10 s), danach ist sie aus.
 * `spielbar` je Hymne (nicht geladen = false).
 */
function torLauf(
  felderZu: (jetzt: number) => FeldStand[],
  von: number,
  bis: number,
  { torFelder = ['feld-1'], spielbar = [true, true, true], start = LEERES_TOR_GEDAECHTNIS }: { torFelder?: string[]; spielbar?: boolean[]; start?: TorGedaechtnis } = {},
): Ereignis[] {
  let gedaechtnis = start;
  let laufend: (LaufendeHymne & { bis: number }) | null = null;
  let zuletzt: string | null = null;
  const ereignisse: Ereignis[] = [];
  for (let jetzt = von; jetzt <= bis; jetzt += TAKT_MS) {
    if (laufend && jetzt >= laufend.bis) {
      ereignisse.push({ art: 'ende', at: laufend.bis });
      laufend = null;
    }
    const plan = planeTorhymne({ felder: felderZu(jetzt), torFelder, serverNow: jetzt, laufend }, gedaechtnis);
    gedaechtnis = plan.gedaechtnis;
    if (plan.abbrechen) {
      ereignisse.push({ art: 'abbruch', at: jetzt });
      laufend = null;
    }
    if (plan.starten) {
      const i = naechsteHymne(HYMNEN, spielbar, zuletzt);
      if (i !== null) {
        zuletzt = HYMNEN[i];
        laufend = { ...plan.starten, bis: jetzt + Math.min(HYMNE_MS, 10_000) };
        ereignisse.push({ art: 'start', at: jetzt, hymne: HYMNEN[i], feldId: plan.starten.feldId, torId: plan.starten.torId });
      }
    }
  }
  return ereignisse;
}

const starts = (e: Ereignis[]): Ereignis[] => e.filter((x) => x.art === 'start');
const tor = (at: number, teamId = SUED, section = 2): EngineEvent => ev('GOAL', at, section, null, { teamId });
const zweiteHalbzeit = zweiterAbschnitt();

describe('@HT-024 Auf Wunsch spielt der Hallen-Lautsprecher bei einem Tor eine Torhymne', () => {
  it('@HT-024 Tom trägt das erste Tor für SV Süd ein → der Lautsprecher von Feld 1 spielt einmal „Hymne A“', () => {
    const t1 = tor(ENDE_A2 - 100_000);
    const felder = ausServer([{ ab: ENDE_A2 - 120_000, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }]);
    const e = torLauf((j) => [felder(j)], ENDE_A2 - 110_000, ENDE_A2 - 80_000);
    expect(starts(e).map((s) => s.hymne)).toEqual(['hymne-a']);
    expect(starts(e)[0].torId).toBe(t1.id);
    // sobald das Tor im frischen Stand bekannt ist (300 ms Laufzeit, Takt 250 ms)
    expect(starts(e)[0].at - t1.at).toBeGreaterThanOrEqual(LAUFZEIT_MS);
    expect(starts(e)[0].at - t1.at).toBeLessThanOrEqual(LAUFZEIT_MS + TAKT_MS);
    expect(e.filter((x) => x.art === 'abbruch')).toEqual([]);
  });

  it('@HT-024 danach fallen das zweite und das dritte Tor → „Hymne B“, dann „Hymne C“ – der Reihe nach, nie zweimal hintereinander dieselbe', () => {
    const t1 = tor(ENDE_A2 - 100_000);
    const t2 = tor(ENDE_A2 - 70_000, CTX_11.teamBId);
    const t3 = tor(ENDE_A2 - 40_000);
    const felder = ausServer([
      { ab: ENDE_A2 - 120_000, log: zweiteHalbzeit },
      { ab: t1.at, log: [...zweiteHalbzeit, t1] },
      { ab: t2.at, log: [...zweiteHalbzeit, t1, t2] },
      { ab: t3.at, log: [...zweiteHalbzeit, t1, t2, t3] },
    ]);
    const e = torLauf((j) => [felder(j)], ENDE_A2 - 110_000, ENDE_A2 - 20_000);
    expect(starts(e).map((s) => s.hymne)).toEqual(['hymne-a', 'hymne-b', 'hymne-c']);
    expect(starts(e).map((s) => s.torId)).toEqual([t1.id, t2.id, t3.id]);
  });

  it('@HT-024 Tom nimmt das Tor zurück, während seine Hymne noch läuft → die Hymne bricht ab, kein weiterer Ton', () => {
    const t1 = tor(ENDE_A2 - 100_000);
    const zurueck = ev('RETRACT', t1.at + 3000, 2, null, { actor: 'leitung', targetId: t1.id });
    const felder = ausServer([
      { ab: ENDE_A2 - 120_000, log: zweiteHalbzeit },
      { ab: t1.at, log: [...zweiteHalbzeit, t1] },
      { ab: zurueck.at, log: [...zweiteHalbzeit, t1, zurueck] },
    ]);
    const e = torLauf((j) => [felder(j)], ENDE_A2 - 110_000, ENDE_A2 - 60_000);
    expect(e.map((x) => x.art)).toEqual(['start', 'abbruch']);
    const abbruch = e[1].at;
    expect(abbruch - zurueck.at).toBeGreaterThanOrEqual(LAUFZEIT_MS);
    expect(abbruch - zurueck.at).toBeLessThanOrEqual(LAUFZEIT_MS + TAKT_MS);
  });

  it('@HT-024 während einer Hymne läuft die Spielzeit ab → die Hymne bricht ab (spätestens im ersten Takt nach 00:00)', () => {
    const t1 = tor(ENDE_A2 - 4000);
    const felder = ausServer([{ ab: ENDE_A2 - 30_000, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }]);
    const e = torLauf((j) => [felder(j)], ENDE_A2 - 20_000, ENDE_A2 + 10_000);
    expect(e.map((x) => x.art)).toEqual(['start', 'abbruch']);
    expect(e[1].at).toBeGreaterThanOrEqual(ENDE_A2);
    expect(e[1].at - ENDE_A2).toBeLessThan(TAKT_MS);
  });

  it('@HT-024 während einer Hymne läuft die Spielzeit der ersten Halbzeit ab → die Hymne bricht ab', () => {
    const t1 = tor(ENDE_A1 - 4000, SUED, 1);
    const ersteHalbzeit = anpfiff();
    const felder = ausServer([{ ab: T0, log: ersteHalbzeit }, { ab: t1.at, log: [...ersteHalbzeit, t1] }]);
    const e = torLauf((j) => [felder(j)], ENDE_A1 - 20_000, ENDE_A1 + 10_000);
    expect(e.map((x) => x.art)).toEqual(['start', 'abbruch']);
    expect(e[1].at - ENDE_A1).toBeGreaterThanOrEqual(0);
    expect(e[1].at - ENDE_A1).toBeLessThan(TAKT_MS);
  });

  it('@HT-024 Abpfiff von Hand während einer Hymne → die Hymne bricht ab, sobald das Ende im Stand ist', () => {
    const t1 = tor(ENDE_A2 - 30_000);
    const vonHand = ev('MATCH_END', ENDE_A2 - 27_000, 2, 2 * ABSCHNITT_MS - 27_000);
    const felder = ausServer([
      { ab: ENDE_A2 - 40_000, log: zweiteHalbzeit },
      { ab: t1.at, log: [...zweiteHalbzeit, t1] },
      { ab: vonHand.at, log: [...zweiteHalbzeit, t1, vonHand] },
    ]);
    const e = torLauf((j) => [felder(j)], ENDE_A2 - 35_000, ENDE_A2 - 10_000);
    expect(e.map((x) => x.art)).toEqual(['start', 'abbruch']);
    expect(e[1].at - vonHand.at).toBeLessThanOrEqual(LAUFZEIT_MS + TAKT_MS);
  });

  it('@HT-024 auf Feld 2 fällt ein Tor, während die Hymne von Feld 1 noch läuft (Ton bei Tor auch für Feld 2) → die laufende spielt zu Ende, eine zweite startet nicht – auch danach nicht', () => {
    const start12 = ENDE_A2 - (2 * ABSCHNITT_MS + PAUSE_MS) + 10_000;
    const f1Tor = tor(ENDE_A2 - 100_000);
    const f2Tor = tor(f1Tor.at + 3000, CTX_12.teamAId);
    const f1 = ausServer([{ ab: ENDE_A2 - 120_000, log: zweiteHalbzeit }, { ab: f1Tor.at, log: [...zweiteHalbzeit, f1Tor] }]);
    const log12 = zweiterAbschnitt(start12);
    const f2 = ausServer([{ ab: ENDE_A2 - 120_000, log: log12 }, { ab: f2Tor.at, log: [...log12, f2Tor] }], CTX_12, 'feld-2');
    const e = torLauf((j) => [f1(j), f2(j)], ENDE_A2 - 110_000, ENDE_A2 - 60_000, { torFelder: ['feld-1', 'feld-2'] });
    expect(starts(e).map((s) => [s.feldId, s.hymne])).toEqual([['feld-1', 'hymne-a']]);
    expect(e.map((x) => x.art)).toEqual(['start', 'ende']); // zu Ende gespielt, kein Abbruch
  });

  it('@HT-024 das Tor in der Verlängerung mit Golden Goal fällt → keine Hymne (nur der Abpfiff-Ton, @HT-031)', () => {
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
    const felder = ausServer([{ ab: anpfiffVl, log: regulaer }, { ab: goldenGoal.at, log: [...regulaer, goldenGoal] }], CTX_HF);
    expect(stateAus([...regulaer, goldenGoal], CTX_HF).status).toBe('finished');
    expect(torLauf((j) => [felder(j)], anpfiffVl + 60_000, anpfiffVl + 90_000)).toEqual([]);
  });

  it('@HT-024 „Ton bei Tor“ für Feld 1 ist aus → bei einem Tor ertönt nichts', () => {
    const t1 = tor(ENDE_A2 - 100_000);
    const felder = ausServer([{ ab: ENDE_A2 - 120_000, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }]);
    expect(torLauf((j) => [felder(j)], ENDE_A2 - 110_000, ENDE_A2 - 80_000, { torFelder: [] })).toEqual([]);
    // Gegenprobe: „Ton bei Tor“ nur für Feld 2 – Feld 1 bleibt still
    expect(torLauf((j) => [felder(j)], ENDE_A2 - 110_000, ENDE_A2 - 80_000, { torFelder: ['feld-2'] })).toEqual([]);
  });
});

describe('@HT-024 Gegenbeispiele: keine Hymne ohne sicheres, neues Tor', () => {
  const t1 = tor(ENDE_A2 - 100_000);
  const mitTor = [...zweiteHalbzeit, t1];

  it('das Tor steht schon im ersten bekannten Stand (Start des Lautsprechers mitten im Spiel) → keine Hymne', () => {
    const felder = ausServer([{ ab: t1.at, log: mitTor }]);
    expect(torLauf((j) => [felder(j)], t1.at + 400, t1.at + 20_000)).toEqual([]);
  });

  it('Neuladen mitten im Spiel: neues Gedächtnis, die alten Tore tönen nicht; ein danach fallendes Tor schon', () => {
    const t2 = tor(t1.at + 60_000);
    const felder = ausServer([{ ab: t1.at, log: mitTor }, { ab: t2.at, log: [...mitTor, t2] }]);
    const e = torLauf((j) => [felder(j)], t1.at + 30_000, t2.at + 10_000); // erst 30 s nach Tor 1 neu geladen
    expect(starts(e).map((s) => s.torId)).toEqual([t2.id]);
  });

  it('die letzte Antwort ist 5,1 s alt → keine Hymne (Regel 2, @HT-011); 5,0 s → Hymne', () => {
    const stufen = [{ ab: ENDE_A2 - 120_000, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }];
    expect(torLauf((j) => [ausServer(stufen, CTX_11, 'feld-1', () => 5100)(j)], ENDE_A2 - 110_000, ENDE_A2 - 80_000)).toEqual([]);
    expect(starts(torLauf((j) => [ausServer(stufen, CTX_11, 'feld-1', () => 5000)(j)], ENDE_A2 - 110_000, ENDE_A2 - 80_000))).toHaveLength(1);
  });

  it('das Tor wird erst später als 5 s nach seiner Serverzeit bekannt → keine Hymne, auch nicht nachgeholt', () => {
    const spaet = (verzugMs: number) => (jetzt: number): FeldStand => {
      const bekannt = t1.at + verzugMs;
      return jetzt < bekannt
        ? stand(stateAus(zweiteHalbzeit), CTX_11, 200, ENDE_A2 - 120_000)
        : stand(stateAus(mitTor), CTX_11, 200, bekannt);
    };
    expect(torLauf((j) => [spaet(NACHHOLEN_MAX_MS + 100)(j)], ENDE_A2 - 110_000, ENDE_A2 - 80_000)).toEqual([]);
    expect(starts(torLauf((j) => [spaet(NACHHOLEN_MAX_MS - 200)(j)], ENDE_A2 - 110_000, ENDE_A2 - 80_000))).toHaveLength(1);
  });

  it('Strafstöße im Strafstoßschießen → keine Hymne', () => {
    const endeReg = T0 + 660_000;
    let log = [
      ev('MATCH_START', T0, 1, null, { payload: { rules: koRegeln('shootout') } }),
      ev('GOAL', T0 + 100_000, 1, 100_000, { teamId: CTX_HF.teamAId }),
      ev('SECTION_END', T0 + 300_000, 1, 300_000),
      ev('SECTION_START', T0 + 360_000, 2, null),
      ev('GOAL', T0 + 500_000, 2, 440_000, { teamId: CTX_HF.teamBId }),
      ev('MATCH_END', endeReg, 2, 600_000),
    ];
    const stufen: Stufe[] = [{ ab: endeReg, log }];
    for (let i = 0; i < 3; i += 1) {
      const at = endeReg + 20_000 + i * 10_000;
      log = [...log, ev('SHOOTOUT_KICK', at, 2, null, { teamId: CTX_HF.teamAId, payload: { scored: true } })];
      stufen.push({ ab: at, log });
    }
    const felder = ausServer(stufen, CTX_HF);
    expect(stateAus(log, CTX_HF).status).toBe('shootout');
    expect(torLauf((j) => [felder(j)], endeReg + 10_000, endeReg + 60_000)).toEqual([]);
  });

  it('Absicherung Phase (Fixrunde 1): ein Tor in einem Stand mit Phase „Strafstoßschießen“ → keine Hymne', () => {
    // Die Engine lehnt GOAL im Strafstoßschießen ab (INVALID_TRANSITION, geprüft 08.11.); der Stand wird deshalb von Hand
    // gebaut: laufende Uhr, aber Phase shootout. So sichert der Test die Phasen-Prüfung in `imSpiel` allein ab.
    const ohne = stateAus(zweiteHalbzeit);
    const mit = stateAus(mitTor);
    const vor = stand({ ...ohne, phase: 'shootout' }, CTX_11, 200, ENDE_A2 - 120_000);
    const nach = stand({ ...mit, phase: 'shootout' }, CTX_11, 200, t1.at + LAUFZEIT_MS);
    expect(mit.status).toBe('running');
    expect(torLauf((j) => [j < t1.at + LAUFZEIT_MS ? vor : nach], t1.at - 5000, t1.at + 10_000)).toEqual([]);
    // Gegenprobe: derselbe Stand in der regulären Phase tönt
    const regulaer = (j: number) => (j < t1.at + LAUFZEIT_MS ? { ...vor, state: ohne } : { ...nach, state: mit });
    expect(starts(torLauf((j) => [regulaer(j)], t1.at - 5000, t1.at + 10_000))).toHaveLength(1);
  });

  it('ein Tor nach Ablauf der Spielzeit (00:00, der Abpfiff ist noch nicht im Stand) → keine Hymne nach dem Ende', () => {
    const spaet = tor(ENDE_A2 + 200);
    const felder = ausServer([{ ab: ENDE_A2 - 10_000, log: zweiteHalbzeit }, { ab: spaet.at, log: [...zweiteHalbzeit, spaet] }]);
    expect(stateAus([...zweiteHalbzeit, spaet]).status).toBe('running');
    expect(torLauf((j) => [felder(j)], ENDE_A2 - 5000, ENDE_A2 + 10_000)).toEqual([]);
  });

  it('Spielwechsel auf dem Feld während der Hymne → Abbruch; die Tore des neuen Spiels aus seinem ersten Stand tönen nicht', () => {
    const alt11 = ausServer([{ ab: ENDE_A2 - 120_000, log: zweiteHalbzeit }, { ab: t1.at, log: mitTor }]);
    const neu12 = stand(stateAus([...anpfiff(t1.at), tor(t1.at + 1000, CTX_12.teamAId, 1)], CTX_12), CTX_12, 200, t1.at + 5000);
    const f = (jetzt: number): FeldStand => (jetzt < t1.at + 5000 ? alt11(jetzt) : neu12);
    const e = torLauf((j) => [f(j)], ENDE_A2 - 110_000, t1.at + 20_000);
    expect(e.map((x) => x.art)).toEqual(['start', 'abbruch']);
  });
});

describe('@HT-024 Zeile 2: Reihenfolge der Hymnen (naechsteHymne)', () => {
  it('der Reihe nach über das Gerät: A, B, C, dann wieder A', () => {
    const folge: string[] = [];
    let zuletzt: string | null = null;
    for (let n = 0; n < 4; n += 1) {
      const i = naechsteHymne(HYMNEN, [true, true, true], zuletzt);
      zuletzt = i === null ? null : HYMNEN[i];
      folge.push(zuletzt ?? '-');
    }
    expect(folge).toEqual(['hymne-a', 'hymne-b', 'hymne-c', 'hymne-a']);
  });

  it('nur eine Hymne → immer diese', () => {
    expect(naechsteHymne(['hymne-a'], [true], 'hymne-a')).toBe(0);
  });

  it('Gegenbeispiel: „Hymne B“ lädt nicht → übersprungen: A, C, A – nie zweimal hintereinander dieselbe', () => {
    const spielbar = [true, false, true];
    expect(naechsteHymne(HYMNEN, spielbar, null)).toBe(0);
    expect(naechsteHymne(HYMNEN, spielbar, 'hymne-a')).toBe(2);
    expect(naechsteHymne(HYMNEN, spielbar, 'hymne-c')).toBe(0);
  });

  it('Gegenbeispiel: keine Hymne lädt → keine', () => {
    expect(naechsteHymne(HYMNEN, [false, false, false], null)).toBeNull();
    expect(naechsteHymne([], [], null)).toBeNull();
  });

  it('die Liste ändert sich (C, D statt A, B, C) nach „Hymne C“ → als nächste D, nicht wieder C', () => {
    expect(naechsteHymne(['hymne-c', 'hymne-d'], [true, true], 'hymne-c')).toBe(1);
    expect(naechsteHymne(['hymne-d', 'hymne-e'], [true, true], 'hymne-c')).toBe(0);
  });

  it('Lauf: B lädt nicht → bei drei Toren A, C, A', () => {
    const tore = [tor(ENDE_A2 - 100_000), tor(ENDE_A2 - 80_000), tor(ENDE_A2 - 60_000)];
    const felder = ausServer([
      { ab: ENDE_A2 - 120_000, log: zweiteHalbzeit },
      ...tore.map((t, i) => ({ ab: t.at, log: [...zweiteHalbzeit, ...tore.slice(0, i + 1)] })),
    ]);
    const e = torLauf((j) => [felder(j)], ENDE_A2 - 110_000, ENDE_A2 - 40_000, { spielbar: [true, false, true] });
    expect(starts(e).map((s) => s.hymne)).toEqual(['hymne-a', 'hymne-c', 'hymne-a']);
  });
});

describe('Uhrzeit des Tors liegt in den Fixtures zwischen den Enden', () => {
  it('Sicherung der Testlage: Spiel 11 läuft zwischen den Toren im zweiten Abschnitt', () => {
    expect(stateAus([...zweiteHalbzeit, tor(ENDE_A2 - 100_000)]).status).toBe('running');
    expect(ENDE_A1).toBe(T0 + ABSCHNITT_MS);
  });
});
