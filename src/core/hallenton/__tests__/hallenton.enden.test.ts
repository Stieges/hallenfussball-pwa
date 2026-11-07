/**
 * Welche Enden tönen, welcher Ton, genau einmal: @HT-003, @HT-007, @HT-008 und der Schlüssel je Ende (Regel 4).
 * Testskelett aus dem Gherkin-Wortlaut des Records `2026-10-15_hallenton.md`.
 * Rechner der Turnierleitung = Hallen-Lautsprecher für Feld 1; Tom leitet am Handy, also gilt der Stand am Server.
 */
import { describe, expect, it } from 'vitest';
import { endeSchluessel, planeHallToene, LEERES_GEDAECHTNIS } from '..';
import {
  ABSCHNITT_MS, CTX_11, ENDE_A1, ENDE_A2, PAUSE_MS, T0, anpfiff, ev, gruppenRegeln, lauf, server, stand, stateAus,
  zweiterAbschnitt,
} from './hallentonFixtures';

/** Stand am Server mit Nachrichten-Laufzeit: ein Ereignis um `at` ist ab `at + laufzeit` am Rechner bekannt. */
const LAUFZEIT_MS = 300;

function ausServer(stufen: Array<{ ab: number; log: ReturnType<typeof anpfiff> }>) {
  return (jetzt: number) => {
    let aktuell = stufen[0];
    for (const stufe of stufen) {
      if (jetzt >= stufe.ab + LAUFZEIT_MS) {
        aktuell = stufe;
      }
    }
    return [stand(stateAus(aktuell.log), CTX_11, server(0), aktuell.ab + LAUFZEIT_MS)];
  };
}

describe('@HT-003 Der Hallen-Lautsprecher tönt bei jedem Ende, nicht beim Anpfiff', () => {
  it('@HT-003 2 Abschnitte: die Spielzeit des zweiten Abschnitts abläuft → ertönt einmal der Abpfiff-Ton', () => {
    const log = zweiterAbschnitt();
    const felder = ausServer([
      { ab: T0, log },
      { ab: ENDE_A2, log: [...log, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)] },
    ]);
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 8000);
    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].art).toBe('abpfiff');
    expect(Math.abs(gespielt[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 2 Abschnitte: Tom im zweiten Abschnitt von Hand abpfeift → ertönt einmal der Abpfiff-Ton', () => {
    const log = zweiterAbschnitt();
    const abpfiff = ENDE_A2 - 100_000;
    const felder = ausServer([
      { ab: T0, log },
      { ab: abpfiff, log: [...log, ev('MATCH_END', abpfiff, 2, 2 * ABSCHNITT_MS - 100_000)] },
    ]);
    const { gespielt } = lauf(felder, abpfiff - 2000, ENDE_A2 + 8000, 100);
    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].art).toBe('abpfiff');
    expect(gespielt[0].at - abpfiff).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 2 Abschnitte: die Spielzeit des ersten Abschnitts abläuft → ertönt einmal der kürzere Halbzeit-Ton', () => {
    const log = anpfiff();
    const felder = ausServer([
      { ab: T0, log },
      { ab: ENDE_A1, log: [...log, ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS)] },
    ]);
    const { gespielt } = lauf(felder, ENDE_A1 - 3000, ENDE_A1 + 8000);
    expect(gespielt.map((t) => t.art)).toEqual(['halbzeit']);
    expect(Math.abs(gespielt[0].at - ENDE_A1)).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 2 Abschnitte: Tom im ersten Abschnitt „Halbzeit“ wählt → ertönt einmal der kürzere Halbzeit-Ton', () => {
    const log = anpfiff();
    const halbzeit = T0 + 200_000;
    const felder = ausServer([
      { ab: T0, log },
      { ab: halbzeit, log: [...log, ev('SECTION_END', halbzeit, 1, 200_000)] },
    ]);
    const { gespielt } = lauf(felder, halbzeit - 2000, ENDE_A1 + 8000, 100);
    expect(gespielt.map((t) => t.art)).toEqual(['halbzeit']);
    expect(gespielt[0].at - halbzeit).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 3 Abschnitte: die Spielzeit des ersten Abschnitts abläuft → ertönt einmal der kürzere Halbzeit-Ton', () => {
    const log = anpfiff(T0, gruppenRegeln(3));
    const felder = ausServer([
      { ab: T0, log },
      { ab: ENDE_A1, log: [...log, ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS)] },
    ]);
    const { gespielt } = lauf(felder, ENDE_A1 - 3000, ENDE_A1 + 8000);
    expect(gespielt.map((t) => t.art)).toEqual(['halbzeit']);
  });

  it('@HT-003 2 Abschnitte: Tom anpfeift → ertönt kein Ton', () => {
    const vorher = stateAus([]);
    const felder = (jetzt: number) => [
      stand(jetzt < T0 + LAUFZEIT_MS ? vorher : stateAus(anpfiff()), CTX_11, server(0), jetzt < T0 + LAUFZEIT_MS ? T0 - 60_000 : T0 + LAUFZEIT_MS),
    ];
    expect(lauf(felder, T0 - 5000, T0 + 10_000).gespielt).toEqual([]);
  });

  it('@HT-003 2 Abschnitte: Tom nach der Halbzeitpause wieder anpfeift → ertönt kein Ton', () => {
    const log = anpfiff();
    const imPause = [...log, ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS)];
    const wiederanpfiff = ENDE_A1 + PAUSE_MS;
    const felder = ausServer([
      { ab: T0, log },
      { ab: ENDE_A1, log: imPause },
      { ab: wiederanpfiff, log: [...imPause, ev('SECTION_START', wiederanpfiff, 2, null)] },
    ]);
    const { gespielt } = lauf(felder, ENDE_A1 - 2000, wiederanpfiff + 10_000, 100);
    // nur der Halbzeit-Ton am Ende des ersten Abschnitts, beim Wiederanpfiff nichts
    expect(gespielt.map((t) => t.art)).toEqual(['halbzeit']);
    expect(gespielt[0].at).toBeLessThan(ENDE_A1 + 1000);
  });
});

