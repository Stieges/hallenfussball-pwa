/**
 * B-49 (@FU-081, Befund C-SPIELPLAN-UEBERNEHMEN-FEHLT): Ergebnis im Spielplan für ein laufendes Spiel auf einem fremd gesteuerten
 * Feld. Echter Weg der Schnelleingabe (`useScheduleResultEntry` mit echtem LocalMatchStore/MatchEngine/OutboxSender), echte
 * DE-Texte und echter Dialog; der Stand je Feld kommt aus einem Abbild von `field_control_state`/`take_field_control` (A-34).
 * Werte aus dem Gherkin: Spiel 9 läuft auf Feld 2, Toms Handy steuert es, Olli (Turnierleitung) will 3:1 eintragen.
 * Mit „Spiel beenden und Ergebnis eintragen“ (#337, @FU-112) bekommt die Turnierleitung bei einem laufenden Spiel die
 * Rückfrage „Spiel beenden“; steuert ein anderes Gerät das Feld, steht dort der Hinweis und zusätzlich „Spielleitung
 * übernehmen“ (@FU-081: beenden ohne Übernahme ODER übernehmen). Helfer bekommen wie bisher nur den Hinweis.
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
import { ScheduleResultEntryPrompt } from '../../components/ScheduleResultEntryPrompt';

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
  return <><ScheduleResultEntryPrompt prompt={entry.prompt} answerPrompt={entry.answerPrompt} />{takeover.dialog}</>;
}

async function spielplan(h: ScheduleEngine) {
  const showWarning = vi.fn();
  const onTaken = vi.fn();
  const ref: { current: Handle | null } = { current: null };
  render(<MatchEngineContext.Provider value={h.value}><Spielplan handleRef={ref} showWarning={showWarning} onTaken={onTaken} /></MatchEngineContext.Provider>);
  let done: Promise<boolean> = Promise.resolve(true);
  // Die Turnierleitung bekommt eine Rückfrage: der Eintrag endet erst mit der Antwort, deshalb hier nicht abwarten.
  await act(async () => { done = ref.current?.enter(SPIEL_9, 3, 1) ?? done; await settle(); });
  return { showWarning, onTaken, done };
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
    const { showWarning } = await spielplan(h);
    expect(screen.getByTestId('result-entry-end-controlled')).toHaveTextContent('Feld 2 wird gerade von Tom (Handy) gesteuert');
    expect(screen.getByTestId('confirm-dialog-secondary')).toHaveTextContent('Spielleitung übernehmen');
    expect(showWarning).not.toHaveBeenCalled();
    expect((await h.store.load(h.value.accountId, SPIEL_9))?.pending).toEqual([]);
    expect(h.api).not.toHaveBeenCalled();
    // Geräte-ID dieses Geräts geht mit (sonst sähe das steuernde Gerät sich selbst als fremd)
    expect(server.rpc).toHaveBeenCalledWith('field_control_state', { p_tournament_id: 'T', p_device_id: 'olli-tablet' });
  });

  it('@FU-081 „Spielleitung übernehmen“ steht auch, wenn Toms Gerät nicht mehr erreichbar ist: Olli übernimmt mit der gesehenen Epoche und kommt ins Cockpit von Spiel 9', async () => {
    const { onTaken, done } = await spielplan(h);
    await userEvent.click(screen.getByTestId('confirm-dialog-secondary'));
    expect(await done).toBe(false); // nichts eingetragen, das Spiel läuft weiter
    await userEvent.click(await screen.findByTestId('takeover-confirm'));
    await waitFor(() => expect(onTaken).toHaveBeenCalledWith(SPIEL_9));
    expect(server.rpc).toHaveBeenCalledWith('take_field_control', expect.objectContaining({ p_tournament_id: 'T', p_field: 2, p_device_id: 'olli-tablet', p_expected_epoch: 1 }));
    expect(screen.queryByTestId('takeover-dialog')).toBeNull();
    expect(h.api).not.toHaveBeenCalled();
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
    ['dieses Gerät steuert Feld 2 selbst', { name: 'Clara', label: 'tablet', mine: true }],
  ])('@FU-081 Gegenbeispiel Helfer: %s → wie bisher „Spiel läuft – Ergebnis erst nach dem Abpfiff“, kein Dialog', async (_fall, halter) => {
    role.actor = 'helper';
    role.lead = false;
    server.halter = halter;
    const { showWarning } = await spielplan(h);
    expect(showWarning).toHaveBeenCalledWith('Spiel läuft – Ergebnis erst nach dem Abpfiff');
    expect(screen.queryByTestId('takeover-dialog')).toBeNull();
  });

  it('Gegenbeispiel Helfer: Stand nicht lesbar (ohne Netz) → „Spiel läuft – Ergebnis erst nach dem Abpfiff“', async () => {
    role.actor = 'helper';
    role.lead = false;
    server.rpc.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const { showWarning } = await spielplan(h);
    expect(showWarning).toHaveBeenCalledWith('Spiel läuft – Ergebnis erst nach dem Abpfiff');
  });

  it.each([
    ['Feld 2 ist frei', null],
    ['dieses Gerät steuert Feld 2 selbst', { name: 'Olli', label: 'tablet', mine: true }],
  ])('@FU-081 Gegenbeispiel Turnierleitung: %s → Rückfrage „Spiel beenden“ ohne Hinweis und ohne „Spielleitung übernehmen“', async (_fall, halter) => {
    server.halter = halter;
    const { done } = await spielplan(h);
    expect(screen.getByTestId('result-entry-end-message')).toBeInTheDocument();
    expect(screen.queryByTestId('result-entry-end-controlled')).toBeNull();
    expect(screen.queryByTestId('confirm-dialog-secondary')).toBeNull();
    await userEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(await done).toBe(false);
  });
});
