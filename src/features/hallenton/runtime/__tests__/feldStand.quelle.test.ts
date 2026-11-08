/**
 * H3b-2a Feldstand: immer der Stand am Server nach Regel 2 (H3b-4, @HT-033 Zeilen 1, 2, 3, 10, 11), Gegenbeispiele (Spiel wechselt, Antwort
 * hängt, nicht angepfiffen, Gast, Turnierende) und die Abfrage selbst (Filter wie `makeFetchConfirmed`, Seiten, Wasserstand).
 * Werte aus `docs/anforderungen/2026-10-15_hallenton.md`: Laptop = Rechner der Turnierleitung, Handy = Toms Handy.
 */
import { describe, expect, it } from 'vitest';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A2, T0, anpfiff, ev, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { ABFRAGE_ABBRUCH_MS } from '../feldStandAbfragen';
import { HALTEN_NACH_WECHSEL_MS } from '../feldStand';
import { Lage, flush, probe } from './feldStandTestlage';

function lageImZweitenAbschnitt(start: number, log = zweiterAbschnitt()): Lage {
  const lage = new Lage({ start });
  lage.setzeSpiel(CTX_11.matchId, { match_status: 'running' });
  lage.sende(CTX_11, log);
  return lage;
}

describe('@HT-033 Die vier Regeln entscheiden jede Kombination – immer der Stand am Server (Regel 2)', () => {
  it('@HT-033 Zeile 1: Handy leitet, Laptop ist Lautsprecher → Stand am Server, Ton im Gleichtakt mit dem Monitor', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 10_000);
    const { gespielt } = await probe(lage, ENDE_A2 + 5000, [], 300);
    expect(lage.stand()?.antwortAlterMs).toBeLessThanOrEqual(1000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    // gelesen wird nur Spielplan und Ereignisse
    expect(new Set(lage.sb.abfragen.map((a) => a.tabelle))).toEqual(new Set(['rpc:is_real_account', 'tournaments', 'matches', 'match_events']));
  });

  it('@HT-033 Zeile 2: Laptop leitet mit Netz und hält an → einmal, nach dem Stand am Server wie der Monitor (Ende nach dem Weiterlaufen)', async () => {
    // die Einträge des Laptops kommen wie die jedes leitenden Geräts über den Server
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 15_000);
    const halt = ENDE_A2 - 10_000;
    const weiter = halt + 5000;
    const { gespielt } = await probe(lage, ENDE_A2 + 12_000, [
      { um: halt, tu: () => lage.sende(CTX_11, [ev('PAUSE', halt, 2, null)]) },
      { um: weiter, tu: () => lage.sende(CTX_11, [ev('RESUME', weiter, 2, null)]) },
    ], 300);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(gespielt[0].at - (ENDE_A2 + 5000))).toBeLessThanOrEqual(1000);
  });

  it('@HT-033 Zeile 3: Handy ohne Netz hält an → der Laptop nimmt den Stand am Server (ohne Pause)', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 12_000);
    lage.vor(3000);
    await lage.runde();
    expect(lage.stand()?.state.status).toBe('running');
  });

  it('@HT-033 Zeile 10: Wechsel Handy → Laptop im Spiel → weiter genau ein Ton (die Einträge des Laptops kommen über den Server)', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 20_000);
    const wechsel = ENDE_A2 - 8000;
    const beobachtet: { vorher?: number; nachher?: number } = {};
    const { gespielt } = await probe(lage, ENDE_A2 + 6000, [
      { um: wechsel, tu: () => { beobachtet.vorher = lage.stand()?.bekanntSeit; } },
      { um: wechsel + 2000, tu: () => { beobachtet.nachher = lage.stand()?.bekanntSeit; } },
    ], 50);
    expect(beobachtet.nachher).toBe(beobachtet.vorher);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-033 Zeile 11: Laptop leitet ohne Netz → kein Hallenton nach unsicherem Stand, Warnung „keine Verbindung“', async () => {
    const lage = new Lage({ start: ENDE_A2 - 30_000 });
    await lage.runde(); // Spielplan bekannt: Spiel 11 noch nicht angepfiffen
    lage.sb.netz = 'fehler'; // Anpfiff und zweiter Abschnitt nur auf dem Laptop, der Server kennt sie nicht
    const { gespielt, plaene } = await probe(lage, ENDE_A2 + 6000, [], 300);
    expect(gespielt).toEqual([]);
    expect(plaene[plaene.length - 1].warnungen).toEqual([{ feldId: 'field-1', grund: 'keineVerbindung' }]);
  });
});

