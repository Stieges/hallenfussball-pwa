/**
 * @ZM-166 / @ZM-137 Zeitbalken und Uhr am Hallenmonitor nach der Uhr-Art des Turniers – über den ECHTEN Übertragungsweg (@ZM-180
 * Prüfregel): Antwort in der Form von `display_tournament` (Positivliste, `publicEntscheidungKit.serverAntwort(…, 'screen')`) →
 * `createMonitorSource` (Parser des B-14-Vertrags) → Live-Folie. Befund C-MONITOR-UHRART-FEHLT: `public_view.config_for` lieferte
 * `matchCockpitSettings` nicht, der Monitor rechnete immer mit der Vorgabe („durchlaufend, letzte Minute angehalten“, 1 Minute).
 * Seit 20261118_008 (U) liefert der Server Uhr-Art und Länge der Schlussphase (Beweis scripts/monitor-endstand-check.sh U1–U4).
 * Lage: Spiel auf Feld 1, 2 Abschnitte zu 6 Minuten, im zweiten Abschnitt läuft die Uhr.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  MONITOR_ID_ENTSCHEIDUNG, serverAntwort, turnierNordSued, type UhrInAntwort,
} from '../../../core/repositories/__tests__/publicEntscheidungKit';
import type { ClockMode } from '../../../core/match/clockDisplay';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';
import { PERFORMANCE_PROFILES } from '../../../types/monitor';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc } }));

import { createMonitorSource } from '../monitorDataSource';
import { buildMonitorView } from '../monitorView';
import { LiveSlide } from '../slides/LiveSlide';

const SERVER = Date.UTC(2026, 10, 28, 14, 0, 0);
const ABSCHNITT_S = 360;

/** Turnier wie auf Ollis Gerät; `einstellung` = gespeicherte Cockpit-Einstellungen (ohne = nie gespeichert, Vorgabe der App). */
function turnier(einstellung?: { clockMode: ClockMode; finalPhaseMinutes: number }): Tournament {
  const basis = turnierNordSued();
  return {
    ...basis,
    gamePeriods: 2,
    groupPhaseGameDuration: 12,
    ...(einstellung === undefined ? {} : { matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...einstellung } }),
    monitors: basis.monitors?.map((m) => ({ ...m, slides: [{ id: 'folie-live', type: 'live' as const, config: { fieldId: 'field-1' }, duration: null, order: 0 }] })),
  };
}

/** Antwort des Servers; Spiel 1 läuft auf Feld 1 im 2. Abschnitt mit `restSek` Restzeit (Feinstatus wie vom Server). */
function antwort(t: Tournament, uhr: UhrInAntwort, restSek: number): Record<string, unknown> {
  const a = serverAntwort(t, { art: 'gespeichert' }, 'screen', uhr);
  const matches = a.matches as Array<Record<string, unknown>>;
  const start = ABSCHNITT_S * 1000;
  matches[0] = {
    ...matches[0], field: 1, match_status: 'running', score_a: 1, score_b: 0, decided_by: null,
    live_state: {
      status: 'running', phase: 'regular', section: 2, sections: 2, sectionSeconds: ABSCHNITT_S, overtimeSeconds: 120,
      sectionStartMs: start, elapsedMs: start + (ABSCHNITT_S - restSek) * 1000, anchorAt: SERVER, breakStartedAt: null, breakSeconds: 60,
    },
  };
  for (const m of matches.slice(1)) { if (m.field === 1 && m.match_status !== 'finished') { m.match_status = 'finished'; } }
  return a;
}

async function balkenTon(t: Tournament, uhr: UhrInAntwort, restSek: number): Promise<string | null> {
  cleanup();
  rpc.mockResolvedValue({ data: antwort(t, uhr, restSek), error: null });
  const delta = await createMonitorSource(t.id, MONITOR_ID_ENTSCHEIDUNG).fetch(null);
  if (delta.kind !== 'snapshot' || delta.monitor === null) { throw new Error(`kein Bild: ${delta.kind}`); }
  const folie = delta.monitor.slides.find((s) => s.type === 'live');
  if (folie === undefined) { throw new Error('Live-Folie fehlt'); }
  const jetzt = () => Date.now();
  render(
    <NowSourceContext.Provider value={jetzt}>
      <LiveSlide slide={folie} performanceSettings={PERFORMANCE_PROFILES.high} style={{}} theme="dark"
        tournament={delta.tournament} view={buildMonitorView(delta.tournament, jetzt())} />
    </NowSourceContext.Provider>,
  );
  return screen.getByTestId('monitor-zeitbalken').getAttribute('data-ton');
}

beforeEach(() => { rpc.mockReset(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(SERVER); });
afterEach(() => { vi.useRealTimers(); });

describe('@ZM-166 @ZM-137 Uhr-Art des Turniers am Monitor (Server-Antwort display_tournament, 20261118_008)', () => {
  it('@ZM-166 Uhr-Art „immer durchlaufend“: bei 0:30 im letzten Abschnitt bleibt der Balken grün (keine Schlussphase)', async () => {
    expect(await balkenTon(turnier({ clockMode: 'immer-durchlaufend', finalPhaseMinutes: 1 }), 'mit', 30)).toBe('gruen');
  });

  it('@ZM-166 Uhr-Art „immer angehalten“ (Netto): bei 0:30 bleibt der Balken grün', async () => {
    expect(await balkenTon(turnier({ clockMode: 'immer-angehalten', finalPhaseMinutes: 1 }), 'mit', 30)).toBe('gruen');
  });

  it('@ZM-166 „letzte 3 Minuten angehalten“: bei 2:30 ist der Balken violett (Schlussphase ab 3:00)', async () => {
    expect(await balkenTon(turnier({ clockMode: 'durchlaufend-letzte-minute-angehalten', finalPhaseMinutes: 3 }), 'mit', 150)).toBe('violett');
  });

  it('@ZM-166 Gegenbeispiel „letzte 3 Minuten angehalten“: bei 3:30 noch grün', async () => {
    expect(await balkenTon(turnier({ clockMode: 'durchlaufend-letzte-minute-angehalten', finalPhaseMinutes: 3 }), 'mit', 210)).toBe('gruen');
  });

  it('Vorgabe unverändert: ohne gespeicherte Einstellung „durchlaufend, letzte Minute angehalten“ – 0:30 violett, 1:30 grün', async () => {
    expect(await balkenTon(turnier(), 'mit', 30)).toBe('violett');
    expect(await balkenTon(turnier(), 'mit', 90)).toBe('gruen');
  });

  it('Gegenprobe Fassung 20261118_007 (Uhr fehlt in der Antwort): „immer durchlaufend“ zeigt fälschlich violett', async () => {
    expect(await balkenTon(turnier({ clockMode: 'immer-durchlaufend', finalPhaseMinutes: 1 }), 'ohne', 30)).toBe('violett');
  });
});
