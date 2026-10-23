/**
 * B-49 (@FU-081, Befund C-SPIELPLAN-UEBERNEHMEN-FEHLT): Ergebnis im Spielplan für ein laufendes Spiel auf einem fremd gesteuerten
 * Feld. Echter Weg der Schnelleingabe (`useScheduleResultEntry` mit echtem LocalMatchStore/MatchEngine/OutboxSender), echte
 * DE-Texte und echter Dialog; der Stand je Feld kommt aus einem Abbild von `field_control_state`/`take_field_control` (A-34).
 * Werte aus dem Gherkin: Spiel 9 läuft auf Feld 2, Toms Handy steuert es, Olli (Turnierleitung) will 3:1 eintragen.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { useImperativeHandle, type Ref } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
const role = vi.hoisted(() => ({ actor: 'leitung', lead: true }));
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => role.actor }));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: (permission: string) => (permission === 'leadMatches' ? role.lead : true) }));
vi.mock('../../../../core/device/deviceId', () => ({ getDeviceId: () => 'olli-tablet' }));
const server = vi.hoisted(() => ({ halter: null as null | { name: string; label: string; mine: boolean }, rpc: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: server.rpc } }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import type { EngineEvent } from '../../../../core/match';
import { NOW, SPIEL_9, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';
import { useScheduleTakeover } from '../useScheduleTakeover';

await initRealDeI18n();

const anpfiff: EngineEvent = { id: 'start', type: 'MATCH_START', actor: 'helper', at: NOW - 120_000, section: 1, clockMs: 0, teamId: null, payload: { rules: RULES } };

function feld2() {
  return server.halter === null ? [] : [{
    field: 2, epoch: 1, holderName: server.halter.name, holderRole: 'helper', holderDeviceLabel: server.halter.label, isMine: server.halter.mine, claimedAt: 1,
  }];
}

interface Handle { enter: (matchId: string, a: number, b: number) => Promise<boolean> }

function Spielplan({ handleRef, showWarning, onTaken }: { handleRef: Ref<Handle>; showWarning: (m: string) => void; onTaken: (id: string) => void }) {
  const tournament = scheduleTournament({ [SPIEL_9]: { field: 2 } });
  const takeover = useScheduleTakeover({ tournamentId: tournament.id, showWarning, onTaken });
  const entry = useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false, offerTakeover: takeover.offerTakeover });
  useImperativeHandle(handleRef, () => ({ enter: entry.enterScore }), [entry.enterScore]);
  return <>{takeover.dialog}</>;
}

async function spielplan(h: ScheduleEngine) {
  const showWarning = vi.fn();
  const onTaken = vi.fn();
  const ref: { current: Handle | null } = { current: null };
  render(<MatchEngineContext.Provider value={h.value}><Spielplan handleRef={ref} showWarning={showWarning} onTaken={onTaken} /></MatchEngineContext.Provider>);
  let saved: boolean | undefined;
  await act(async () => { saved = await ref.current?.enter(SPIEL_9, 3, 1); await settle(); });
  return { showWarning, onTaken, saved };
}

describe('B-49 Spielplan: fremd gesteuertes Feld (@FU-081)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    role.actor = 'leitung';
    role.lead = true;
    server.halter = { name: 'Tom', label: 'phone', mine: false };
    server.rpc.mockReset();
    server.rpc.mockImplementation((fn: string) => Promise.resolve({
      data: fn === 'field_control_state' ? feld2() : { status: 'taken', control: { ...feld2()[0], epoch: 2, holderName: 'Olli', isMine: true }, previous: feld2()[0], serverTime: 1 },
      error: null,
    }));
    h = await makeScheduleEngine();
    h.fetchConfirmed.mockResolvedValue({ events: [{ ...anpfiff, seq: 1 }], newWatermark: 1 });
  });

  it('@FU-081 Olli trägt für das laufende Spiel 9 ein: Hinweis „Feld 2 wird gerade von Tom (Handy) gesteuert“ mit „Spielleitung übernehmen“, nichts gespeichert', async () => {
    const { showWarning, saved } = await spielplan(h);
    expect(saved).toBe(false);
    expect(screen.getByTestId('takeover-halter')).toHaveTextContent('Feld 2 wird gerade von Tom (Handy) gesteuert');
    expect(screen.getByTestId('takeover-confirm')).toHaveTextContent('Spielleitung übernehmen');
    expect(showWarning).not.toHaveBeenCalled();
    expect((await h.store.load(h.value.accountId, SPIEL_9))?.pending).toEqual([]);
    expect(h.api).not.toHaveBeenCalled();
    // Geräte-ID dieses Geräts geht mit (sonst sähe das steuernde Gerät sich selbst als fremd)
    expect(server.rpc).toHaveBeenCalledWith('field_control_state', { p_tournament_id: 'T', p_device_id: 'olli-tablet' });
  });

  it('@FU-081 „Spielleitung übernehmen“ steht auch, wenn Toms Gerät nicht mehr erreichbar ist: Olli übernimmt mit der gesehenen Epoche und kommt ins Cockpit von Spiel 9', async () => {
    const { onTaken } = await spielplan(h);
    await userEvent.click(screen.getByTestId('takeover-confirm'));
    await waitFor(() => expect(onTaken).toHaveBeenCalledWith(SPIEL_9));
    expect(server.rpc).toHaveBeenCalledWith('take_field_control', expect.objectContaining({ p_tournament_id: 'T', p_field: 2, p_device_id: 'olli-tablet', p_expected_epoch: 1 }));
    expect(screen.queryByTestId('takeover-dialog')).toBeNull();
  });

  it('@FU-081 Helfer Clara: nur der Hinweis „Feld 2 wird gerade von Tom (Handy) gesteuert“, kein Übernehmen', async () => {
    role.actor = 'helper';
    role.lead = false;
    const { showWarning } = await spielplan(h);
    expect(showWarning).toHaveBeenCalledWith('Feld 2 wird gerade von Tom (Handy) gesteuert');
    expect(screen.queryByTestId('takeover-dialog')).toBeNull();
  });

  it.each([
    ['Feld 2 ist frei', null],
    ['dieses Gerät steuert Feld 2 selbst', { name: 'Olli', label: 'tablet', mine: true }],
  ])('@FU-081 Gegenbeispiel: %s → wie bisher „Spiel läuft – Ergebnis erst nach dem Abpfiff“, kein Dialog', async (_fall, halter) => {
    server.halter = halter;
    const { showWarning } = await spielplan(h);
    expect(showWarning).toHaveBeenCalledWith('Spiel läuft – Ergebnis erst nach dem Abpfiff');
    expect(screen.queryByTestId('takeover-dialog')).toBeNull();
  });

  it('Gegenbeispiel: Stand nicht lesbar (ohne Netz) → „Spiel läuft – Ergebnis erst nach dem Abpfiff“', async () => {
    server.rpc.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const { showWarning } = await spielplan(h);
    expect(showWarning).toHaveBeenCalledWith('Spiel läuft – Ergebnis erst nach dem Abpfiff');
  });
});