describe('Gegenbeispiel: das Spiel auf dem Feld wechselt', () => {
  it('Spiel 11 endet von Hand → Ton für Spiel 11, Spielplan sofort neu, danach Spiel 12 mit Wasserstand 0 und neuem bekanntSeit', async () => {
    const vonHand = ENDE_A2 - 30_000;
    const lage = lageImZweitenAbschnitt(vonHand - 5000);
    const beobachtet: { planAbfragen?: number; planVorher?: number } = {};
    const { gespielt } = await probe(lage, vonHand + HALTEN_NACH_WECHSEL_MS + 3000, [
      {
        um: vonHand, tu: () => {
          beobachtet.planVorher = lage.sb.abfragenAuf('matches').length;
          lage.sende(CTX_11, [ev('MATCH_END', vonHand, 2, 2 * ABSCHNITT_MS - 30_000)]);
          lage.setzeSpiel(CTX_11.matchId, { match_status: 'finished', score_a: 2, score_b: 1 });
        },
      },
      { um: vonHand + 2500, tu: () => { beobachtet.planAbfragen = lage.sb.abfragenAuf('matches').length; } },
    ], 300);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(gespielt[0].at - vonHand).toBeLessThanOrEqual(1000);
    expect((beobachtet.planAbfragen ?? 0) - (beobachtet.planVorher ?? 0)).toBeGreaterThanOrEqual(1); // nicht erst nach 10 s
    const stand = lage.stand();
    expect(stand?.ctx.matchId).toBe(CTX_12.matchId);
    expect(stand?.bekanntSeit).toBeGreaterThan(vonHand + 5000);
    const letzte = lage.sb.abfragenAuf('match_events').at(-1);
    expect(letzte?.filter).toContain('in match_id 1');
    expect(letzte?.filter).toContain('gt seq 0');
  });

  it('der Spielplan meldet Spiel 11 schon beendet, bevor sein Ende von Hand im Stand ist → Spiel 11 bleibt gehalten, sein Ton kommt', async () => {
    const von = ENDE_A2 - 40_000;
    const lage = lageImZweitenAbschnitt(von);
    // 100 ms vor dem nächsten Lesen des Spielplans (alle 10 s): Ende von Hand und Spalten der Turnierkopie zugleich am Server
    const vonHand = von + 10_000 - 100;
    const { gespielt } = await probe(lage, vonHand + 4000, [
      {
        um: vonHand, tu: () => {
          lage.sende(CTX_11, [ev('MATCH_END', vonHand, 2, 2 * ABSCHNITT_MS - 30_100)]);
          lage.setzeSpiel(CTX_11.matchId, { match_status: 'finished', score_a: 2, score_b: 1 });
        },
      },
    ]);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(gespielt[0].at - vonHand).toBeLessThanOrEqual(1000);
    expect(lage.stand()?.ctx.matchId).toBe(CTX_11.matchId);
  });

  it('Spiel 11 hat ein eingetragenes Ergebnis ohne Anpfiff (Schnelleingabe) → das aktuelle Spiel ist Spiel 12', async () => {
    const lage = new Lage({ start: T0 - 5000 });
    lage.setzeSpiel(CTX_11.matchId, { score_a: 3, score_b: 0 });
    await lage.runde();
    expect(lage.stand()?.ctx.matchId).toBe(CTX_12.matchId);
  });

  it('das neue Spiel wird angepfiffen → sein Stand kommt an, bekanntSeit springt auf die Antwort', async () => {
    const lage = new Lage({ start: T0 - 5000 });
    lage.setzeSpiel(CTX_11.matchId, { match_status: 'finished', score_a: 1, score_b: 0 });
    await lage.runde();
    expect(lage.stand()?.ctx.matchId).toBe(CTX_12.matchId);
    const vorher = lage.stand()?.bekanntSeit;
    lage.vor(5000);
    lage.sende(CTX_12, anpfiff(T0));
    lage.setzeSpiel(CTX_12.matchId, { match_status: 'running' });
    await lage.runde();
    expect(lage.stand()?.state.status).toBe('running');
    expect(lage.stand()?.bekanntSeit).toBe(T0);
    expect(lage.stand()?.bekanntSeit).not.toBe(vorher);
  });
});

