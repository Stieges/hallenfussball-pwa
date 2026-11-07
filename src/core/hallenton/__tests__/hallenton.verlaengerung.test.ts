/**
 * @HT-031: Verlängerung, Golden Goal und Strafstoßschießen haben feste Töne in der Halle.
 * Halbfinale 1 „FC Nord gegen DJK Berg“ auf Feld 1, 2 × 5 Minuten, Verlängerung 3 Minuten, nach der regulären Spielzeit 1:1.
 * Rechner der Turnierleitung = Hallen-Lautsprecher, Tom leitet am Handy (Stand am Server). Testskelett aus dem Gherkin.
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent, TiebreakMode } from '../../match';
import { CTX_HF, T0, ev, koRegeln, lauf, server, stand, stateAus } from './hallentonFixtures';

const NORD = CTX_HF.teamAId;
const BERG = CTX_HF.teamBId;
const LAUFZEIT_MS = 300;
/** Ablauf der regulären Spielzeit (Wanduhr) und Anpfiff bzw. Ablauf der Verlängerung. */
const ENDE_REGULAER = T0 + 660_000;
const ANPFIFF_VL = T0 + 720_000;
const ENDE_VL = ANPFIFF_VL + 180_000;

function regulaerBisVorEnde(tiebreak: TiebreakMode): EngineEvent[] {
  return [
    ev('MATCH_START', T0, 1, null, { payload: { rules: koRegeln(tiebreak) } }),
    ev('GOAL', T0 + 100_000, 1, 100_000, { teamId: NORD }),
    ev('SECTION_END', T0 + 300_000, 1, 300_000),
    ev('SECTION_START', T0 + 360_000, 2, null),
    ev('GOAL', T0 + 500_000, 2, 440_000, { teamId: BERG }),
  ];
}

const regulaerZuEnde = (tiebreak: TiebreakMode): EngineEvent[] => [
  ...regulaerBisVorEnde(tiebreak), ev('MATCH_END', ENDE_REGULAER, 2, 600_000),
];

const verlaengerungLaeuft = (tiebreak: TiebreakMode): EngineEvent[] => [
  ...regulaerZuEnde(tiebreak), ev('SECTION_START', ANPFIFF_VL, 3, null),
];

/** Stand am Server je Stufe; ein Ereignis um `ab` ist nach der Laufzeit am Rechner bekannt. */
function ausServer(stufen: Array<{ ab: number; log: EngineEvent[] }>) {
  const states = stufen.map((stufe) => ({ ab: stufe.ab, state: stateAus(stufe.log, CTX_HF) }));
  return (jetzt: number) => {
    let aktuell = states[0];
    for (const stufe of states) {
      if (jetzt >= stufe.ab + LAUFZEIT_MS) {
        aktuell = stufe;
      }
    }
    return [stand(aktuell.state, CTX_HF, server(0), aktuell.ab + LAUFZEIT_MS)];
  };
}

