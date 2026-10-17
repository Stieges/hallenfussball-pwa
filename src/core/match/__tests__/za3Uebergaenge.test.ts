/**
 * ZA-3 – Übergänge für „Spiel leiten“ (TS-Seite; der SQL-Zwilling läuft über dieselben Fixtures in
 * scripts/match-engine-parity.sh und scripts/append-match-events-check.sh).
 *
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md, @SL-066/-067/-074/-075/
 * -085/-087/-109; 2026-09-24_helfer-am-turniertag.md, @HE-042). Grenzwerte 30 s / 120 s aus dem Brief
 * (ZA-3 Schritt 2) als zusätzliche Fixtures. Jede Beispielzeile prüft den Ausgang ihres Ereignisses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyBatch, continueLog, type EventResult } from '../reduceMatch';
import { initialState } from '../applyEvent';
import type { EngineEvent, MatchContext, MatchState } from '../types';

interface FixtureDoc {
  ctx: MatchContext;
  mode: 'log' | 'batch';
  prior?: EngineEvent[];
  events: EngineEvent[];
}

interface Lauf {
  state: MatchState;
  results: EventResult[];
  events: EngineEvent[];
}

const fixturesDir = path.join(__dirname, '..', '__fixtures__');

function lauf(datei: string): Lauf {
  const doc = JSON.parse(fs.readFileSync(path.join(fixturesDir, datei), 'utf-8')) as FixtureDoc;
  const vorher = continueLog(initialState(doc.ctx), doc.prior ?? [], doc.ctx).state;
  const ergebnis = doc.mode === 'log' ? continueLog(vorher, doc.events, doc.ctx) : applyBatch(vorher, doc.events, doc.ctx);
  return { state: ergebnis.state, results: ergebnis.results, events: doc.events };
}

/** Ergebnis des n-ten Ereignisses eines Typs (0-basiert) im Ereignis-Teil der Fixture. */
function ergebnisVon(l: Lauf, typ: EngineEvent['type'], n = 0): EventResult & { event: EngineEvent } {
  const event = l.events.filter((e) => e.type === typ)[n];
  const result = l.results.find((r) => r.id === event.id);
  if (!result) {
    throw new Error(`kein Ergebnis für ${typ} #${n}`);
  }
  return { ...result, event };
}

describe('@SL-085 Bei angehaltener Uhr lässt sich jeder Eintrag erfassen (Uhr bei 4:12 angehalten)', () => {
  const l = lauf('59a-pause-jeder-eintrag.json');
  it.each([
    { eintrag: 'ein Tor für FC Nord, Nr. 7', typ: 'GOAL' as const },
    { eintrag: 'ein Eigentor der Nummer 4 von SV Süd', typ: 'OWN_GOAL' as const },
    { eintrag: 'ein Foul für SV Süd', typ: 'FOUL' as const },
    { eintrag: 'eine Gelbe Karte für SV Süd, Nr. 5', typ: 'YELLOW_CARD' as const },
    { eintrag: 'eine Zeitstrafe für SV Süd, Nr. 5', typ: 'TIME_PENALTY' as const },
  ])('@SL-085 $eintrag: der Eintrag wird angenommen und steht bei 4:12', ({ typ }) => {
    const r = ergebnisVon(l, typ);
    expect(r.status).toBe('accepted');
    expect(l.state.accepted[r.event.id].clockMs).toBe(4 * 60_000 + 12_000);
    expect(l.state.status).toBe('paused');
  });

  it('@SL-085 Tor und Eigentor zählen bei angehaltener Uhr (2:0 für FC Nord), die Uhr bleibt bei 4:12', () => {
    expect(l.state.scores.teamA.regular).toBe(2);
    expect(l.state.clock).toEqual({ running: false, elapsedMs: 252_000, anchorAt: null });
  });
});

describe('@SL-087 In der Halbzeitpause lassen sich nur Karten und Zeitstrafen erfassen', () => {
  const l = lauf('59b-halbzeitpause-karte-und-zeitstrafe.json');
  it.each([
    { eintrag: 'eine Gelbe Karte für SV Süd, Nr. 5', typ: 'YELLOW_CARD' as const, status: 'accepted', code: undefined },
    { eintrag: 'eine Zeitstrafe für SV Süd, Nr. 5', typ: 'TIME_PENALTY' as const, status: 'accepted', code: undefined },
    { eintrag: 'ein Tor für FC Nord', typ: 'GOAL' as const, status: 'rejected', code: 'INVALID_TRANSITION' },
    { eintrag: 'ein Foul für SV Süd', typ: 'FOUL' as const, status: 'rejected', code: 'INVALID_TRANSITION' },
  ])('@SL-087 $eintrag → $status', ({ typ, status, code }) => {
    const r = ergebnisVon(l, typ);
    expect(r.status).toBe(status);
    expect(r.code).toBe(code);
    expect(l.state.status).toBe('section_break');
  });
});