describe('Gegenbeispiel: die Antwort hängt', () => {
  it('Abbruch nach 3 s über das Signal, letzteAntwortAt bleibt unverändert', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 60_000);
    await lage.runde();
    const zuletzt = lage.fs.letzteAntwortAt();
    lage.sb.netz = 'haengt';
    lage.vor(1000);
    let fertig = false;
    const lauf = lage.fs.aktualisieren(lage.uhr.jetzt()).then(() => {
      fertig = true;
    });
    await flush();
    lage.vor(ABFRAGE_ABBRUCH_MS - 1);
    await flush();
    expect(fertig).toBe(false);
    lage.vor(1);
    await lauf;
    expect(fertig).toBe(true);
    expect(lage.fs.letzteAntwortAt()).toBe(zuletzt);
    expect(lage.sb.abfragenAuf('match_events').at(-1)?.mitSignal).toBe(true);
  });

  it('während eine Runde läuft, startet ein zweiter Aufruf keine zweite Abfrage', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 60_000);
    await lage.runde();
    lage.sb.netz = 'haengt';
    lage.vor(1000);
    const a = lage.fs.aktualisieren(lage.uhr.jetzt());
    await flush();
    const b = lage.fs.aktualisieren(lage.uhr.jetzt() + 250);
    await flush();
    expect(lage.sb.abfragenAuf('match_events')).toHaveLength(2);
    lage.vor(ABFRAGE_ABBRUCH_MS);
    await Promise.all([a, b]);
  });
});

describe('Gegenbeispiel: nicht angepfiffen', () => {
  it('kein Spiel auf einem Lautsprecher-Feld angepfiffen und die Antwort frisch → 5-s-Takt', async () => {
    const lage = new Lage({ start: T0 - 60_000 });
    await lage.runde();
    expect(lage.stand()?.state.status).toBe('scheduled');
    expect(lage.fs.naechsterAbfrageTaktMs()).toBe(5000);
    lage.vor(2500);
    await lage.runde();
    expect(lage.sb.abfragenAuf('match_events')).toHaveLength(1); // 2,5 s: Antwort frisch, keine neue Abfrage
  });

  // Ruling H3b-2b (Ledger 07.11., ersetzt die Auslegung aus H3b-2a): im Ruhezustand gilt N-2 erst nach einem gescheiterten
  // Versuch, sonst bleibt es beim 5-s-Takt
  it('N-2 im Ruhezustand: eine Antwort älter als 3 s allein macht den Takt nicht enger (5 s)', async () => {
    const lage = new Lage({ start: T0 - 60_000 });
    await lage.runde();
    lage.vor(3250);
    expect(lage.fs.naechsterAbfrageTaktMs()).toBe(5000);
    await lage.runde();
    expect(lage.sb.abfragenAuf('match_events')).toHaveLength(1);
    lage.vor(1750);
    await lage.runde();
    expect(lage.sb.abfragenAuf('match_events')).toHaveLength(2);
  });

  it('N-2 im Ruhezustand: nach einem gescheiterten Versuch fragt der Lautsprecher jede Sekunde nach', async () => {
    const lage = new Lage({ start: T0 - 60_000 });
    await lage.runde();
    lage.sb.netz = 'fehler';
    lage.vor(5000);
    await lage.runde();
    expect(lage.fs.letzterVersuchGescheitert()).toBe(true);
    expect(lage.fs.naechsterAbfrageTaktMs()).toBe(1000);
    lage.vor(1000);
    await lage.runde();
    expect(lage.sb.abfragenAuf('match_events')).toHaveLength(3);
    lage.sb.netz = 'ok';
    lage.vor(1000);
    await lage.runde();
    expect(lage.fs.letzterVersuchGescheitert()).toBe(false);
    expect(lage.fs.naechsterAbfrageTaktMs()).toBe(5000);
  });

  it('Gegenprobe: angepfiffen → 1-s-Takt; meldet der Planer 1000, gilt das Minimum', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 60_000);
    await lage.runde();
    expect(lage.fs.naechsterAbfrageTaktMs()).toBe(1000);
    const ruhe = new Lage({ start: T0 - 60_000 });
    await ruhe.runde();
    expect(ruhe.fs.naechsterAbfrageTaktMs(1000)).toBe(1000);
  });
});

