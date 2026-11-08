/**
 * H3b-2b Nachträge zum Feldstand aus dem Review von H3b-2a: Befund 6a (Start ohne Netz; seit H3b-4 nach Regel 2 ohne Ton,
 * mit Warnung; der Rollenwechsel 6b entfällt, es gibt nur den Stand am Server), N1 (neues Spiel erbt das Alter der letzten Antwort), Befund 5 (Lesen ändert nichts).
 * Werte aus `docs/anforderungen/2026-10-15_hallenton.md`, @HT-033: Laptop = Rechner der Turnierleitung, Handy = Toms Handy.
 */
import { describe, expect, it } from 'vitest';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A2, ev, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { planSpielAus } from '../feldStandSpiele';
import { Lage, probe, spielZeile } from './feldStandTestlage';

const lokal = () => [planSpielAus(spielZeile(CTX_11, 1, 11, '14:12:00'), '2026-11-28'),
  planSpielAus(spielZeile(CTX_12, 2, 12, '14:12:00'), '2026-11-28')];

describe('@HT-033 Zeile 11 – Laptop startet ohne Netz und leitet Feld 1 selbst (Befund 6a, Regel 2 seit 07.11.)', () => {
  it('@HT-033 Zeile 11: Start ohne Netz → kein Hallenton nach unsicherem Stand; beide Felder warnen „keine Verbindung“', async () => {
    const lage = new Lage({ start: ENDE_A2 - 30_000, felder: [1, 2], lokalerSpielplan: lokal });
    lage.sb.netz = 'fehler';
    const { gespielt, plaene } = await probe(lage, ENDE_A2 + 6000, [], 300);
    expect(lage.fs.verfuegbarkeit()).toBe('pruefe');
    expect(lage.stand()?.antwortAlterMs).toBe(Number.POSITIVE_INFINITY);
    expect(gespielt).toEqual([]);
    expect(new Set(plaene[plaene.length - 1].warnungen.map((w) => w.feldId))).toEqual(new Set(['field-1', 'field-2']));
  });

  it('Gegenprobe: ohne lokalen Spielplan kennt der Laptop beim Start ohne Netz kein Spiel und tönt nicht', async () => {
    const lage = new Lage({ start: ENDE_A2 - 30_000 });
    lage.sb.netz = 'fehler';
    const { gespielt } = await probe(lage, ENDE_A2 + 6000, [], 300);
    expect(gespielt).toEqual([]);
  });
});

describe('N1 – ein neues aktuelles Spiel erbt das Alter der letzten Antwort', () => {
  it('Spiel 12 übernimmt Feld 1, seine erste Abfrage scheitert → Alter der letzten Antwort statt „nie beantwortet“', async () => {
    const lage = new Lage({ start: ENDE_A2 - 20_000 });
    lage.setzeSpiel(CTX_11.matchId, { match_status: 'running' });
    lage.sende(CTX_11, zweiterAbschnitt());
    await lage.runde();
    lage.vor(9000);
    await lage.runde();
    // Spiel 11 ist im Spielplan beendet, Spiel 12 angepfiffen; die Sammelabfrage scheitert, der Spielplan nicht
    lage.setzeSpiel(CTX_11.matchId, { match_status: 'finished', score_a: 1, score_b: 0 });
    lage.setzeSpiel(CTX_12.matchId, { field: 1, match_status: 'running' });
    lage.sb.tabellenFehler.add('match_events');
    lage.vor(1000);
    await lage.runde();
    const stand = lage.stand();
    expect(stand?.ctx.matchId).toBe(CTX_12.matchId);
    expect(stand?.antwortAlterMs).toBe(1000);
  });
});

describe('Befund 5 – Lesen ändert nichts', () => {
  it('naechsterAbfrageTaktMs löst keine Abfrage aus und ändert die Wahl des aktuellen Spiels nicht', async () => {
    const lage = new Lage({ start: ENDE_A2 - 20_000 });
    await lage.runde();
    const vorher = lage.sb.abfragen.length;
    lage.setzeSpiel(CTX_11.matchId, { match_status: 'running' });
    for (let i = 0; i < 20; i += 1) {
      lage.vor(1000);
      expect(lage.fs.naechsterAbfrageTaktMs()).toBe(5000); // der zuletzt gelesene Stand: nicht angepfiffen
    }
    expect(lage.sb.abfragen.length).toBe(vorher);
  });
});

describe('k6 (Fixrunde 1) – ein gescheiterter Spielplan zählt nicht als gescheiterter Versuch (Ruling N-2)', () => {
  it('Spiel 11 endet, der sofortige Spielplan scheitert, die Sammelabfrage ist nicht fällig → kein „gescheitert“, Takt bleibt 5 s', async () => {
    const lage = new Lage({ start: ENDE_A2 - 3000 });
    lage.setzeSpiel(CTX_11.matchId, { match_status: 'running' });
    lage.sende(CTX_11, zweiterAbschnitt());
    await lage.runde();
    lage.vor(1000);
    lage.sende(CTX_11, [ev('MATCH_END', ENDE_A2 - 2000, 2, 2 * ABSCHNITT_MS - 2000)]);
    await lage.runde();
    const ereignisse = lage.sb.abfragenAuf('match_events').length;
    lage.sb.tabellenFehler.add('tournaments');
    lage.sb.tabellenFehler.add('matches');
    lage.vor(1000);
    await lage.runde();
    expect(lage.sb.abfragenAuf('matches').length + lage.sb.abfragenAuf('tournaments').length).toBeGreaterThanOrEqual(3);
    expect(lage.sb.abfragenAuf('match_events')).toHaveLength(ereignisse);
    expect(lage.fs.letzterVersuchGescheitert()).toBe(false);
  });
});
