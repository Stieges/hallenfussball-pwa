/**
 * @OB-087 Zeile 2: Olli öffnet die Helfer-Verwaltung ohne Netz. Am Hinweis „Geht nur mit Netz“ steht „Verbinden“ (≥ 44 px); ein Tipp versucht die
 * Verbindung sofort neu (Anmeldung + Übertragung, einmal – auch bei zwei Tipps), gelingt es, lädt die Liste der Helfer – sofort, nicht erst im
 * nächsten 2-s-Takt der Seite. Echte Hooks und Texte, nur Server-Anbindung, Rechte und Anmeldung gestellt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

const rpc = vi.hoisted(() => ({ ensure: vi.fn(), list: vi.fn() }));
const env = vi.hoisted(() => ({ online: true }));
const auth = vi.hoisted(() => ({ reconnect: vi.fn() }));

vi.mock('../../../../../core/repositories/helperAccessRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../core/repositories/helperAccessRpc')>()),
  callEnsureHelperCode: rpc.ensure,
  callListHelperAccess: rpc.list,
}));
vi.mock('../../../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: env.online, wasOffline: false }) }));
vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', name: 'Olli' }, reconnect: auth.reconnect }) }));
vi.mock('../../../../auth/hooks/useCan', () => ({ useCanState: () => ({ allowed: true, isLoading: false }) }));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { touchTargets } from '../../../../../design-tokens';
import { MINDESTDAUER_MS } from '../../../../match-engine/useVerbindenVersuch';
import { TeamHelpersCategory } from '../index';
import type { Tournament } from '../../../../../types/tournament';

await initRealDeI18n();

const tournament = { id: 't1', title: 'Live-Cup', numberOfFields: 2, teams: [], matches: [] } as unknown as Tournament;
const CODE = { ok: true, data: { result: 'OK', code: 'K7MQ4X9R2P', validUntil: '2026-11-28T23:00:00Z', openRequests: 0 } };
const KEIN_NETZ = { ok: false, error: { kind: 'network' } };
const LISTE = { ok: true, data: { requests: [], members: [{
  memberId: 'm1', name: 'Tom', deviceLabel: 'phone', field: 2, mode: 'helper', revokedAt: null, acceptedAt: '2026-11-28T10:00:00Z', lastSeenAt: null, controls: [],
}] } };

async function ruhe(ms: number): Promise<void> { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

async function ohneNetzGeoeffnet() {
  rpc.list.mockResolvedValue(KEIN_NETZ);
  render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
  await ruhe(50);
  expect(screen.getByTestId('needs-network')).toBeInTheDocument();
}

beforeEach(() => {
  vi.useFakeTimers();
  env.online = true;
  rpc.ensure.mockReset().mockResolvedValue(CODE);
  rpc.list.mockReset();
  auth.reconnect.mockReset().mockResolvedValue(true);
});
afterEach(() => { vi.useRealTimers(); });

describe('@OB-087 Zeile 2 – „Verbinden“ in der Helfer-Verwaltung ohne Netz', () => {
  it('@OB-087 Zeile 2: am Hinweis steht „Verbinden“ (≥ 44 px); ein Tipp versucht die Verbindung neu, und die Liste der Helfer lädt sofort danach', async () => {
    await ohneNetzGeoeffnet();
    const taste = screen.getByTestId('needs-network-verbinden');
    expect(screen.getByTestId('needs-network')).toContainElement(taste);
    expect(taste).toHaveTextContent('Verbinden');
    expect(taste).toHaveStyle({ minHeight: touchTargets.minimum });

    rpc.list.mockResolvedValue(LISTE); // das Netz ist zurück
    await act(async () => { fireEvent.click(taste); });
    expect(auth.reconnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('needs-network-verbinden')).toHaveTextContent('Verbinde …');
    // nach der Mindestdauer des Versuchs, aber vor dem nächsten 2-s-Takt der Seite
    await ruhe(MINDESTDAUER_MS + 100);
    expect(screen.getByTestId('helper-list')).toBeInTheDocument();
    expect(screen.queryByTestId('needs-network')).toBeNull();
  });

  it('@OB-087 Zeile 2: solange der Versuch läuft, ist die Taste gesperrt; ein zweiter Tipp löst nichts doppelt aus', async () => {
    await ohneNetzGeoeffnet();
    const taste = screen.getByTestId('needs-network-verbinden');
    await act(async () => { fireEvent.click(taste); fireEvent.click(taste); });
    expect(auth.reconnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('needs-network-verbinden')).toHaveAttribute('aria-busy', 'true');
    await ruhe(MINDESTDAUER_MS + 100);
    expect(screen.getByTestId('needs-network-verbinden')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('@OB-087 Zeile 2 Gegenbeispiel: mit Netz gibt es weder den Hinweis noch die Taste', async () => {
    rpc.list.mockResolvedValue(LISTE);
    render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
    await ruhe(50);
    expect(screen.getByTestId('helper-list')).toBeInTheDocument();
    expect(screen.queryByTestId('needs-network')).toBeNull();
    expect(screen.queryByTestId('needs-network-verbinden')).toBeNull();
  });
});
