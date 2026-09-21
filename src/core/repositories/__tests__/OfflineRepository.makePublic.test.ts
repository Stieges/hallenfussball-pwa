/**
 * Task 3 — Die Ablehnung des RPC muss bis zur UI durchkommen.
 *
 * OfflineRepository fängt Cloud-Fehler ab und fällt auf die lokale Implementierung zurück
 * (gedacht für Offline-Betrieb). Bei der fachlichen Ablehnung von `make_tournament_public`
 * wäre das falsch: Das Turnier würde lokal öffentlich, eine Mutation eingereiht, die der
 * Server dauerhaft ablehnt — und der Nutzer sähe nichts davon.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import type { SupabaseRepository } from '../SupabaseRepository';
import { RepositoryError } from '../../errors';

const cloudMakePublic = vi.fn<(id: string) => Promise<{ shareCode: string; createdAt: string } | null>>();
const localMakePublic = vi.fn<(id: string) => Promise<{ shareCode: string; createdAt: string } | null>>();

function createRepository() {
  const localRepo = {
    makeTournamentPublic: localMakePublic,
    get: vi.fn(() => Promise.resolve(null)),
    save: vi.fn(() => Promise.resolve()),
  } as unknown as LocalStorageRepository;
  const supabaseRepo = {
    makeTournamentPublic: cloudMakePublic,
  } as unknown as SupabaseRepository;
  return new OfflineRepository(localRepo, supabaseRepo);
}

describe('OfflineRepository.makeTournamentPublic — Freigabe-Ablehnung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localMakePublic.mockResolvedValue({ shareCode: 'LOCAL1', createdAt: '2026-02-01T10:00:00.000Z' });
  });

  it('reicht die Ablehnung des RPC durch statt lokal zu teilen', async () => {
    cloudMakePublic.mockRejectedValue(
      new Error('Tournament has not been released yet and cannot be made public')
    );

    await expect(createRepository().makeTournamentPublic('t1')).rejects.toThrow(
      /has not been released/
    );
    expect(localMakePublic).not.toHaveBeenCalled();
  });

  it('erkennt die Ablehnung am SQLSTATE, auch wenn die Meldung anders lautet', async () => {
    // Der Vertrag ist der Fehlercode, nicht der Text. Ohne diese Prüfung hinge der Guard an
    // einer Zeichenkette in einer SQL-Datei: Wird die Meldung dort umformuliert, fiele der
    // Client STILL in den lokalen Fallback zurück — genau in das Verhalten, das er verhindert.
    //
    // Code bewusst 'HF001', NICHT 'PT001': Dieser Mock hat früher genau die Annahme codiert,
    // die er eigentlich prüfen sollte — 'PT001' ist ein SQLSTATE aus PostgRESTs PT-Namespace
    // (HTTP-Status-Override, hier faktisch "HTTP-Status 1"), der beim echten RPC-Aufruf nie
    // intakt beim Client ankommt. Der Mock konnte den Fehler also nie fangen. Siehe Test unten.
    cloudMakePublic.mockRejectedValue(
      new RepositoryError('makePublic', 'Freigabe abgelehnt', { code: 'HF001' })
    );

    await expect(createRepository().makeTournamentPublic('t1')).rejects.toThrow(/Freigabe abgelehnt/);
    expect(localMakePublic).not.toHaveBeenCalled();
  });

  it('behandelt einen Code aus PostgRESTs PT-Namespace NICHT als Ablehnung (er käme nie intakt an)', async () => {
    // PostgREST interpretiert SQLSTATEs der Form PTxyz als HTTP-Status-Override. Ein solcher
    // Code würde die Transportschicht brechen, bevor code/message den Client erreichen —
    // isReleaseRefusal() darf sich also niemals auf einen PT-Code verlassen. Dieser Test
    // dokumentiert das, damit niemand versehentlich wieder einen PT-Code einführt.
    cloudMakePublic.mockRejectedValue(
      new RepositoryError('makePublic', 'Irgendein anderer Fehler', { code: 'PT001' })
    );

    const result = await createRepository().makeTournamentPublic('t1');

    expect(result?.shareCode).toBe('LOCAL1');
    expect(localMakePublic).toHaveBeenCalledWith('t1');
  });

  it('nutzt bei einem echten Verbindungsfehler weiterhin den lokalen Fallback', async () => {
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));

    const result = await createRepository().makeTournamentPublic('t1');

    expect(result?.shareCode).toBe('LOCAL1');
    expect(localMakePublic).toHaveBeenCalledWith('t1');
  });
});
