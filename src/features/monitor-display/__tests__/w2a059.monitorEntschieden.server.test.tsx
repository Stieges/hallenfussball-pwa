/**
 * @W2A-059 Z. 3 „Die Markierung verschwindet, sobald der Platz entschieden ist“ – Hallen-Monitor über den ECHTEN Übertragungsweg
 * (@ZM-180 Prüfregel): Antwort in der Form von `display_tournament` → `createMonitorSource` (SupabaseRepository.getForDisplay, Parser
 * des B-14-Vertrags) → Tabellen-Folie des eigenen Monitors. Befund C-PUBLIC-ENTSCHEIDUNG-BASIS-LEER. Lage: `publicEntscheidungKit.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  mitStrafstossNord, MONITOR_ID_ENTSCHEIDUNG, NORD, serverAntwort, SUED, turnierNordSued, type BasisInAntwort,
} from '../../../core/repositories/__tests__/publicEntscheidungKit';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc } }));

import { createMonitorSource } from '../monitorDataSource';
import { StandingsSlide } from '../slides/StandingsSlide';

beforeEach(() => {
  rpc.mockReset();
});

async function monitorTabelle(basis: BasisInAntwort) {
  const turnier = mitStrafstossNord(turnierNordSued());
  rpc.mockResolvedValue({ data: serverAntwort(turnier, basis, 'screen'), error: null });
  const delta = await createMonitorSource(turnier.id, MONITOR_ID_ENTSCHEIDUNG).fetch(null);
  if (delta.kind !== 'snapshot' || delta.monitor === null) { throw new Error(`kein Bild: ${delta.kind}`); }
  expect(rpc).toHaveBeenCalledWith('display_tournament', { tournament_id: turnier.id, monitor_id: MONITOR_ID_ENTSCHEIDUNG, since_version: null });
  const folie = delta.monitor.slides.find((s) => s.type === 'standings');
  if (folie === undefined) { throw new Error('Tabellen-Folie fehlt'); }
  return render(<StandingsSlide slide={folie} tournament={delta.tournament} theme="dark" style={{}} />);
}

/** Platzziffer und Teamname je Zeile der Tabellen-Folie. */
const zeilen = (): Array<[string, string]> => screen.getAllByTestId('standings-row').map((row) => [
  row.children[0].textContent?.trim() ?? '',
  row.querySelector('[data-teamname]')?.firstChild?.textContent?.trim() ?? '',
]);

describe('@W2A-059 @ZM-180 Monitor-Tabelle nach dem Strafstoßschießen (Server-Antwort display_tournament)', () => {
  it('@W2A-059 @ET-055 nach Strafstoßschießen 4:3: FC Nord Platz 1, SV Süd Platz 2, keine Markierung', async () => {
    await monitorTabelle({ art: 'gespeichert' });
    expect(zeilen().slice(0, 2)).toEqual([['1', NORD], ['2', SUED]]);
    expect(screen.queryByTestId('monitor-tie-mark')).toBeNull();
  });

  it('Gegenprobe: Grundlage leer (Fassung 20261117_104) – beide Platz 1 mit „Strafstoß folgt“', async () => {
    await monitorTabelle({ art: 'leer' });
    expect(zeilen().slice(0, 2).map(([platz]) => platz)).toEqual(['1', '1']);
    expect(screen.getAllByTestId('monitor-tie-mark').map((m) => m.getAttribute('data-mark'))).toEqual(['follows', 'follows']);
  });
});