describe('@HT-007 Endet ein Abschnitt früher von Hand, ertönt kein zweiter Ton zur alten Zeit', () => {
  it('@HT-007 Halbzeit bei 5:40: Halbzeit-Ton höchstens 1 s nach Toms Bestätigung, bei 6:00 kein weiterer Ton', () => {
    const log = anpfiff();
    const bestaetigt = T0 + 340_000;
    const felder = ausServer([
      { ab: T0, log },
      { ab: bestaetigt, log: [...log, ev('SECTION_END', bestaetigt, 1, 340_000)] },
    ]);
    const { gespielt } = lauf(felder, bestaetigt - 2000, ENDE_A1 + 10_000);
    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].art).toBe('halbzeit');
    expect(gespielt[0].at - bestaetigt).toBeGreaterThanOrEqual(0);
    expect(gespielt[0].at - bestaetigt).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-008 Jedes Ende ertönt genau einmal, ein fortgesetztes Spiel endet erneut mit Ton', () => {
  it('@HT-008 selbst gerechnetes Ende und Nachricht (zwei offene Cockpits) ergeben genau einen Abpfiff-Ton', () => {
    const log = zweiterAbschnitt();
    // Toms Handy und Ollis Cockpit senden beide das Ende von selbst; der Server nimmt eines an, das andere ist eine Wiederholung
    const ende = ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS);
    const felder = ausServer([
      { ab: T0, log },
      { ab: ENDE_A2, log: [...log, ende] },
      { ab: ENDE_A2 + 400, log: [...log, ende] },
    ]);
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 8000);
    expect(gespielt).toHaveLength(1);
  });

  it('@HT-008 setzt Tom das zu früh beendete Spiel fort, ertönt beim neuen Ende wieder genau einmal der Abpfiff-Ton', () => {
    const log = zweiterAbschnitt();
    const beendet = [...log, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)];
    const fortgesetzt = ENDE_A2 + 30_000;
    // fortgesetzt mit 20 Sekunden Restzeit
    const weiter = [...beendet, ev('REOPEN', fortgesetzt, 2, 2 * ABSCHNITT_MS - 20_000)];
    const neuesEnde = fortgesetzt + 20_000;
    const felder = ausServer([
      { ab: T0, log },
      { ab: ENDE_A2, log: beendet },
      { ab: fortgesetzt, log: weiter },
      { ab: neuesEnde, log: [...weiter, ev('MATCH_END', neuesEnde, 2, 2 * ABSCHNITT_MS)] },
    ]);
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, neuesEnde + 8000, 100);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff', 'abpfiff']);
    expect(Math.abs(gespielt[1].at - neuesEnde)).toBeLessThanOrEqual(1000);
  });
});

describe('Regel 4: ein Schlüssel je Ende (Spiel, Phase, Abschnitt, Wiedereröffnungen)', () => {
  it('@HT-008 Abpfiff von Hand 0,5 s vor Ablauf ergibt genau einen Ton, auch wenn die Nachricht nach dem Ablauf ankommt', () => {
    const log = zweiterAbschnitt();
    const vonHand = ENDE_A2 - 500;
    // die Nachricht kommt erst 800 ms nach dem Abpfiff an, also 300 ms nach dem errechneten Ende
    const felder = (jetzt: number) => jetzt < vonHand + 800
      ? [stand(stateAus(log), CTX_11, server(0), T0)]
      : [stand(stateAus([...log, ev('MATCH_END', vonHand, 2, 2 * ABSCHNITT_MS - 500)]), CTX_11, server(0), vonHand + 800)];
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 8000);
    expect(gespielt).toHaveLength(1);
  });

  it('der Schlüssel hängt nicht an der Art des Endes: von selbst und von Hand ergeben denselben Schlüssel', () => {
    const log = zweiterAbschnitt();
    const vonSelbst = planeHallToene({ felder: [stand(stateAus(log), CTX_11, server(0), T0)], serverNow: ENDE_A2 - 2000 }, LEERES_GEDAECHTNIS);
    const vonHand = planeHallToene(
      { felder: [stand(stateAus([...log, ev('MATCH_END', ENDE_A2 - 2000, 2, 2 * ABSCHNITT_MS - 2000)]), CTX_11, server(0), ENDE_A2 - 2000)], serverNow: ENDE_A2 - 2000 },
      LEERES_GEDAECHTNIS,
    );
    const erwartet = endeSchluessel({ matchId: CTX_11.matchId, phase: 'regular', section: 2, reopenCount: 0 });
    expect(vonSelbst.toene[0].schluessel).toEqual([erwartet]);
    expect(vonHand.toene[0].schluessel).toEqual([erwartet]);
  });
});