describe('@HT-031 Verlängerung, Golden Goal und Strafstoßschießen haben feste Töne in der Halle', () => {
  it('@HT-031 „Verlängerung, dann Strafstoßschießen“: die reguläre Spielzeit läuft bei 1:1 ab, die Verlängerung folgt → einmal der kürzere Halbzeit-Ton', () => {
    const felder = ausServer([
      { ab: T0, log: regulaerBisVorEnde('overtime-then-shootout') },
      { ab: ENDE_REGULAER, log: regulaerZuEnde('overtime-then-shootout') },
    ]);
    const { gespielt } = lauf(felder, ENDE_REGULAER - 3000, ANPFIFF_VL + 5000, 100);
    expect(gespielt.map((t) => t.art)).toEqual(['halbzeit']);
    expect(Math.abs(gespielt[0].at - ENDE_REGULAER)).toBeLessThanOrEqual(1000);
  });

  it('@HT-031 „Verlängerung, dann Strafstoßschießen“: die Spielzeit der Verlängerung läuft ab → einmal der Abpfiff-Ton', () => {
    const felder = ausServer([
      { ab: ANPFIFF_VL, log: verlaengerungLaeuft('overtime-then-shootout') },
      { ab: ENDE_VL, log: [...verlaengerungLaeuft('overtime-then-shootout'), ev('MATCH_END', ENDE_VL, 3, 780_000)] },
    ]);
    const { gespielt } = lauf(felder, ENDE_VL - 3000, ENDE_VL + 8000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - ENDE_VL)).toBeLessThanOrEqual(1000);
  });

  it('@HT-031 „Strafstoßschießen“: die reguläre Spielzeit läuft bei 1:1 ab, das Strafstoßschießen folgt → einmal der Abpfiff-Ton', () => {
    const felder = ausServer([
      { ab: T0, log: regulaerBisVorEnde('shootout') },
      { ab: ENDE_REGULAER, log: regulaerZuEnde('shootout') },
    ]);
    const { gespielt } = lauf(felder, ENDE_REGULAER - 3000, ENDE_REGULAER + 8000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-031 „Strafstoßschießen“: im Strafstoßschießen wird geschossen, bis es entschieden ist → kein Ton', () => {
    const basis = regulaerZuEnde('shootout');
    const stufen: Array<{ ab: number; log: EngineEvent[] }> = [{ ab: ENDE_REGULAER, log: basis }];
    let log = basis;
    for (let i = 0; i < 3; i += 1) {
      const at = ENDE_REGULAER + 60_000 + i * 20_000;
      log = [...log, ev('SHOOTOUT_KICK', at, 2, null, { teamId: NORD, payload: { scored: true } })];
      stufen.push({ ab: at, log });
      log = [...log, ev('SHOOTOUT_KICK', at + 10_000, 2, null, { teamId: BERG, payload: { scored: false } })];
      stufen.push({ ab: at + 10_000, log });
    }
    const entschieden = ENDE_REGULAER + 125_000;
    stufen.push({ ab: entschieden, log: [...log, ev('SHOOTOUT_END', entschieden, 2, null)] });
    // ab 10 s nach dem Abpfiff-Ton vor dem Strafstoßschießen: kein weiterer Ton
    const { gespielt } = lauf(ausServer(stufen), ENDE_REGULAER + 10_000, entschieden + 10_000, 250);
    expect(gespielt).toEqual([]);
    expect(stateAus(stufen[stufen.length - 1].log, CTX_HF).status).toBe('finished');
  });

  it('@HT-031 „Golden Goal“: in der Verlängerung kommt ein Tor für FC Nord am Server an → einmal der Abpfiff-Ton, sobald das Tor ankommt', () => {
    const tor = ANPFIFF_VL + 70_000;
    const felder = ausServer([
      { ab: ANPFIFF_VL, log: verlaengerungLaeuft('goldenGoal') },
      { ab: tor, log: [...verlaengerungLaeuft('goldenGoal'), ev('GOAL', tor, 3, 670_000, { teamId: NORD })] },
    ]);
    const { gespielt } = lauf(felder, tor - 2000, ENDE_VL + 8000, 100);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    const ankunft = tor + LAUFZEIT_MS;
    expect(gespielt[0].at - ankunft).toBeGreaterThanOrEqual(0);
    expect(gespielt[0].at - ankunft).toBeLessThanOrEqual(200);
  });

  it('@HT-031 „Golden Goal“: die Verlängerung läuft ohne Tor ab → einmal der Abpfiff-Ton', () => {
    const felder = ausServer([
      { ab: ANPFIFF_VL, log: verlaengerungLaeuft('goldenGoal') },
      { ab: ENDE_VL, log: [...verlaengerungLaeuft('goldenGoal'), ev('MATCH_END', ENDE_VL, 3, 780_000)] },
    ]);
    const { gespielt } = lauf(felder, ENDE_VL - 3000, ENDE_VL + 8000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - ENDE_VL)).toBeLessThanOrEqual(1000);
  });

  describe('Golden-Goal-Tor zurückgenommen', () => {
    const tor = ANPFIFF_VL + 70_000;
    const torEreignis = ev('GOAL', tor, 3, 670_000, { teamId: NORD });
    const mitTor = [...verlaengerungLaeuft('goldenGoal'), torEreignis];
    const zurueck = tor + 20_000;
    // das beendete Spiel wird dafür wieder eröffnet (Uhr steht beim Tor bei 11:10) und das Tor zurückgenommen
    const ohneTor = [
      ...mitTor,
      ev('REOPEN', zurueck, 3, 670_000, { actor: 'leitung' }),
      ev('RETRACT', zurueck + 1000, 3, null, { actor: 'leitung', targetId: torEreignis.id }),
    ];
    // Restzeit beim Wiedereröffnen 1:50 → Ablauf 110 s nach dem Wiedereröffnen
    const neuesEnde = zurueck + 110_000;
    const felder = ausServer([
      { ab: ANPFIFF_VL, log: verlaengerungLaeuft('goldenGoal') },
      { ab: tor, log: mitTor },
      { ab: zurueck, log: ohneTor },
      { ab: neuesEnde, log: [...ohneTor, ev('MATCH_END', neuesEnde, 3, 780_000)] },
    ]);

    it('@HT-031 „Golden Goal“: Tom nimmt das Golden-Goal-Tor nach dem Abpfiff-Ton zurück → kein weiterer Ton', () => {
      const { gespielt } = lauf(felder, tor - 2000, neuesEnde - 5000, 100);
      expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    });

    it('@HT-031 „Golden Goal“: nach dem zurückgenommenen Tor läuft die Verlängerung ab → einmal der Abpfiff-Ton', () => {
      const { gespielt } = lauf(felder, tor - 2000, neuesEnde + 8000, 100);
      expect(gespielt.map((t) => t.art)).toEqual(['abpfiff', 'abpfiff']);
      expect(Math.abs(gespielt[1].at - neuesEnde)).toBeLessThanOrEqual(1000);
    });
  });
});