describe('@SL-066 / @SL-067 Rückgängig und der versehentliche Anpfiff', () => {
  it('@SL-066 vor 10 Sekunden angepfiffen, nichts eingetragen: Spiel ist nicht angepfiffen und wieder bereit', () => {
    const l = lauf('60a-anpfiff-zuruecknehmen-10s.json');
    expect(ergebnisVon(l, 'RETRACT').status).toBe('accepted');
    expect(l.state.status).toBe('scheduled');
    expect(l.state.clock).toEqual({ running: false, elapsedMs: 0, anchorAt: null });
    expect(l.state.rules).toBeNull();
  });

  it('@SL-066 Grenze: genau 30 Sekunden danach geht es noch, danach ist ein neuer Anpfiff möglich', () => {
    const l = lauf('60b-anpfiff-zuruecknehmen-30s-grenze.json');
    expect(ergebnisVon(l, 'RETRACT').status).toBe('accepted');
    expect(ergebnisVon(l, 'MATCH_START', 1).status).toBe('accepted');
    expect(l.state.status).toBe('running');
  });

  it.each([
    { lage: 'vor 40 Sekunden, ohne Eintrag', datei: '60c-anpfiff-40s-nicht-zuruecknehmbar.json' },
    { lage: 'vor 31 Sekunden, ohne Eintrag (Grenze)', datei: '60d-anpfiff-31s-nicht-zuruecknehmbar.json' },
  ])('@SL-067 $lage: Rückgängig nimmt nichts zurück, Spiel 11 läuft weiter', ({ datei }) => {
    const l = lauf(datei);
    const r = ergebnisVon(l, 'RETRACT');
    expect(r.status).toBe('rejected');
    expect(r.code).toBe('INVALID_PAYLOAD');
    expect(l.state.status).toBe('running');
  });

  it('@SL-067 vor 20 Sekunden mit Foul für SV Süd: Rückgängig nimmt das Foul zurück, nicht den Anpfiff', () => {
    const l = lauf('60e-anpfiff-20s-mit-foul.json');
    expect(ergebnisVon(l, 'RETRACT', 0).status).toBe('rejected');
    expect(ergebnisVon(l, 'RETRACT', 1).status).toBe('accepted');
    expect(ergebnisVon(l, 'RETRACT', 2).status).toBe('rejected');
    expect(l.state.status).toBe('running');
    expect(l.state.retracted).toEqual([ergebnisVon(l, 'FOUL').event.id]);
  });
});

