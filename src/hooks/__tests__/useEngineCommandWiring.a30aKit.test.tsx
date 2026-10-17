/**
 * A-30a (@SL-137, @SL-138, @W3-028, @W3-029): der heutige Anpfiff (Cockpit) sendet bei JEDEM Anpfiff die
 * Vorbelegung `defaultKit` mit (Controller-Entscheidung F1). Die Leibchen-Wahl selbst baut die Cockpit-Scheibe 3
 * (R-A30-3); bis dahin gilt die Vorbelegung (Heimseite mit Leibchen in der Leibchenfarbe des Turniers).
 * Fehlerpolitik: ein Client-Fehler in `kit` stoppt den Anpfiff mit verständlicher Meldung (i18n).
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';

const mockShowWarning = vi.fn();
vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: mockShowWarning, showError: vi.fn(), showInfo: vi.fn() }),
}));
vi.mock('../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { useEngineCommandWiring } from '../useEngineCommandWiring';
import { rejectionMessageKey } from '../engineCommandWiringHelpers';
import { MatchCommandRejectedError } from '../../core/match/client';
import { ERROR_CODES } from '../../core/match/types';
import { DEFAULT_BIB_COLOR } from '../../core/models/kit';
import { looseVs } from '../../test/matchSlotFixtures';
import { makeEngineContext } from '../../test/engineContextFixture';

const MATCH_ID = 'engine-1';
const ROT = '#C62828';
const WEISS = '#FFFFFF';
const ORANGE = '#FF6600';

function tournament(colorA: string | undefined, colorB: string | undefined, bibColor?: string): Tournament {
  const team = (id: string, name: string, primary: string | undefined) => (primary ? { id, name, colors: { primary } } : { id, name });
  return {
    id: 'tour-a30a',
    matches: [{ id: MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 12 }],
    teams: [team('teama', 'SV Süd', colorA), team('teamb', 'FC Nord', colorB)],
    groupPhaseGameDuration: 20,
    ...(bibColor !== undefined ? { bibColor } : {}),
  } as unknown as Tournament;
}

async function startAndReadKit(t: Tournament): Promise<unknown> {
  const engineContext = await makeEngineContext();
  const engineLiveMatches = new Map<string, LiveMatch>([[MATCH_ID, { id: MATCH_ID } as unknown as LiveMatch]]);
  const { result } = renderHook(() => useEngineCommandWiring(t, engineContext, engineLiveMatches));
  expect(await result.current.handleStart(MATCH_ID)).toBe(true);
  const copy = await engineContext.store.load(engineContext.accountId, MATCH_ID);
  const start = copy?.pending.find((event) => event.type === 'MATCH_START');
  return start?.payload.kit;
}

describe('A-30a useEngineCommandWiring: Anpfiff sendet die Vorbelegung kit', () => {
  beforeEach(() => {
    mockShowWarning.mockClear();
  });

  it('@SL-137 beide Rot, Leibchenfarbe Gelb (Vorgabe) → Heimseite mit Leibchen Gelb', async () => {
    expect(await startAndReadKit(tournament(ROT, ROT))).toEqual({ a: DEFAULT_BIB_COLOR, b: ROT, bibSide: 'a' });
  });

  it('@W3-029 Leibchenfarbe des Turniers Orange → Orange vorbelegt', async () => {
    expect(await startAndReadKit(tournament(ROT, ROT, ORANGE))).toEqual({ a: ORANGE, b: ROT, bibSide: 'a' });
  });

  it('@SL-138 Rot gegen Weiß → beide Farben, kein Leibchen, Anpfiff ohne Zusatzschritt', async () => {
    expect(await startAndReadKit(tournament(ROT, WEISS))).toEqual({ a: ROT, b: WEISS });
    expect(mockShowWarning).not.toHaveBeenCalled();
  });

  it('@W3-028 ohne eingetragene Farben geht ein leeres kit mit (Spiel behält „keine Farbe“)', async () => {
    expect(await startAndReadKit(tournament(undefined, undefined))).toEqual({});
  });
});

describe('A-30a Meldung bei ungültigem kit', () => {
  it('@SL-137 Fehlerpolitik: INVALID_KIT → eigener, verständlicher Text', () => {
    const error = new MatchCommandRejectedError(ERROR_CODES.INVALID_PAYLOAD, { reason: 'INVALID_KIT' });
    expect(rejectionMessageKey(error)).toBe('engine.invalidKit');
  });

  it('Gegenbeispiel: eine andere INVALID_PAYLOAD-Ablehnung bleibt „gerade nicht möglich“', () => {
    const error = new MatchCommandRejectedError(ERROR_CODES.INVALID_PAYLOAD, { reason: 'SHOOTOUT_REQUIRED' });
    expect(rejectionMessageKey(error)).toBe('engine.invalid');
  });
});
