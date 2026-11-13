/**
 * A-30a (@SL-137, @SL-138, @W3-028, @W3-029) und Leibchen 2b (@SL-210, @SL-149, @SL-202): der Anpfiff sendet bei JEDEM Anpfiff ein `kit` mit
 * (Controller-Entscheidung F1) – aber keine Vorbelegung mehr: ohne Tipp keine Leibchen, bestätigt die gewählte Seite, „Keine Leibchen“ ausdrücklich
 * mit `bibSide: null`. Fehlerpolitik: ein Client-Fehler in `kit` stoppt den Anpfiff mit verständlicher Meldung (i18n).
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

function tournament(colorA: string | undefined, colorB: string | undefined, bibColor?: string, spiel: Record<string, unknown> = {}): Tournament {
  const team = (id: string, name: string, primary: string | undefined) => (primary ? { id, name, colors: { primary } } : { id, name });
  return {
    id: 'tour-a30a',
    matches: [{ id: MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 12, ...spiel }],
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

describe('A-30a useEngineCommandWiring: Anpfiff sendet das kit ohne Vorbelegung', () => {
  beforeEach(() => {
    mockShowWarning.mockClear();
  });

  it('@SL-210 beide Rot, nichts getippt → beide Trikotfarben, kein Schlüssel bibSide (keine stille Vorbelegung)', async () => {
    const kit = await startAndReadKit(tournament(ROT, ROT));
    expect(kit).toEqual({ a: ROT, b: ROT });
    expect(kit).not.toHaveProperty('bibSide');
  });

  it('@SL-210 Gegenbeispiel: auch mit Hallenfarbe Orange im Turnier belegt der Anpfiff nichts vor', async () => {
    expect(await startAndReadKit(tournament(ROT, ROT, ORANGE))).toEqual({ a: ROT, b: ROT });
  });

  it('@SL-202 Tom hat „SV Süd zieht Gelb“ bestätigt → der Anpfiff nennt die Seite und die Leibchenfarbe', async () => {
    const t = tournament(ROT, ROT, undefined, { kitDecision: 'bib', kit: { a: DEFAULT_BIB_COLOR, bibSide: 'a' } });
    expect(await startAndReadKit(t)).toEqual({ a: DEFAULT_BIB_COLOR, b: ROT, bibSide: 'a' });
  });

  it('@SL-149 Tom hat „Keine Leibchen“ getippt → der Anpfiff sendet ausdrücklich bibSide null', async () => {
    expect(await startAndReadKit(tournament(ROT, ROT, undefined, { kitDecision: 'none' }))).toEqual({ a: ROT, b: ROT, bibSide: null });
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