describe('@SL-109 Rückgängig nimmt die Korrektur der Uhr zurück, aber nie Pause, Halbzeit oder Abpfiff', () => {
  it('@SL-109 Spielzeit von 3:30 auf 3:10 korrigiert: Spielzeit wieder ohne Korrektur, das Foul zählt weiter', () => {
    const l = lauf('61a-uhrkorrektur-zuruecknehmen.json');
    expect(ergebnisVon(l, 'RETRACT').status).toBe('accepted');
    // 5 s nach dem Rückgängig stünde die Uhr ohne Korrektur bei 3:35 (Anpfiff bei at 1000).
    const { elapsedMs, anchorAt } = l.state.clock;
    expect(elapsedMs + (216_000 - (anchorAt ?? 0))).toBe(3 * 60_000 + 35_000);
    expect(l.state.fouls).toHaveLength(1);
    expect(l.state.retracted).not.toContain(ergebnisVon(l, 'FOUL').event.id);
  });

  it('@SL-109 Uhr angehalten: das Foul ist zurückgenommen, die Uhr bleibt angehalten; die Pause selbst nie', () => {
    const l = lauf('61b-uhr-angehalten-foul-zurueck.json');
    expect(ergebnisVon(l, 'RETRACT', 0).status).toBe('accepted');
    expect(ergebnisVon(l, 'RETRACT', 1).code).toBe('INVALID_PAYLOAD');
    expect(l.state.status).toBe('paused');
    expect(l.state.fouls).toHaveLength(0);
  });

  it('@SL-109 Halbzeitpause begonnen: das Foul ist zurückgenommen, die Halbzeitpause läuft weiter; die Halbzeit selbst nie', () => {
    const l = lauf('61c-halbzeitpause-foul-zurueck.json');
    expect(ergebnisVon(l, 'RETRACT', 0).status).toBe('accepted');
    expect(ergebnisVon(l, 'RETRACT', 1).code).toBe('INVALID_PAYLOAD');
    expect(l.state.status).toBe('section_break');
  });

  it('@SL-109 Gegenbeispiel: von zwei Korrekturen ist zuerst nur die letzte zurücknehmbar', () => {
    const l = lauf('61d-uhrkorrekturen-nur-letzte.json');
    expect(l.results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(l.state.clock.elapsedMs + (153_000 - (l.state.clock.anchorAt ?? 0))).toBe(152_000);
  });

  it('@SL-109 Gegenbeispiel: eine Korrektur aus dem vorigen Abschnitt bleibt nach dem Wiederanpfiff', () => {
    const l = lauf('61e-uhrkorrektur-voriger-abschnitt.json');
    expect(ergebnisVon(l, 'RETRACT').code).toBe('INVALID_PAYLOAD');
  });
});

describe('@SL-074 / @SL-075 / @HE-042 Spiel fortsetzen', () => {
  it('@SL-074 1 Minute nach dem Abpfiff fortgesetzt, Restzeit 0:40: Spiel läuft im zweiten Abschnitt bei 5:20 weiter, Stand 2:1', () => {
    const l = lauf('62a-fortsetzen-helfer-1min.json');
    expect(ergebnisVon(l, 'REOPEN').status).toBe('accepted');
    expect(l.state.status).toBe('running');
    expect(l.state.section).toBe(2);
    expect(l.state.clock.elapsedMs - l.state.sectionStartMs).toBe(5 * 60_000 + 20_000);
    expect([l.state.scores.teamA.regular, l.state.scores.teamB.regular]).toEqual([2, 1]);
  });

  it('@SL-074 Grenze: genau 2 Minuten nach dem Abpfiff setzt das Gerät noch fort', () => {
    expect(ergebnisVon(lauf('62b-fortsetzen-helfer-120s-grenze.json'), 'REOPEN').status).toBe('accepted');
  });

  it.each([
    { lage: 'seit dem Abpfiff sind mehr als 2 Minuten vergangen', datei: '62c-fortsetzen-helfer-121s.json', grund: 'CONTINUE_WINDOW_EXPIRED' },
    { lage: 'Tom hat Spiel 11 schon einmal fortgesetzt, und es ist wieder von selbst beendet', datei: '62d-fortsetzen-helfer-zweites-mal.json', grund: 'ALREADY_CONTINUED' },
  ])('@SL-075 $lage: Toms Gerät setzt nicht fort, wieder öffnen kann nur die Turnierleitung', ({ datei, grund }) => {
    const l = lauf(datei);
    const helfer = l.results.filter((r) => r.status === 'rejected');
    expect(helfer).toHaveLength(1);
    expect(helfer[0].code).toBe('FORBIDDEN_ACTOR');
    expect(helfer[0].detail).toEqual({ reason: grund });
    const leitung = l.events.filter((e) => e.type === 'REOPEN' && e.actor === 'leitung').at(-1);
    expect(l.results.find((r) => r.id === leitung?.id)?.status).toBe('accepted');
    expect(l.state.status).toBe('running');
  });

  it('@HE-042 ein beendetes Spiel wiedereröffnen: die Turnierleitung darf es auch nach 5 Minuten', () => {
    expect(ergebnisVon(lauf('62e-wiedereroeffnen-leitung-300s.json'), 'REOPEN').status).toBe('accepted');
  });

  it('@HE-042 Gegenbeispiel: nach einem Direkteintrag (kein Ende durch Ablauf) setzt der Helfer nicht fort', () => {
    const r = ergebnisVon(lauf('62f-fortsetzen-helfer-nach-direkteintrag.json'), 'REOPEN');
    expect(r.code).toBe('FORBIDDEN_ACTOR');
    expect(r.detail).toEqual({ reason: 'NOT_ENDED_BY_CLOCK' });
  });

  it('@HE-042 nicht nach Strafstoßschießen – für den Helfer wie für die Turnierleitung', () => {
    const l = lauf('34-reopen-after-shootout-rejected.json');
    const reopen = l.results.filter((_, i) => l.events[i].type === 'REOPEN');
    expect(reopen.map((r) => [r.status, r.code])).toEqual([
      ['rejected', 'INVALID_TRANSITION'],
      ['rejected', 'INVALID_TRANSITION'],
    ]);
  });
});
