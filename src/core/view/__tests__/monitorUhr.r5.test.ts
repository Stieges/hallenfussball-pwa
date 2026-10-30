/**
 * Monitor-Uhr (R5 PR 2) – reine Regel, Testwerte aus dem Gherkin:
 * @ZM-166 (Grundriss, Spiel 7: Abschnitte zu je 6 Minuten, 1 Minute Halbzeitpause, 2 Minuten Verlängerung),
 * @ZM-145 (Balken nimmt mit der Restzeit ab), @ZM-139 (Restzeit des Abschnitts), @ZM-137 (Schlussphase violett),
 * @ZM-176 (nie zurück, außer Zeitkorrektur), @ZM-085 (ohne Netz bis 0:00, nie darunter), @ZM-180 (beendet bleibt beendet).
 */
import { describe, expect, it } from 'vitest';
import { monitorUhrMitSperre, monitorUhrOf, type MonitorUhrModell } from '../monitorUhr';
import type { ClockMode } from '../../match/clockDisplay';
import type { SpectatorClockRules } from '../types';

const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const MODES: ClockMode[] = ['immer-durchlaufend', 'durchlaufend-letzte-minute-angehalten', 'immer-angehalten'];
const MIN = 60_000;

function regeln(clockMode: ClockMode = 'immer-durchlaufend'): SpectatorClockRules {
  return { sections: 2, sectionSeconds: 360, overtimeSeconds: 120, clockMode };
}

/** Feinstatus von Spiel 7 (Serverzeit): Abschnitt `section`, Restzeit `restSek`, Uhr läuft seit T0 (bzw. steht). */
function imAbschnitt(section: number, restSek: number, laeuft = true, phase: 'regular' | 'overtime' = 'regular') {
  const start = phase === 'overtime' ? 12 * MIN : (section - 1) * 6 * MIN;
  const laenge = phase === 'overtime' ? 120 : 360;
  return {
    status: laeuft ? 'running' : 'paused', phase, section, sections: 2, sectionSeconds: 360, overtimeSeconds: 120,
    sectionStartMs: start, elapsedMs: start + (laenge - restSek) * 1000, anchorAt: laeuft ? T0 : null,
    breakStartedAt: null, breakSeconds: 60,
  };
}

function uhr(liveState: unknown, nowMs = T0, clockMode?: ClockMode, isLive = true): MonitorUhrModell | null {
  return monitorUhrOf({ match: { isLive, clockRules: regeln(clockMode) }, liveState, nowMs });
}

describe('@ZM-166 Der Zeitbalken zeigt den Zustand des Spiels, nie in Rot', () => {
  const halbzeitpause = { ...imAbschnitt(1, 0, false), status: 'section_break', breakStartedAt: T0 - 30_000 };
  const strafstoss = { ...imAbschnitt(2, 0, false), status: 'running', phase: 'shootout' };
  // Zeilen 1–6, 8: Uhr-Art ohne Schlussphase (die Tabelle nennt keine; Zeile 7 und 8 grenzen ab)
  type Zeile = [string, unknown, ClockMode | undefined, { anteil: number; ton: string }, string, number];
  const zeilen: ReadonlyArray<Zeile> = [
    ['im ersten Abschnitt bei 3:00, die Uhr läuft', imAbschnitt(1, 180), undefined, { anteil: 0.5, ton: 'gruen' }, 'restzeit', 180],
    ['im zweiten Abschnitt bei 0:30, die Uhr läuft', imAbschnitt(2, 30), undefined, { anteil: 1 / 12, ton: 'gruen' }, 'restzeit', 30],
    ['im ersten Abschnitt bei 3:00, Tom hat die Uhr angehalten', imAbschnitt(1, 180, false), undefined, { anteil: 0.5, ton: 'grau' }, 'angehalten', 180],
    ['in der Halbzeitpause, noch 0:30 Pause', halbzeitpause, undefined, { anteil: 0.5, ton: 'gedaempft' }, 'pauseHalbzeit', 30],
    ['in der Verlängerung bei 1:00, die Uhr läuft', imAbschnitt(3, 60, true, 'overtime'), undefined, { anteil: 0.5, ton: 'gruen' }, 'verlaengerung', 60],
    ['mit abgelaufener Spielzeit, noch nicht abgepfiffen', imAbschnitt(2, 0), undefined, { anteil: 0, ton: 'gruen' }, 'zeitAbgelaufen', 0],
    ['in der Schlussphase bei Uhr-Art „durchlaufend, letzte x Minuten angehalten“, Uhr läuft', imAbschnitt(2, 30), 'durchlaufend-letzte-minute-angehalten', { anteil: 1 / 12, ton: 'violett' }, 'restzeit', 30],
    ['in den letzten Minuten bei jeder anderen Uhr-Art (durchlaufend ohne Schlussphase)', imAbschnitt(2, 30), 'immer-durchlaufend', { anteil: 1 / 12, ton: 'gruen' }, 'restzeit', 30],
    ['in den letzten Minuten bei jeder anderen Uhr-Art (Netto)', imAbschnitt(2, 30), 'immer-angehalten', { anteil: 1 / 12, ton: 'gruen' }, 'restzeit', 30],
  ];
  it.each(zeilen)('%s', (_lage, liveState, clockMode, balken, text, rest) => {
    const u = uhr(liveState, T0, clockMode);
    expect(u?.text).toBe(text);
    expect(u?.restSekunden).toBe(rest);
    expect(u?.balken?.ton).toBe(balken.ton);
    expect(u?.balken?.anteil).toBeCloseTo(balken.anteil, 5);
  });

  it('im Strafstoßschießen: kein Balken, kein Zeit-Text', () => {
    expect(uhr(strafstoss)).toBeNull();
  });

  it('beendet: kein Balken, kein Zeit-Text', () => {
    expect(uhr(imAbschnitt(2, 0, false), T0, undefined, false)).toBeNull();
  });

  it('Gegenprobe „nie rot“: kein Zustand trägt einen anderen Ton als grün, grau, gedämpft oder violett', () => {
    const toene = [imAbschnitt(1, 180), imAbschnitt(1, 180, false), halbzeitpause, imAbschnitt(3, 60, true, 'overtime'), imAbschnitt(2, 0)]
      .flatMap((s) => MODES.map((m) => uhr(s, T0, m)?.balken?.ton));
    for (const ton of toene) { expect(['gruen', 'grau', 'gedaempft', 'violett']).toContain(ton); }
  });
});

