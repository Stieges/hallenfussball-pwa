/**
 * @ZM-179 „Bei einem Turnier nur auf diesem Gerät folgt ein Monitor im selben Browser sofort“ (R5 PR 1, F3):
 * Gegeben das Turnier „Probe“ ist nicht online und der Monitor läuft im zweiten Fenster desselben Browsers,
 * wenn Tom ein Tor einträgt, dann zeigt der Monitor nach höchstens 1 Sekunde den neuen Stand.
 *
 * Spike 29.10.: die Einträge stehen nur in den Engine-Kopien (IndexedDB), nicht in der Turnierkopie – ohne den
 * Engine-Stand sah der Monitor das Tor nie. Hier: Stand aus den Kopien + Signal über den BroadcastChannel der Engine.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MatchCopy } from '../../../core/match/client';
import type { EngineEvent } from '../../../core/match/types';
import { BROADCAST_CHANNELS } from '../../../constants/storage';
import { subscribeLocalDisplaySignal, withLocalEngineState } from '../localDisplay';
import { B07_CTX, B07_RULES, KICKOFF_AT } from '../../../core/match/client/__tests__/commandHarness';
import { looseVs } from '../../../test/matchSlotFixtures';
import { createMockTournament } from '../../../test/factories';
import type { Tournament } from '../../../types/tournament';

function ev(type: EngineEvent['type'], seq: number, extra: Partial<EngineEvent> = {}): EngineEvent & { seq: number } {
  return { id: `ev-${seq}`, type, actor: 'helper', at: KICKOFF_AT + seq * 1000, section: 1, clockMs: seq * 1000, teamId: null, targetId: null, payload: {}, ...extra, seq };
}

function copy(matchId: string, confirmed: Array<EngineEvent & { seq: number }>, updatedAt = 1, accountId = 'guest'): MatchCopy {
  return {
    formatVersion: 2, accountId, matchId, ctx: { ...B07_CTX, matchId }, confirmed, watermarkSeq: confirmed.length,
    acked: [], pending: [], rejected: [], review: [], updatedAt,
  };
}

/** Turnier „Probe“ nur auf diesem Gerät: Spiel 11 FC Nord – SV Süd, in der Turnierkopie noch 0:0 und geplant. */
const probe: Tournament = createMockTournament({
  id: 'probe', title: 'Probe', teams: [{ id: 'fc-nord', name: 'FC Nord' }, { id: 'sv-sued', name: 'SV Süd' }],
  matches: [{ id: 'Spiel-11', matchNumber: 11, round: 1, field: 1, ...looseVs('fc-nord', 'sv-sued'), matchStatus: 'scheduled' }],
});

const anpfiff = ev('MATCH_START', 1, { payload: { rules: B07_RULES } });
const torNord = ev('GOAL', 2, { teamId: 'fc-nord' });

describe('@ZM-179 Stand aus den Engine-Kopien dieses Browsers', () => {
  it('Tom trägt ein Tor ein -> der Monitor sieht 1:0 und „läuft“ (Turnierkopie allein: 0:0, geplant)', async () => {
    const result = await withLocalEngineState(probe, { all: () => Promise.resolve([copy('spiel-11', [anpfiff, torNord])]) });
    expect(result.matches[0]).toMatchObject({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    expect(probe.matches[0].scoreA).toBeUndefined();
  });

  it('mehrere Konten: die jüngste Kopie gilt', async () => {
    const alt = copy('spiel-11', [anpfiff], 1, 'konto-a');
    const neu = copy('spiel-11', [anpfiff, torNord, ev('GOAL', 3, { teamId: 'sv-sued' })], 5, 'guest');
    const result = await withLocalEngineState(probe, { all: () => Promise.resolve([neu, alt]) });
    expect(result.matches[0]).toMatchObject({ scoreA: 1, scoreB: 1 });
  });

  it('Gegenbeispiel: keine Kopie bzw. leere Kopie -> Turnierkopie unverändert (dieselbe Referenz)', async () => {
    expect(await withLocalEngineState(probe, { all: () => Promise.resolve([]) })).toBe(probe);
    expect(await withLocalEngineState(probe, { all: () => Promise.resolve([copy('spiel-11', [])]) })).toBe(probe);
  });

  it('Lesefehler der Kopien -> Turnierkopie unverändert, kein Absturz', async () => {
    expect(await withLocalEngineState(probe, { all: () => Promise.reject(new Error('IndexedDB gesperrt')) })).toBe(probe);
  });
});

describe('@ZM-179 Signal im selben Browser', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('die Engine meldet eine geänderte Kopie (BroadcastChannel) -> Signal', async () => {
    const onSignal = vi.fn();
    const off = subscribeLocalDisplaySignal(onSignal);
    const engineTab = new BroadcastChannel(BROADCAST_CHANNELS.MATCH_ENGINE);
    engineTab.postMessage({ matchId: 'spiel-11' });
    await vi.waitFor(() => { expect(onSignal).toHaveBeenCalledTimes(1); });
    engineTab.close();
    off();
  });

  it('storage-Ereignis (Speicher ohne IndexedDB) -> Signal; nach dem Abmelden nicht mehr', () => {
    const onSignal = vi.fn();
    const off = subscribeLocalDisplaySignal(onSignal);
    window.dispatchEvent(new StorageEvent('storage', { key: 'tournaments' }));
    expect(onSignal).toHaveBeenCalledTimes(1);
    off();
    window.dispatchEvent(new StorageEvent('storage', { key: 'tournaments' }));
    expect(onSignal).toHaveBeenCalledTimes(1);
  });

  it('Kanalname = der Kanal der Engine', () => {
    expect(BROADCAST_CHANNELS.MATCH_ENGINE).toBe('hallenfussball-matches');
  });
});
