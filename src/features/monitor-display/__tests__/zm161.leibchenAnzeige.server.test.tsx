/**
 * @ZM-161 @ZM-157 @ZM-195 @ZM-159 Leibchen am Hallenmonitor über den ECHTEN Übertragungsweg (@ZM-180 Prüfregel): Antwort in der Form von
 * `display_tournament` (`publicEntscheidungKit.serverAntwort(…, 'screen')`, Positivliste mit `kit_color_a`, `kit_color_b`, `bib_side`) →
 * `createMonitorSource` (Parser des B-14-Vertrags) → Live-Folie. Beweist, dass die Leibchen-Daten des Servers am Monitor ankommen und als
 * Trainingsleibchen mit Zeichen gezeichnet werden – und dass dieselbe Antwort ohne die Spalten (Fehlerart: Server liefert sie nicht) kein
 * Leibchen zeigt. Lage: Spiel 1 auf Feld 1 läuft 1 : 0, beide Teams tragen Rot, der Gast zieht gelbe Leibchen an.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MONITOR_ID_ENTSCHEIDUNG, serverAntwort, turnierNordSued } from '../../../core/repositories/__tests__/publicEntscheidungKit';
import type { Tournament } from '../../../types/tournament';
import { PERFORMANCE_PROFILES } from '../../../types/monitor';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';
import { palette } from '../../../design-tokens/colors/palette';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc } }));

import { createMonitorSource } from '../monitorDataSource';
import { buildMonitorView } from '../monitorView';
import { LiveSlide } from '../slides/LiveSlide';

const SERVER = Date.UTC(2026, 10, 28, 14, 0, 0);
const ROT = palette.kit.red;
const GELB = palette.yellow[400];

/** Turnier wie auf Ollis Gerät: alle Teams in Rot, ein Monitor mit Live-Folie Feld 1. */
function turnier(): Tournament {
  const basis = turnierNordSued();
  return {
    ...basis,
    teams: basis.teams.map((t) => ({ ...t, colors: { primary: ROT } })),
    monitors: basis.monitors?.map((m) => ({ ...m, slides: [{ id: 'folie-live', type: 'live' as const, config: { fieldId: 'field-1' }, duration: null, order: 0 }] })),
  };
}

type Kit = { kit_color_a?: string; kit_color_b?: string; bib_side?: string };

/** Antwort des Servers; Spiel 1 läuft auf Feld 1, `kit` = die vom Server geschriebenen Spalten (beim Anpfiff, `matches_guard_kit_columns`). */
function antwort(t: Tournament, status: 'running' | 'scheduled', kit: Kit): Record<string, unknown> {
  const a = serverAntwort(t, { art: 'gespeichert' }, 'screen');
  const matches = a.matches as Array<Record<string, unknown>>;
  matches[0] = {
    ...matches[0], field: 1, match_status: status, score_a: status === 'running' ? 1 : null, score_b: status === 'running' ? 0 : null, decided_by: null, ...kit,
    ...(status === 'running'
      ? { live_state: { status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, overtimeSeconds: 120, sectionStartMs: 0, elapsedMs: 100_000, anchorAt: SERVER, breakStartedAt: null, breakSeconds: 60 } }
      : {}),
  };
  for (const m of matches.slice(1)) { if (m.field === 1) { m.field = 2; } }
  return a;
}

async function zeige(t: Tournament, status: 'running' | 'scheduled', kit: Kit) {
  cleanup();
  rpc.mockResolvedValue({ data: antwort(t, status, kit), error: null });
  const delta = await createMonitorSource(t.id, MONITOR_ID_ENTSCHEIDUNG).fetch(null);
  if (delta.kind !== 'snapshot' || delta.monitor === null) { throw new Error(`kein Bild: ${delta.kind}`); }
  const folie = delta.monitor.slides.find((s) => s.type === 'live');
  if (folie === undefined) { throw new Error('Live-Folie fehlt'); }
  const jetzt = () => Date.now();
  return render(
    <NowSourceContext.Provider value={jetzt}>
      <LiveSlide slide={folie} performanceSettings={PERFORMANCE_PROFILES.high} style={{}} theme="dark"
        tournament={delta.tournament} view={buildMonitorView(delta.tournament, jetzt())} />
    </NowSourceContext.Provider>,
  );
}

beforeEach(() => { rpc.mockReset(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(SERVER); });
afterEach(() => { vi.useRealTimers(); });

describe('@ZM-161 @ZM-180 Leibchen am Monitor (Server-Antwort display_tournament)', () => {
  it('@ZM-161 @ZM-157 Spalten kit_color_a/kit_color_b/bib_side in der Antwort: der Gast als Weste (Gelb über Rot) mit Zeichen oben links, das Heim ganz Rot', async () => {
    await zeige(turnier(), 'running', { kit_color_a: ROT, kit_color_b: GELB, bib_side: 'b' });
    const gast = screen.getByTestId('live-box-away');
    expect(gast).toHaveAttribute('data-fill', 'vest');
    expect(gast).toHaveAttribute('data-color', GELB);
    expect(gast).toHaveAttribute('data-stripes', ROT);
    expect(gast.querySelectorAll('[data-teil]')).toHaveLength(3);
    expect(screen.getByTestId('live-box-away-bib')).toBeInTheDocument();
    expect(screen.getByTestId('live-box-home')).toHaveAttribute('data-fill', 'solid');
    expect(screen.getByTestId('live-box-home')).toHaveAttribute('data-color', ROT);
    expect(screen.queryByTestId('live-box-home-bib')).toBeNull();
  });

  it('@ZM-161 Gegenbeispiel (Fehlerart „Server liefert die Spalten nicht“): dieselbe Antwort ohne Leibchen-Spalten zeigt kein Zeichen und keine Form', async () => {
    await zeige(turnier(), 'running', {});
    expect(document.querySelectorAll('[data-teil]')).toHaveLength(0);
    expect(screen.queryByTestId('live-box-away-bib')).toBeNull();
    expect(screen.queryByTestId('live-box-home-bib')).toBeNull();
  });

  it('@ZM-195 @ZM-159 Folie „Nächstes Spiel“ aus der Server-Antwort: Kästen „0 : 0“, Rot gegen Rot ohne Leibchen → beide Kästen Rot (Fall D2, keine Ausweichfarbe)', async () => {
    await zeige(turnier(), 'scheduled', {});
    expect(screen.getByTestId('live-badge')).toHaveTextContent('Nächstes Spiel');
    expect(screen.getByTestId('live-box-home-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('live-box-away-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('live-box-home')).toHaveAttribute('data-color', ROT);
    expect(screen.getByTestId('live-box-away')).toHaveAttribute('data-color', ROT);
  });
});
