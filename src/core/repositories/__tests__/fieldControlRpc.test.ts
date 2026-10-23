/**
 * B-49: Client der Steuer je Feld gegen den Vertrag aus `20261110_003_field_control.sql` (A-34, belegt in
 * scripts/field-control-check.sh): `field_control_state` mit Geräte-ID, `take_field_control` mit erwarteter Epoche.
 * Werte aus dem Gherkin (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`, `2026-09-24_helfer-am-turniertag.md`):
 * Tom steuert Feld 2 mit dem Handy, Olli übernimmt (@FU-027), ohne Netz abgelehnt (@FU-028), @HE-049 „Feld 2: Tom (Handy)“.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFieldControlState, takeFieldControl, type FieldControlInfo } from '../fieldControlRpc';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function clientWith(result: RpcResult | (() => Promise<RpcResult>)) {
  const rpc = vi.fn(() => (typeof result === 'function' ? result() : Promise.resolve(result)));
  return { client: { rpc } as never, rpc };
}

const GERAET = '11111111-1111-4111-8111-111111111111';
const TOM_HANDY: FieldControlInfo = { field: 2, epoch: 1, holderName: 'Tom', holderRole: 'helper', holderDeviceLabel: 'phone', isMine: false, claimedAt: 1_790_000_000_000 };
const OLLI_TABLET: FieldControlInfo = { field: 2, epoch: 2, holderName: 'Olli', holderRole: 'owner', holderDeviceLabel: 'tablet', isMine: true, claimedAt: 1_790_000_060_000 };

describe('readFieldControlState (field_control_state)', () => {
  it('@HE-049 sendet die Geräte-ID dieses Geräts mit und liefert den Stand je Feld', async () => {
    const { client, rpc } = clientWith({ data: [TOM_HANDY], error: null });
    expect(await readFieldControlState(client, 'T', GERAET)).toEqual([TOM_HANDY]);
    expect(rpc).toHaveBeenCalledWith('field_control_state', { p_tournament_id: 'T', p_device_id: GERAET });
  });

  it('Gegenbeispiel: Fehler, unerwartete Antwort oder ohne Client → null (der letzte Stand bleibt beim Aufrufer)', async () => {
    expect(await readFieldControlState(clientWith({ data: null, error: { message: 'kaputt' } }).client, 'T', GERAET)).toBeNull();
    expect(await readFieldControlState(clientWith({ data: { nicht: 'liste' }, error: null }).client, 'T', GERAET)).toBeNull();
    expect(await readFieldControlState(clientWith(() => Promise.reject(new TypeError('Failed to fetch'))).client, 'T', GERAET)).toBeNull();
    expect(await readFieldControlState(null, 'T', GERAET)).toBeNull();
  });
});

describe('takeFieldControl (take_field_control)', () => {
  const args = { tournamentId: 'T', field: 2, deviceId: GERAET, deviceLabel: 'tablet', expectedEpoch: 1 };

  it('@FU-027 Olli übernimmt Feld 2: sendet Geräte-ID, Bezeichnung und die zuletzt gesehene Epoche, liefert den Vorgänger', async () => {
    const { client, rpc } = clientWith({ data: { status: 'taken', control: OLLI_TABLET, previous: TOM_HANDY, serverTime: 1 }, error: null });
    expect(await takeFieldControl(client, args)).toEqual({ kind: 'taken', control: OLLI_TABLET, previous: TOM_HANDY });
    expect(rpc).toHaveBeenCalledWith('take_field_control', {
      p_tournament_id: 'T', p_field: 2, p_device_id: GERAET, p_expected_epoch: 1, p_device_label: 'tablet',
    });
  });

  it('@HE-049 steuert dieses Gerät schon: „unchanged“ (nur die Bezeichnung wird nachgetragen)', async () => {
    const { client } = clientWith({ data: { status: 'unchanged', control: OLLI_TABLET, serverTime: 1 }, error: null });
    expect(await takeFieldControl(client, args)).toEqual({ kind: 'unchanged', control: OLLI_TABLET });
  });

  it('@FU-028 Gegenbeispiel: ohne Netz (Fetch scheitert) → offline, nichts übernommen', async () => {
    expect(await takeFieldControl(clientWith(() => Promise.reject(new TypeError('Failed to fetch'))).client, args)).toEqual({ kind: 'offline' });
    expect(await takeFieldControl(clientWith({ data: null, error: { message: 'TypeError: Failed to fetch' } }).client, args)).toEqual({ kind: 'offline' });
    expect(await takeFieldControl(null, args)).toEqual({ kind: 'offline' });
  });

  it('@FU-028 veraltete Anfrage (Epoche inzwischen anders) → changed mit dem neuen Halter', async () => {
    const { client } = clientWith({ data: { status: 'rejected', code: 'CONTROL_CHANGED', control: { ...TOM_HANDY, epoch: 3, holderName: 'Maria' }, serverTime: 1 }, error: null });
    expect(await takeFieldControl(client, args)).toEqual({ kind: 'changed', control: { ...TOM_HANDY, epoch: 3, holderName: 'Maria' } });
  });

  it('Gegenbeispiel: ohne Recht → forbidden; anderer Code oder Antwort → error', async () => {
    expect(await takeFieldControl(clientWith({ data: { status: 'rejected', code: 'FORBIDDEN_ACTOR', serverTime: 1 }, error: null }).client, args)).toEqual({ kind: 'forbidden' });
    expect((await takeFieldControl(clientWith({ data: { status: 'rejected', code: 'UNKNOWN_FIELD', serverTime: 1 }, error: null }).client, args)).kind).toBe('error');
    expect((await takeFieldControl(clientWith({ data: 'quatsch', error: null }).client, args)).kind).toBe('error');
    expect((await takeFieldControl(clientWith({ data: null, error: { code: '22023', message: 'Pflicht' } }).client, args)).kind).toBe('error');
  });

  it('ohne Gerätebezeichnung wird p_device_label nicht gesendet', async () => {
    const { client, rpc } = clientWith({ data: { status: 'taken', control: OLLI_TABLET, previous: null, serverTime: 1 }, error: null });
    await takeFieldControl(client, { ...args, deviceLabel: null });
    expect(rpc.mock.calls[0]).toEqual(['take_field_control', { p_tournament_id: 'T', p_field: 2, p_device_id: GERAET, p_expected_epoch: 1 }]);
  });
});
