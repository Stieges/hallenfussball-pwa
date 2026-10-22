/**
 * Spiel beenden (@FU-115, @FU-081): kleiner Lesepfad `field_control_state` für den Hinweis „Feld 2 wird gerade von Tom
 * gesteuert“. Antwortform wie `field_control_info` (20261110_003): {field, epoch, holderName, holderRole,
 * holderDeviceLabel, isMine, claimedAt}. Fehler oder unbekannte Antwort → kein Hinweis (null).
 */
import { describe, it, expect, vi } from 'vitest';
import { holderText, readForeignFieldHolder } from '../fieldControlStateRpc';

const feld = (field: number, extra: Record<string, unknown>) => ({
  field, epoch: 1, holderName: null, holderRole: null, holderDeviceLabel: null, isMine: false, claimedAt: null, ...extra,
});
const clientWith = (data: unknown, error: { message: string } | null = null) => {
  const rpc = vi.fn(() => Promise.resolve({ data, error }));
  return { client: { rpc } as never, rpc };
};

describe('holderText', () => {
  it('Name und Gerät: „Tom (Handy)“; nur Name; nur Gerät; nichts → null', () => {
    expect(holderText('Tom', 'Handy')).toBe('Tom (Handy)');
    expect(holderText('Tom', null)).toBe('Tom');
    expect(holderText(null, 'Tablet Halle')).toBe('Tablet Halle');
    expect(holderText('  ', ' ')).toBeNull();
  });
});

describe('readForeignFieldHolder', () => {
  it('@FU-115 Toms Handy steuert Feld 2 → { field: 2, holder: „Tom (Handy)“ }', async () => {
    const { client, rpc } = clientWith([feld(1, { holderName: 'Olli', holderRole: 'owner', isMine: true }), feld(2, { holderName: 'Tom', holderRole: 'helper', holderDeviceLabel: 'Handy' })]);
    expect(await readForeignFieldHolder(client, 'T', 2)).toEqual({ field: 2, holder: 'Tom (Handy)' });
    expect(rpc).toHaveBeenCalledWith('field_control_state', { p_tournament_id: 'T' });
  });

  it('Gegenbeispiel: dieses Gerät steuert Feld 1 → kein Hinweis', async () => {
    const { client } = clientWith([feld(1, { holderName: 'Olli', holderRole: 'owner', isMine: true })]);
    expect(await readForeignFieldHolder(client, 'T', 1)).toBeNull();
  });

  it('Gegenbeispiel: Feld frei (kein Halter) oder ohne Zeile → kein Hinweis', async () => {
    expect(await readForeignFieldHolder(clientWith([feld(3, {})]).client, 'T', 3)).toBeNull();
    expect(await readForeignFieldHolder(clientWith([]).client, 'T', 3)).toBeNull();
  });

  it('Halter ohne Namen und Gerät → Hinweis ohne Namen (holder null)', async () => {
    const { client } = clientWith([feld(2, { holderRole: 'helper' })]);
    expect(await readForeignFieldHolder(client, 'T', 2)).toEqual({ field: 2, holder: null });
  });

  it('Fehler, unbekannte Antwort oder kein Client → null', async () => {
    expect(await readForeignFieldHolder(clientWith(null, { message: 'kaputt' }).client, 'T', 2)).toBeNull();
    expect(await readForeignFieldHolder(clientWith({ nicht: 'liste' }).client, 'T', 2)).toBeNull();
    expect(await readForeignFieldHolder(null, 'T', 2)).toBeNull();
  });
});
