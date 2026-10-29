/**
 * R3-6 Kindermodus nach dem Abschluss über den ECHTEN Cloud-Lesepfad (Review #405 M-1): `public_tournament` (rpc-Quelle, Vertrags-
 * Parser) und `public_final_standings` kommen als Server-Antworten, nichts von der Zuschauer-Seite ist ersetzt. Seit W-M liefert der
 * Server im Kindermodus `{status:'none'}`; der Satz „Turnier beendet – danke fürs Mitspielen“ hängt deshalb am Zustand des Turniers
 * (`lifecycle_status` aus dem öffentlichen Payload), nicht am Endstand (@ZM-121 Z. 4, „Kindermodus überstimmt alle Schalter“).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { fullReply } from './payloadFixtures';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc } }));
await initRealDeI18n();

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';

const CODE = 'NIK6ST';

function payload(state: { lifecycle?: string; kids: boolean }): Record<string, unknown> {
  const reply = fullReply() as { tournament: { config: Record<string, unknown> } } & Record<string, unknown>;
  return {
    ...reply,
    tournament: {
      ...reply.tournament, is_public: true, share_code: CODE,
      ...(state.lifecycle === undefined ? {} : { lifecycle_status: state.lifecycle, finished_at: '2026-11-28T12:10:00+00:00' }),
      config: { ...reply.tournament.config, hideScoresForPublic: state.kids },
    },
  };
}

async function open(state: { lifecycle?: string; kids: boolean }) {
  rpc.mockImplementation((name: string) => Promise.resolve(
    name === 'public_tournament' ? { data: payload(state), error: null } : { data: { status: 'none' }, error: null },
  ));
  render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${CODE}`]}><LiveViewScreen shareCode={CODE} /></MemoryRouter>
    </RepositoryProvider>,
  );
  await screen.findAllByRole('heading', { level: 1, name: 'Nikolaus-Turnier' });
}

describe('R3-6 Zuschauer-Seite über den Cloud-Lesepfad', () => {
  beforeEach(() => { rpc.mockReset(); localStorage.clear(); });

  it('@ZM-121 Z. 4: Kindermodus + abgeschlossen (lifecycle_status im Payload) + Endstand „none“ → Satz und Abzeichen, keine Plätze', async () => {
    await open({ lifecycle: 'finished', kids: true });
    expect(await screen.findByTestId('final-standings-kids')).toHaveTextContent('Turnier beendet – danke fürs Mitspielen');
    expect(screen.getByTestId('tournament-ended')).toBeInTheDocument();
    expect(screen.queryByTestId('final-standings')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('public_tournament', expect.anything());
  });

  it('Gegenbeispiel: Kindermodus, Turnier läuft noch – kein Satz', async () => {
    await open({ lifecycle: 'fixed', kids: true });
    expect(screen.queryByTestId('final-standings-kids')).toBeNull();
    expect(screen.queryByTestId('tournament-ended')).toBeNull();
  });

  it('Gegenbeispiel: abgeschlossen ohne Kindermodus, Endstand „none“ – kein Satz, kein Endstand', async () => {
    await open({ lifecycle: 'finished', kids: false });
    expect(screen.queryByTestId('final-standings-kids')).toBeNull();
    expect(screen.queryByTestId('final-standings')).toBeNull();
  });
});
