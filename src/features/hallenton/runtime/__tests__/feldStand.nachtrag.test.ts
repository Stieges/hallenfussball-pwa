/**
 * H3b-2b Nachträge zum Feldstand aus dem Review von H3b-2a: Befund 6 (Start ohne Netz, Rollenwechsel bei hinterherhinkender
 * Engine), N1 (neues Spiel erbt das Alter der letzten Antwort), Befund 5 (Lesen ändert nichts).
 * Werte aus `docs/anforderungen/2026-10-15_hallenton.md`, @HT-033: Laptop = Rechner der Turnierleitung, Handy = Toms Handy.
 */
import { describe, expect, it } from 'vitest';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A2, ev, stateAus, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { planSpielAus } from '../feldStandSpiele';
import { Lage, probe, spielZeile } from './feldStandTestlage';

const lokal = () => [planSpielAus(spielZeile(CTX_11, 1, 11, '14:12:00'), '2026-11-28'),
  planSpielAus(spielZeile(CTX_12, 2, 12, '14:12:00'), '2026-11-28')];

describe('@HT-033 Zeile 11 – Laptop startet ohne Netz und leitet Feld 1 selbst (Befund 6a)', () => {
  it('@HT-033 Zeile 11: Start ohne Netz → Laptop tönt einmal nach eigenem Stand, keine Warnung für das eigene Feld', async () => {
    const lage = new Lage({ start: ENDE_A2 - 30_000, lokalerSpielplan: lokal });
    lage.sb.netz = 'fehler';
    lage.leite.add(1);
    lage.eigene.set(CTX_11.matchId, stateAus(zweiterAbschnitt()));
    const { gespielt, plaene } = await probe(lage, ENDE_A2 + 6000, [], 300);
    expect(lage.fs.verfuegbarkeit()).toBe('pruefe');
    expect(lage.stand()?.quelle).toEqual({ art: 'eigenesCockpit' });
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    expect(plaene.flatMap((p) => p.warnungen)).toEqual([]);
  });

  it('@HT-033 Zeile 4 beim Start ohne Netz: ein nicht selbst geleitetes Feld tönt nicht und warnt „keine Verbindung“', async () => {
    const lage = new Lage({ start: ENDE_A2 - 30_000, felder: [1, 2], lokalerSpielplan: lokal });
    lage.sb.netz = 'fehler';
    lage.leite.add(1);
    lage.eigene.set(CTX_11.matchId, stateAus(zweiterAbschnitt()));
    const { gespielt, plaene } = await probe(lage, ENDE_A2 + 6000, [], 300);
    expect(lage.stand('field-2')?.quelle.art).toBe('server');
    expect(gespielt).toHaveLength(1);
    expect(new Set(plaene.flatMap((p) => p.warnungen).map((w) => w.feldId))).toEqual(new Set(['field-2']));
  });

  it('Gegenprobe: ohne lokalen Spielplan kennt der Laptop beim Start ohne Netz kein Spiel und tönt nicht', async () => {
    const lage = new Lage({ start: ENDE_A2 - 30_000 });
    lage.sb.netz = 'fehler';
    lage.leite.add(1);
    lage.eigene.set(CTX_11.matchId, stateAus(zweiterAbschnitt()));
    const { gespielt } = await probe(lage, ENDE_A2 + 6000, [], 300);
    expect(gespielt).toEqual([]);
  });
});

describe('@HT-033 Zeile 10 – Wechsel Handy → Laptop, die Engine des Laptops hinkt hinterher (Befund 6b)', () => {
  it('@HT-033 Zeile 10: kennt die Engine Toms Pause noch nicht, gilt der Server bis zum Aufholen – genau ein Ton zum richtigen Ende', async () => {
    const log = zweiterAbschnitt();
    const pause = ev('PAUSE', ENDE_A2 - 12_000, 2, 2 * ABSCHNITT_MS - 12_000);
    const weiter = ev('RESUME', ENDE_A2 - 2000, 2, null);
    const lage = new Lage({ start: ENDE_A2 - 20_000 });
    lage.setzeSpiel(CTX_11.matchId, { match_status: 'running' });
    lage.sende(CTX_11, [...log, pause, weiter]);
    const richtigesEnde = ENDE_A2 + 10_000;
    const quellen: string[] = [];
    const { gespielt } = await probe(lage, richtigesEnde + 6000, [
      // Laptop übernimmt bei ENDE_A2 - 6 s; seine Engine kennt erst nur den Abschnitt, die Pause holt sie 4 s später auf
      { um: ENDE_A2 - 6000, tu: () => { lage.leite.add(1); lage.eigene.set(CTX_11.matchId, stateAus(log)); quellen.push(lage.stand()?.quelle.art ?? '-'); } },
      { um: ENDE_A2 - 1000, tu: () => { quellen.push(lage.stand()?.quelle.art ?? '-'); } },
      { um: ENDE_A2 + 2000, tu: () => { lage.eigene.set(CTX_11.matchId, stateAus([...log, pause, weiter])); quellen.push(lage.stand()?.quelle.art ?? '-'); } },
    ], 50);
    expect(quellen).toEqual(['server', 'server', 'eigenesCockpit']);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - richtigesEnde)).toBeLessThanOrEqual(1000);
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
    expect(stand?.quelle).toEqual({ art: 'server', antwortAlterMs: 1000 });
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