describe('Gegenbeispiel: ohne Konto und nach dem Turnierende', () => {
  it('Gast (is_real_account falsch) → nicht verfügbar, keine Abfrage, kein Stand', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 60_000);
    lage.sb.echtesKonto = false;
    await lage.runde();
    lage.vor(10_000);
    await lage.runde();
    expect(lage.fs.verfuegbarkeit()).toBe('nichtVerfuegbar');
    expect(lage.sb.abfragen.map((a) => a.tabelle)).toEqual(['rpc:is_real_account']);
    expect(lage.fs.staende()).toEqual([]);
  });

  it('Turnier abgeschlossen → Zustand turnierBeendet ohne Ausnahme, danach keine Abfrage mehr', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 60_000);
    lage.sb.tabellen.tournaments = [{ ...lage.sb.tabellen.tournaments[0], lifecycle_status: 'finished' }];
    await lage.runde();
    const anzahl = lage.sb.abfragen.length;
    lage.vor(20_000);
    await lage.runde();
    expect(lage.fs.verfuegbarkeit()).toBe('turnierBeendet');
    expect(lage.sb.abfragen).toHaveLength(anzahl);
    expect(lage.fs.staende()).toEqual([]);
  });

  it('Antwort 55000 → Zustand turnierBeendet ohne Ausnahme', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 60_000);
    await lage.runde();
    lage.sb.fehlerCode = '55000';
    lage.vor(1000);
    await expect(lage.runde()).resolves.toBeUndefined();
    expect(lage.fs.verfuegbarkeit()).toBe('turnierBeendet');
    expect(lage.fs.staende()).toEqual([]);
  });
});

describe('Sammelabfrage der Ereignisse', () => {
  it('eine Abfrage für alle aktuellen Spiele, gleiche Filter wie makeFetchConfirmed; vorläufige und alte Zeilen zählen nicht', async () => {
    const lage = new Lage({ start: ENDE_A2 - 60_000, felder: [1, 2], spiele: undefined });
    lage.sb.tabellen.matches = [
      { ...lage.sb.tabellen.matches[0], match_status: 'running' },
      { ...lage.sb.tabellen.matches[1], field: 2, match_status: 'running' },
    ];
    lage.sende(CTX_11, zweiterAbschnitt());
    lage.sende(CTX_12, anpfiff(T0 + 30_000));
    lage.sende(CTX_11, [ev('GOAL', ENDE_A2 - 70_000, 2, 2 * ABSCHNITT_MS - 70_000, { teamId: CTX_11.teamAId })], { review_state: 'pending' });
    lage.sende(CTX_11, [ev('GOAL', ENDE_A2 - 65_000, 2, 2 * ABSCHNITT_MS - 65_000, { teamId: CTX_11.teamAId })], { event_format: null });
    await lage.runde();
    const abfragen = lage.sb.abfragenAuf('match_events');
    expect(abfragen).toHaveLength(1);
    expect(abfragen[0].filter).toEqual(['in match_id 2', 'not event_format is null', 'is review_state null', 'gt seq 0']);
    expect(lage.stand('field-1')?.state.goals).toEqual([]);
    expect(lage.stand('field-2')?.state.status).toBe('running');
  });

  it('@HT-051 bekanntSeit ist die Serverzeit der Antwort mit dem neuen Stand, auch wenn der Stand erst später gelesen wird', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 60_000);
    await lage.runde();
    expect(lage.stand()?.state.status).toBe('running');
    lage.vor(1000);
    lage.sende(CTX_11, [ev('PAUSE', lage.uhr.jetzt() - 200, 2, null)]);
    await lage.runde();
    const antwort = lage.fs.letzteAntwortAt();
    lage.vor(400);
    expect(lage.stand()?.state.status).toBe('paused');
    expect(lage.stand()?.bekanntSeit).toBe(antwort);
  });

  it('Wasserstand je Spiel: die nächste Abfrage beginnt über dem höchsten bekannten seq, mehr als eine Seite wird nachgeladen', async () => {
    const lage = lageImZweitenAbschnitt(ENDE_A2 - 300_000);
    const viele = Array.from({ length: 520 }, (_, i) => ev(i % 2 === 0 ? 'PAUSE' : 'RESUME', ENDE_A2 - 299_000 + i * 100, 2, null));
    lage.sende(CTX_11, viele);
    await lage.runde();
    const seiten = lage.sb.abfragenAuf('match_events');
    expect(seiten).toHaveLength(2);
    expect(Object.keys(lage.stand()?.state.accepted ?? {})).toHaveLength(3 + 520);
    const hoechste = Math.max(...lage.sb.tabellen.match_events.map((z) => Number(z.seq)));
    lage.vor(1000);
    await lage.runde();
    expect(lage.sb.abfragenAuf('match_events').at(-1)?.filter).toContain(`gt seq ${hoechste}`);
  });
});
