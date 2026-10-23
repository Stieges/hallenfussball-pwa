/**
 * B-49 Fixrunde (Review #341 A1, Brief A-34 L7 „Epoche stempeln“): Einträge tragen die Steuer-Epoche, solange dieses Gerät das
 * Feld steuert (`view === 'mine' ? epoch : null`). Echter Weg: `useCockpitFieldControl` setzt die Epoche, `MatchCommands`
 * speichert, `OutboxSender` sendet (echter LocalMatchStore/MatchEngine, fake-indexeddb). Der Server ist ein Abbild der Prüfung
 * c3 aus `20261110_003_field_control.sql` (`append_match_events`, :343-362, Anspruch f2 :427-436):
 *   laufendes Spiel oder MATCH_START/REOPEN → Feld frei: mit Geräte-ID Anspruch (Epoche +1) nach Annahme;
 *   Halter (Gerät gleich): controlEpoch gesetzt und ≠ Epoche → NOT_CONTROLLER/STALE_EPOCH (nicht nach einem Anspruch im selben
 *   Aufruf); anderes Gerät → NOT_CONTROLLER/OTHER_DEVICE.
 * Werte aus dem Gherkin: Olli (Tablet) leitet Spiel 9 auf Feld 1, Maria übernimmt (@FU-027), Olli holt zurück.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../core/device/deviceId', () => ({ getDeviceId: () => 'olli-tablet' }));

const server = vi.hoisted(() => ({
  feld: { epoch: 0, halter: null as string | null, label: null as string | null },
  gestartet: new Set<string>(),
  online: true,
  rpc: vi.fn(),
}));
vi.mock('../../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: server.rpc } }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { MatchCommands } from '../../../../core/match/client';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import { networkError, resultOf, success } from '../../../../core/match/client/__tests__/outboxHarness';
import type { AppendableEvent, AppendOptions } from '../../../../core/repositories/appendMatchEventsRpc';
import { controlEpochFor, resetControlEpochsForTests } from '../../../../core/fieldControl/controlEpochs';
import { buildValidMatches } from '../../../../hooks/engineMatchModel';
import type { LiveMatch } from '../../../../components/live-cockpit/types';
import { SPIEL_9, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import { useCockpitFieldControl } from '../useCockpitFieldControl';

await initRealDeI18n();

const LIVE = ['MATCH_START', 'REOPEN'];

/** Abbild von append_match_events c3 und f2 (nur die Steuer; alles andere angenommen). */
function append(matchId: string, events: readonly AppendableEvent[], options: AppendOptions) {
  if (!server.online) {
    return Promise.reject(networkError());
  }
  const geraet = options.deviceId ?? null;
  let angesprochen = false;
  const results = events.map((event) => {
    if (server.gestartet.has(matchId) || LIVE.includes(event.type)) {
      const f = server.feld;
      if (f.halter === null) {
        if (geraet !== null) {
          server.feld = { epoch: f.epoch + 1, halter: geraet, label: null };
          angesprochen = true;
        }
      } else if (f.halter === geraet) {
        const gesendet = event.controlEpoch ?? null;
        if (!angesprochen && gesendet !== null && gesendet !== f.epoch) {
          return resultOf(event.id, 'rejected', 'NOT_CONTROLLER', { reason: 'STALE_EPOCH' });
        }
      } else {
        return resultOf(event.id, 'rejected', 'NOT_CONTROLLER', { reason: 'OTHER_DEVICE' });
      }
    }
    if (event.type === 'MATCH_START') { server.gestartet.add(matchId); }
    return resultOf(event.id, 'accepted');
  });
  return Promise.resolve(success(results));
}

function feldStand(fragt: string) {
  const f = server.feld;
  return [{
    field: 1, epoch: f.epoch, holderName: f.halter === null ? null : 'Olli', holderRole: f.halter === null ? null : 'owner',
    holderDeviceLabel: f.label, isMine: f.halter === fragt, claimedAt: f.halter === null ? null : 1,
  }];
}

const tournament = scheduleTournament();
const entry = (() => {
  const found = buildValidMatches(tournament).find((candidate) => candidate.externalId === SPIEL_9);
  if (!found) { throw new Error('Spiel 9 fehlt'); }
  return found;
})();

function Cockpit() {
  useCockpitFieldControl({
    tournamentId: tournament.id, feld: 1, feldName: 'Feld 1', canPlay: true, istLeitung: true, feldLaeuft: true,
    currentMatch: { id: entry.matchId, status: 'RUNNING' } as LiveMatch,
  });
  return null;
}

async function aufbau(): Promise<{ h: ScheduleEngine; commands: MatchCommands }> {
  const h = await makeScheduleEngine(undefined, { deviceId: 'olli-tablet' });
  h.api.mockImplementation(append);
  render(<MatchEngineContext.Provider value={h.value}><Cockpit /></MatchEngineContext.Provider>);
  await h.engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
  return { h, commands: new MatchCommands({ engine: h.engine, store: h.store, sender: h.value.sender, accountId: h.value.accountId }) };
}

