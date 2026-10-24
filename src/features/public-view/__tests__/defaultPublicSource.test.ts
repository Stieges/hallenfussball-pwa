/**
 * Wahl der Quelle der Zuschauer-Seite (B-15, Fixrunde PR #360 B1): mit Supabase die Server-Funktion `public_tournament`,
 * ohne Supabase der lokale Weg über `getByShareCode` (@ZM-068, @ZM-109).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLiveViewTournament } from '../../../screens/__tests__/liveViewFixture';
import { choosePublicTournamentSource } from '../defaultPublicSource';
import type { PublicRpcCall } from '../rpcPublicSource';
import { fullReply } from './payloadFixtures';

const CODE = 'ABC123';

const rpcStub = (data: Record<string, unknown>): PublicRpcCall & ReturnType<typeof vi.fn> =>
  vi.fn().mockResolvedValue({ data, error: null }) as PublicRpcCall & ReturnType<typeof vi.fn>;

describe('Wahl der Quelle mit Supabase', () => {
  it('@ZM-068 fragt die Server-Funktion, nicht den lokalen Speicher', async () => {
    const rpcCall = rpcStub(fullReply());
    const localLookup = { getByShareCode: vi.fn().mockResolvedValue(buildLiveViewTournament()) };
    const source = choosePublicTournamentSource({ supabaseConfigured: true, rpcCall, localLookup });
    expect(source.kind).toBe('rpc');
    const result = await source.fetch(CODE, null);
    expect(result.kind).toBe('full');
    expect(rpcCall).toHaveBeenCalledTimes(1);
    expect(localLookup.getByShareCode).not.toHaveBeenCalled();
  });

  it('@ZM-068 „nicht geteilt oder unbekannt“ kommt vom Server, auch wenn lokal ein Turnier liegt', async () => {
    const localLookup = { getByShareCode: vi.fn().mockResolvedValue(buildLiveViewTournament()) };
    const source = choosePublicTournamentSource({ supabaseConfigured: true, rpcCall: rpcStub({ state: 'not_found' }), localLookup });
    expect(await source.fetch(CODE, null)).toEqual({ kind: 'not-found' });
  });

  it('@ZM-109 eine Störung am Server ist „nicht erreichbar“, nie „nicht gefunden“', async () => {
    const failing: PublicRpcCall = () => Promise.resolve({ data: null, error: { message: 'Service Unavailable', code: '503' } });
    const source = choosePublicTournamentSource({ supabaseConfigured: true, rpcCall: failing });
    expect(await source.fetch(CODE, null)).toEqual({ kind: 'unreachable' });
  });
});

describe('Wahl der Quelle ohne Supabase (Offline-Betrieb)', () => {
  it('liest das Turnier aus dem lokalen Speicher', async () => {
    const t = buildLiveViewTournament();
    const localLookup = { getByShareCode: vi.fn().mockResolvedValue(t) };
    const source = choosePublicTournamentSource({ supabaseConfigured: false, rpcCall: rpcStub(fullReply()), localLookup });
    expect(source.kind).toBe('legacy');
    const result = await source.fetch(CODE, null);
    expect(result).toMatchObject({ kind: 'full', tournament: t });
    expect(localLookup.getByShareCode).toHaveBeenCalledWith(CODE);
  });

  it('Gegenbeispiel: die Server-Funktion wird nie aufgerufen – auch nicht beim zweiten Abruf oder ohne Treffer', async () => {
    const rpcCall = rpcStub(fullReply());
    const localLookup = { getByShareCode: vi.fn().mockResolvedValueOnce(buildLiveViewTournament()).mockResolvedValueOnce(null) };
    const source = choosePublicTournamentSource({ supabaseConfigured: false, rpcCall, localLookup });
    const first = await source.fetch(CODE, null);
    const second = await source.fetch(CODE, first.kind === 'full' ? first.version : null);
    expect(second).toEqual({ kind: 'not-found' });
    expect(rpcCall).not.toHaveBeenCalled();
  });
});

describe('Standardquelle der Seite folgt der Konfiguration', () => {
  afterEach(() => {
    vi.doUnmock('../../../lib/supabase');
    vi.resetModules();
  });

  const loadDefaultWith = async (configured: boolean) => {
    vi.resetModules();
    vi.doMock('../../../lib/supabase', async (importOriginal) => ({
      ...(await importOriginal<typeof import('../../../lib/supabase')>()),
      isSupabaseConfigured: configured,
    }));
    const mod = await import('../defaultPublicSource');
    return mod.defaultPublicTournamentSource;
  };

  it('mit Supabase: Server-Funktion (Adapter b)', async () => {
    expect((await loadDefaultWith(true)).kind).toBe('rpc');
  });

  it('ohne Supabase: lokaler Weg (Adapter a)', async () => {
    expect((await loadDefaultWith(false)).kind).toBe('legacy');
  });
});
