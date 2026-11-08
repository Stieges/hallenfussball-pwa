/**
 * H3b-2a Fixrunde 1 (Review-Befunde 1, 2, 4): eine unlesbare Ereigniszeile trifft nur ihr Spiel, die Konto-Prüfung wird
 * gedrosselt, und je Spiel kommt nur an, was über seinem eigenen Wasserstand liegt. Werte wie im Record
 * `docs/anforderungen/2026-10-15_hallenton.md`: Spiel 11 auf Feld 1, Spiel 12 auf Feld 2, Rechner der Turnierleitung als
 * Lautsprecher für beide Felder (@HT-002, @HT-011).
 */
import { describe, expect, it } from 'vitest';
import {
  CTX_11, CTX_12, ENDE_A2, T0, anpfiff, ev, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { ladeEreignisse } from '../feldStandAbfragen';
import { SPIELPLAN_TAKT_MS } from '../feldStand';
import { Lage, flush, probe, spielZeile } from './feldStandTestlage';

function zweiFelder(start: number): Lage {
  return new Lage({
    start,
    felder: [1, 2],
    spiele: [
      spielZeile(CTX_11, 1, 11, '14:12:00', { match_status: 'running' }),
      spielZeile(CTX_12, 2, 12, '14:12:00', { match_status: 'running' }),
    ],
  });
}

describe('Gegenbeispiel: eine unlesbare Ereigniszeile (z. B. neuer Ereignistyp eines neueren Cockpits)', () => {
  // Spiel 12 beginnt 30 s nach Spiel 11 und endet 30 s nach ihm
  async function lauf() {
    const lage = zweiFelder(ENDE_A2 - 20_000);
    lage.sende(CTX_11, zweiterAbschnitt());
    lage.sende(CTX_12, zweiterAbschnitt(T0 + 30_000));
    await lage.runde();
    // in derselben Antwort: lesbare Pause, unlesbare Zeile, lesbare Fortsetzung – ohne die unlesbare ist der Stand falsch
    lage.sende(CTX_12, [ev('PAUSE', ENDE_A2 - 16_000, 2, null)]);
    const unbekannt = ev('RESUME', ENDE_A2 - 15_000, 2, null);
    lage.sende(CTX_12, [{ ...unbekannt, type: 'ZEITSTRAFE_KUENFTIG' as typeof unbekannt.type }]);
    lage.sende(CTX_12, [ev('GOAL', ENDE_A2 - 14_000, 2, null, { teamId: CTX_12.teamAId })]);
    const ergebnis = await probe(lage, ENDE_A2 + 40_000, [], 300);
    return { ...ergebnis, lage };
  }

  it('@HT-002 Feld 1 bleibt frisch und tönt einmal; Feld 2 tönt nicht nach einem Stand ohne die unlesbare Zeile', async () => {
    const { gespielt } = await lauf();
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    expect(gespielt[0].schluessel.every((s) => s.startsWith(CTX_11.matchId))).toBe(true);
  });

  it('@HT-011 nur Feld 2 gilt als nicht beantwortet: seine Antwort altert, der Planer warnt nur für Feld 2', async () => {
    const { lage, plaene } = await lauf();
    expect(lage.stand('field-1')?.antwortAlterMs).toBeLessThanOrEqual(1000);
    expect(lage.stand('field-2')?.antwortAlterMs).toBeGreaterThan(5000);
    expect(plaene[plaene.length - 1].warnungen).toEqual([{ feldId: 'field-2', grund: 'keineVerbindung' }]);
    expect(lage.fs.letzteAntwortAt()).toBeGreaterThan(lage.uhr.jetzt() - 1500);
  });

  it('Spiel 12 bleibt beim alten Stand (auch die lesbaren Zeilen davor und danach fehlen) und ist als unlesbar gemeldet', async () => {
    const { lage } = await lauf();
    expect(lage.stand('field-2')?.state.status).toBe('running');
    expect(lage.stand('field-2')?.state.goals).toEqual([]);
    expect(lage.fs.unlesbareSpiele()).toEqual([CTX_12.matchId]);
  });
});

describe('Konto-Prüfung ohne Netz', () => {
  it('scheitert is_real_account, fragt der Lautsprecher erst im Abstand des Spielplans erneut, nicht in jedem Takt', async () => {
    const lage = zweiFelder(T0);
    lage.sb.netz = 'fehler';
    for (let t = 0; t < SPIELPLAN_TAKT_MS; t += 250) {
      await lage.runde();
      lage.vor(250);
    }
    expect(lage.sb.rpcAufrufe).toBe(1);
    expect(lage.fs.verfuegbarkeit()).toBe('pruefe');
    lage.sb.netz = 'ok';
    await lage.runde();
    expect(lage.sb.rpcAufrufe).toBe(2);
    expect(lage.fs.verfuegbarkeit()).toBe('verfuegbar');
  });
});

describe('Wasserstand je Spiel bei zwei aktuellen Spielen', () => {
  it('Spiel 11 bei seq 103, Spiel 12 neu bei 0: abgefragt ab 0, aber für Spiel 11 kommt nur, was über 103 liegt', async () => {
    const lage = zweiFelder(ENDE_A2 - 60_000);
    lage.sende(CTX_11, zweiterAbschnitt()); // seq 101–103
    const neu11 = ev('PAUSE', ENDE_A2 - 59_000, 2, null);
    lage.sende(CTX_11, [neu11]); // seq 104
    lage.sende(CTX_12, anpfiff(T0 + 30_000)); // seq 105
    const ergebnis = await ladeEreignisse(lage.sb.client, new Map([[CTX_11.matchId, 103], [CTX_12.matchId, 0]]), lage.uhr.gruppe('haupt'));
    await flush();
    expect(lage.sb.abfragenAuf('match_events')[0].filter).toContain('gt seq 0');
    expect(ergebnis.ok && ergebnis.wert.neu.get(CTX_11.matchId)?.map((e) => e.id)).toEqual([neu11.id]);
    expect(ergebnis.ok && ergebnis.wert.neu.get(CTX_12.matchId)?.map((e) => e.seq)).toEqual([105]);
  });
});