const kopie = (h: ScheduleEngine) => h.store.load(h.value.accountId, entry.matchId);

describe('B-49 Steuer-Epoche beim Speichern (Brief A-34 L7)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    resetControlEpochsForTests();
    server.feld = { epoch: 0, halter: null, label: null };
    server.gestartet.clear();
    server.online = true;
    server.rpc.mockReset();
    server.rpc.mockImplementation((fn: string, args: { p_device_id: string }) => Promise.resolve({
      data: fn === 'field_control_state' ? feldStand(args.p_device_id) : { status: 'unchanged', control: feldStand(args.p_device_id)[0], serverTime: 1 },
      error: null,
    }));
  });

  it('@FU-027 altes Tor nach Rück-Übernahme wird abgelehnt (STALE_EPOCH): Ollis offline erfasstes Tor zählt nicht doppelt', async () => {
    server.feld = { epoch: 1, halter: 'olli-tablet', label: 'computer' };
    const { h, commands } = await aufbau();
    await waitFor(() => expect(controlEpochFor(entry.matchId)).toBe(1));
    await act(async () => { await commands.start(entry.matchId, entry.ctx, 'leitung', RULES); await settle(); });

    server.online = false; // Hallen-WLAN weg: Ollis Tor bleibt im Ausgang
    let tor: string | null = null;
    await act(async () => { tor = await commands.goal(entry.matchId, entry.ctx, 'leitung', entry.ctx.teamAId, false); await settle(); });
    const wartend = (await kopie(h))?.pending.find((e) => e.id === tor) as AppendableEvent | undefined;
    expect(wartend?.controlEpoch).toBe(1);

    // Maria übernimmt (Epoche 2) und trägt dasselbe Tor ein, Olli holt die Steuer zurück (Epoche 3)
    server.feld = { epoch: 3, halter: 'olli-tablet', label: 'computer' };
    server.online = true;
    await act(async () => { await h.sender.kick(entry.matchId); await settle(); });

    const nachher = await kopie(h);
    expect(nachher?.rejected.map((r) => [r.event.id, r.code])).toEqual([[tor, 'NOT_CONTROLLER']]);
    expect(nachher?.pending).toEqual([]);
  });

  it('Gegenbeispiel: nach dem Zurückholen gilt die neue Epoche – Ollis nächstes Tor wird angenommen', async () => {
    server.feld = { epoch: 3, halter: 'olli-tablet', label: 'computer' };
    server.gestartet.add(entry.matchId);
    const { h, commands } = await aufbau();
    await waitFor(() => expect(controlEpochFor(entry.matchId)).toBe(3));
    await act(async () => { await commands.start(entry.matchId, entry.ctx, 'leitung', RULES); await settle(); });
    await act(async () => { await commands.goal(entry.matchId, entry.ctx, 'leitung', entry.ctx.teamAId, false); await settle(); });
    expect((await kopie(h))?.rejected).toEqual([]);
    expect(h.api.mock.calls.flatMap(([, events]) => events.map((e) => e.controlEpoch))).toEqual([3, 3]);
  });

  it('@FU-030 Gegenbeispiel: Anspruch per Anpfiff (Epoche 0 → 1), auch der spätere Stapel (über 50 Einträge) wird angenommen', async () => {
    const { h, commands } = await aufbau();
    await waitFor(() => expect(server.rpc).toHaveBeenCalledWith('field_control_state', expect.anything()));
    expect(controlEpochFor(entry.matchId)).toBeNull(); // Feld frei: nicht stempeln

    server.online = false;
    await act(async () => {
      await commands.start(entry.matchId, entry.ctx, 'leitung', RULES);
      for (let i = 0; i < 55; i++) { await commands.foul(entry.matchId, entry.ctx, 'leitung', entry.ctx.teamAId); }
      await settle();
    });
    server.online = true;
    await act(async () => { await h.sender.kick(entry.matchId); await settle(60); });

    const nachher = await kopie(h);
    expect(nachher?.rejected).toEqual([]);
    expect(nachher?.pending).toEqual([]);
    expect(server.feld).toMatchObject({ epoch: 1, halter: 'olli-tablet' });
    const gesendet = h.api.mock.calls.filter(([, events]) => events.length > 0);
    expect(gesendet.length).toBeGreaterThanOrEqual(2); // zwei Stapel (≤ 50)
    expect(gesendet.flatMap(([, events]) => events.map((e) => e.controlEpoch ?? null)).every((e) => e === null)).toBe(true);
  });

  it('Gegenbeispiel: fremd gesteuertes Feld – keine Epoche (Einträge wären ohnehin OTHER_DEVICE)', async () => {
    server.feld = { epoch: 2, halter: 'maria-handy', label: 'phone' };
    await aufbau();
    await waitFor(() => expect(server.rpc).toHaveBeenCalledWith('field_control_state', expect.anything()));
    await act(async () => { await settle(); });
    expect(controlEpochFor(entry.matchId)).toBeNull();
  });
});