describe('@ZM-145 Der Zeitbalken nimmt mit der Restzeit ab', () => {
  it('im zweiten Abschnitt noch 1:30 zu spielen: zu einem Viertel gefüllt und mit jeder Sekunde kürzer', () => {
    const jetzt = uhr(imAbschnitt(2, 90));
    const spaeter = uhr(imAbschnitt(2, 90), T0 + 1000);
    expect(jetzt?.balken?.anteil).toBeCloseTo(0.25, 5);
    expect(spaeter?.balken?.anteil).toBeLessThan(jetzt?.balken?.anteil ?? 0);
  });

  it('mit 0:00 ist er leer', () => {
    expect(uhr(imAbschnitt(2, 90), T0 + 90_000)?.balken?.anteil).toBe(0);
  });
});

describe('@ZM-139 Restzeit des Abschnitts', () => {
  it('Spiel 11, Abschnitte zu 6 Minuten, im zweiten Abschnitt 4:10 gespielt: die Uhr steht bei 1:50, nicht 7:50', () => {
    const u = uhr(imAbschnitt(2, 110));
    expect(u?.restSekunden).toBe(110);
    expect(u?.restSekunden).not.toBe(470);
  });

  it('ohne Feinstatus aus den Zeitfeldern: 10:10 gespielt (2 × 6:00) → 1:50', () => {
    const u = monitorUhrOf({ match: { isLive: true, clockRules: regeln() }, cacheElapsedSec: 610, cacheAnker: 'a', nowMs: T0 });
    expect(u?.restSekunden).toBe(110);
  });
});

describe('@ZM-137 Schlussphase', () => {
  it('„durchlaufend, letzte Minute angehalten“: im letzten Abschnitt ab 1:00 violett; davor ohne Hervorhebung', () => {
    expect(uhr(imAbschnitt(2, 60), T0, 'durchlaufend-letzte-minute-angehalten')?.schlussphase).toBe(true);
    expect(uhr(imAbschnitt(2, 61), T0, 'durchlaufend-letzte-minute-angehalten')?.schlussphase).toBe(false);
  });

  it('hält Tom die Uhr in der Schlussphase an, steht dort zusätzlich „angehalten“', () => {
    const u = uhr(imAbschnitt(2, 40, false), T0, 'durchlaufend-letzte-minute-angehalten');
    expect(u?.schlussphase).toBe(true);
    expect(u?.text).toBe('angehalten');
  });

  const ohneSchlussphase: ClockMode[] = ['immer-angehalten', 'immer-durchlaufend'];
  it.each(ohneSchlussphase)('Uhr-Art „%s“: keine Schlussphase', (mode) => {
    expect(uhr(imAbschnitt(2, 30), T0, mode)?.schlussphase).toBe(false);
  });
});

