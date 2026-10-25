/**
 * R3-2a (Plan H-9): Nach dem Abschluss sperrt der Server `field_control` (`guard_closed_tournament`, 20261113_003) – „Spielleitung
 * übernehmen“ antwortet mit 55000 TOURNAMENT_FINISHED. Der Client meldet das als eigene Ergebnisart, nicht als allgemeinen Fehler
 * („bitte erneut versuchen“). Szenario: @HE-070 Z. 1 (nach dem Abschluss abgelehnt mit „Turnier ist abgeschlossen“).
 * Gegenbeispiel: 42501 bleibt ein allgemeiner Fehler, ein Netzfehler bleibt `offline`.
 */
import { describe, expect, it, vi } from 'vitest';
import { takeFieldControl } from '../fieldControlRpc';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function clientWith(result: RpcResult | (() => Promise<RpcResult>)) {
  const rpc = vi.fn(() => (typeof result === 'function' ? result() : Promise.resolve(result)));
  return { client: { rpc } as never, rpc };
}

const args = { tournamentId: 'live-cup', field: 2, deviceId: '11111111-1111-4111-8111-111111111111', deviceLabel: 'tablet', expectedEpoch: 1 };

describe('R3-2a takeFieldControl nach dem Abschluss (@HE-070)', () => {
  it('@HE-070 55000 TOURNAMENT_FINISHED → „Turnier ist abgeschlossen“ (eigene Ergebnisart, kein „erneut versuchen“)', async () => {
    const { client, rpc } = clientWith({ data: null, error: { code: '55000', message: 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (field_control, Turnier live-cup).' } });
    expect(await takeFieldControl(client, args)).toEqual({ kind: 'tournamentFinished' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: 42501 bleibt ein allgemeiner Fehler, ein Netzfehler bleibt „nur mit Netz“', async () => {
    expect(await takeFieldControl(clientWith({ data: null, error: { code: '42501', message: 'take_field_control: nicht angemeldet' } }).client, args))
      .toEqual({ kind: 'error', message: 'take_field_control: nicht angemeldet' });
    expect(await takeFieldControl(clientWith(() => Promise.reject(new TypeError('Failed to fetch'))).client, args)).toEqual({ kind: 'offline' });
  });
});