describe('@ZM-176 Die Uhr springt nie zurück, außer bei einer Korrektur der Zeit', () => {
  it('Folge von Anzeigen mit schwankender Serverzeit (±400 ms): die angezeigte Sekunde fällt monoton', () => {
    const anker = imAbschnitt(1, 300);
    const rauschen = [0, 400, -400, 300, -350, 100, -200, 400, -400, 0];
    let vorher: MonitorUhrModell | null = null;
    const gezeigt: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const jetzt = T0 + i * 250 + (rauschen[i % rauschen.length] ?? 0);
      vorher = monitorUhrMitSperre(uhr(anker, jetzt), vorher);
      gezeigt.push(vorher?.restSekunden ?? -1);
    }
    for (let i = 1; i < gezeigt.length; i += 1) { expect(gezeigt[i]).toBeLessThanOrEqual(gezeigt[i - 1] ?? 0); }
  });

  it('Gegenprobe ohne Sperre: dieselbe Folge springt zurück', () => {
    const anker = imAbschnitt(1, 300);
    expect(uhr(anker, T0 + 1200)?.restSekunden).toBe(299);
    expect(uhr(anker, T0 + 1200 - 400)?.restSekunden).toBe(300);
  });

  it('Zeitkorrektur (+0:20 Restzeit) setzt einen neuen Anker: die Uhr springt einmal zurück', () => {
    const vorher = uhr(imAbschnitt(1, 200), T0);
    const korrigiert = monitorUhrMitSperre(uhr({ ...imAbschnitt(1, 220), anchorAt: T0 + 1 }, T0 + 1), vorher);
    expect(vorher?.restSekunden).toBe(200);
    expect(korrigiert?.restSekunden).toBe(220);
  });

  it('Zeitkorrektur (+0:20) bei angehaltener Uhr: nur die gespielte Zeit ändert sich – die Uhr springt von 3:20 auf 3:40', () => {
    const halt = imAbschnitt(1, 200, false);
    const vorher = uhr(halt, T0);
    const korrigiert = monitorUhrMitSperre(uhr({ ...halt, elapsedMs: halt.elapsedMs - 20_000 }, T0 + 5_000), vorher);
    expect(vorher?.restSekunden).toBe(200);
    expect(korrigiert?.restSekunden).toBe(220);
    expect(korrigiert?.text).toBe('angehalten');
  });

  it('Pause und Weiter sind neue Anker: die Restzeit bleibt 06:41 → läuft ab 06:41 weiter (@ZM-084)', () => {
    const halt = { ...imAbschnitt(1, 0, false), sectionSeconds: 600, elapsedMs: 199_000 };
    const angehalten = monitorUhrOf({ match: { isLive: true, clockRules: { ...regeln(), sectionSeconds: 600 } }, liveState: halt, nowMs: T0 + 30_000 });
    expect(angehalten?.restSekunden).toBe(401);
    expect(angehalten?.text).toBe('angehalten');
    expect(angehalten?.msBisWechsel).toBeNull();
    const weiter = { ...halt, status: 'running', anchorAt: T0 + 60_000 };
    const laeuft = monitorUhrMitSperre(monitorUhrOf({ match: { isLive: true, clockRules: { ...regeln(), sectionSeconds: 600 } }, liveState: weiter, nowMs: T0 + 62_000 }), angehalten);
    expect(laeuft?.restSekunden).toBe(399);
    expect(laeuft?.text).toBe('restzeit');
  });
});

describe('@ZM-085 Ohne neue Antwort zählt die Uhr bis 0:00 und nie darunter', () => {
  it('derselbe Anker, 10 Minuten später: 0:00, „Zeit abgelaufen“, kein Takt mehr', () => {
    const u = uhr(imAbschnitt(2, 45), T0 + 10 * MIN);
    expect(u?.restSekunden).toBe(0);
    expect(u?.text).toBe('zeitAbgelaufen');
    expect(u?.msBisWechsel).toBeNull();
  });
});

describe('@ZM-180 Ein beendetes Spiel bleibt beendet', () => {
  it('kommt nach dem Abpfiff noch der Anker eines laufenden Spiels mit, gibt es keine Uhr und keinen Balken', () => {
    expect(uhr(imAbschnitt(2, 200), T0, undefined, false)).toBeNull();
  });
});

describe('Takt an der Sekundengrenze', () => {
  it('Serverzeit 900 ms nach dem letzten Sekundenwechsel der Spieluhr: der nächste Wechsel ist in 100 ms', () => {
    expect(uhr(imAbschnitt(1, 300), T0 + 900)?.msBisWechsel).toBe(100);
  });
});
