/**
 * useEngineEventEditing (C3b-1): Minus/Rueckgaengig/Loeschen/Bearbeiten fuer Engine-Spiele auf
 * RETRACT/AMEND -- Zielwahl, Sperrgruende + Hinweistexte (G1-G5, G10), Toast erst nach aufgeloestem
 * `submit` (G4). Altspiele (ohne Engine-Kopie mit Ereignissen) laufen unveraendert ueber die Alt-Handler.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LocalMatchStore, ClockSync, MatchEngine, MatchCommands, toLiveMatchView } from '../../core/match/client';
import type { Actor, MatchContext, MatchRules } from '../../core/match';
import { MatchEngineContext, type MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';

// Echte deutsche Texte statt Schluessel -- die Tests pruefen Wortlaut und Ziel-Beschriftung.
// Stabile `t`-Referenz wie in react-i18next (sonst laufen Effekte mit `t` in den Abhaengigkeiten endlos).
vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../i18n/locales/de/cockpit.json')).default;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      de,
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) {
      text = text.replace(`{{${name}}}`, String(value));
    }
    return text;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const mockActor: { current: Actor } = { current: 'helper' };
vi.mock('../useActorRole', () => ({ useActorRole: () => mockActor.current }));

import { useEngineEventEditing } from '../useEngineEventEditing';

const NOW = 1_790_000_000_000;
const MATCH_ID = 'match-1';
const CTX: MatchContext = { matchId: MATCH_ID, teamAId: 'teama', teamBId: 'teamb' };
const RULES: MatchRules = {
  sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: false, tiebreak: null,
  overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120,
};
let counter = 0;

async function setup(rules: MatchRules = RULES) {
  const accountId = `acc-edit-${(counter += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(NOW), () => NOW, { get: () => null, set: () => undefined });
  const engine = new MatchEngine({
    store, clock, sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn(), now: () => NOW,
  });
  await engine.start(accountId);
  await engine.ensureMatch(MATCH_ID, CTX);
  const value = {
    engine, store, clock, sender: { kick: vi.fn().mockResolvedValue(undefined) }, accountId,
  } as unknown as MatchEngineContextValue;
  const commands = new MatchCommands({ engine, store, sender: value.sender, accountId });
  await commands.start(MATCH_ID, CTX, 'leitung', rules);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MatchEngineContext.Provider value={value}>{children}</MatchEngineContext.Provider>
  );
  return { value, commands, wrapper, store, accountId, engine };
}

function matchOf(value: MatchEngineContextValue, overrides: Record<string, unknown> = {}) {
  const view = value.engine.view(MATCH_ID);
  if (!view) { throw new Error('keine Ansicht'); }
  const live = toLiveMatchView(
    view.result.state,
    {
      id: MATCH_ID, number: 1, phaseLabel: 'A', fieldId: 'f', scheduledKickoff: new Date(NOW).toISOString(),
      homeTeam: { id: 'teama', name: 'Heim' }, awayTeam: { id: 'teamb', name: 'Gast' }, version: 0,
    },
    { serverNow: NOW, offsetMs: 0 },
    view.log,
  );
  return { ...live, ...overrides };
}

function baseParams(match: ReturnType<typeof matchOf>, extra: Partial<Parameters<typeof useEngineEventEditing>[0]> = {}) {
  return {
    tournamentId: 't1',
    match,
    readOnly: false,
    legacy: { onGoal: vi.fn(), onUndoLastEvent: vi.fn(), onUpdateEvent: vi.fn(), onDeleteEvent: vi.fn() },
    notify: { success: vi.fn(), error: vi.fn() },
    ...extra,
  };
}

describe('useEngineEventEditing -- Engine-Spiel', () => {
  beforeEach(() => { mockActor.current = 'helper'; });

  it('G1a: Rueckgaengig-Beschriftung nennt das Ziel ("Tor Nr. 7 zurücknehmen"), Toast nennt es erneut', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoLabel).toBe('Tor Nr. 7 zurücknehmen');
    await act(async () => { await result.current.undo(); });
    expect(params.notify.success).toHaveBeenCalledWith('Tor Nr. 7 zurückgenommen');
    const copy = await value.store.load(value.accountId, MATCH_ID);
    expect(copy?.pending.some((e) => e.type === 'RETRACT')).toBe(true);
  });

  it('G1a: Rueckgaengig trifft nach einer Bearbeitung weiter das Tor (AMEND uebersprungen)', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false);
    const goalId = (await value.store.load(value.accountId, MATCH_ID))!.pending.find((e) => e.type === 'GOAL')!.id;
    await commands.amend(MATCH_ID, CTX, 'helper', goalId, { playerNumber: 9 }, []);
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    expect(result.current.undoLabel).toBe('Tor Nr. 9 zurücknehmen');
  });

  it('G4: Toast erst NACH aufgeloestem submit (nicht davor)', async () => {
    const { value, commands, wrapper, store } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = store.addPending.bind(store);
    vi.spyOn(store, 'addPending').mockImplementation(async (...args) => { await gate; await original(...args); });
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });

    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.minus('home'); });
    await act(async () => { await Promise.resolve(); });
    expect(params.notify.success).not.toHaveBeenCalled();
    await act(async () => { release(); await pending; });
    expect(params.notify.success).toHaveBeenCalledTimes(1);
  });

  it('Minus (G2): hebt das letzte Tor des Teams auf, ohne Autor-Filter; Label nennt das Ziel', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'leitung', 'teama', false, { playerNumber: 4 });
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    expect(result.current.sides.home.canMinus).toBe(true);
    expect(result.current.sides.away.canMinus).toBe(false);
    expect(result.current.sides.home.label).toBe('Tor Nr. 4 für Heim zurücknehmen');
    await act(async () => { await result.current.minus('home'); });
    expect(params.notify.success).toHaveBeenCalledWith('Tor Nr. 4 zurückgenommen');
  });

  it('G1b/G3: Helfer, finished -> alles gesperrt mit Text; Tor-Knopf-Hinweis (F L516)', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 4 });
    await commands.finish(MATCH_ID, CTX, 'helper');
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.sides.home.canMinus).toBe(false);
    expect(result.current.undoHint).toBe('Korrektur nur durch die Turnierleitung');
    expect(result.current.sides.home.hint).toBe('Korrektur nur durch die Turnierleitung');
    expect(result.current.goalHint).toBe('Spiel ist beendet – Korrektur über die Turnierleitung');
  });

  it('G1b/G3: Leitung, finished, Karte -> Rueckgaengig deaktiviert trotz Engine-Erlaubnis, Leitungs-Text', async () => {
    mockActor.current = 'leitung';
    const { value, commands, wrapper } = await setup();
    await commands.card(MATCH_ID, CTX, 'leitung', 'teamb', 'YELLOW_CARD', { playerNumber: 3 });
    await commands.finish(MATCH_ID, CTX, 'leitung');
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoHint).toBe('Nach dem Abpfiff nicht direkt zurücknehmbar – Korrektur folgt');
    expect(result.current.goalHint).toBe('Nach dem Abpfiff nicht direkt zurücknehmbar – Korrektur folgt');
    expect(result.current.deleteBlock(
      (await value.store.load(value.accountId, MATCH_ID))!.pending.find((e) => e.type === 'YELLOW_CARD')!.id,
    )).toBe('Nach dem Abpfiff nicht direkt zurücknehmbar – Korrektur folgt');
  });

  it('readOnly sticht die Hook-Sperren: keine Hinweise, nichts bedienbar', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false);
    await commands.finish(MATCH_ID, CTX, 'helper');
    const params = baseParams(matchOf(value), { readOnly: true });
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    expect(result.current.undoHint).toBeUndefined();
    expect(result.current.undoLabel).toBeUndefined();
    expect(result.current.goalHint).toBeUndefined();
    expect(result.current.sides.home.hint).toBeUndefined();
    expect(result.current.deleteBlock('irgendeine-id')).toBeUndefined();
    expect(result.current.amendLock('irgendeine-id')).toBeUndefined();
  });

  it('G10: update sendet NUR die geaenderte Nummer, nie incomplete', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false);
    const goalId = (await value.store.load(value.accountId, MATCH_ID))!.pending.find((e) => e.type === 'GOAL')!.id;
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    await act(async () => { await result.current.update(goalId, { playerNumber: 7 }); });
    const copy = await value.store.load(value.accountId, MATCH_ID);
    const amend = copy!.pending.find((e) => e.type === 'AMEND')!;
    expect(amend.payload).toEqual({ playerNumber: 7 });
    expect(amend.payload).not.toHaveProperty('incomplete');
    expect(params.notify.success).toHaveBeenCalledWith('Tor Nr. 7 aktualisiert');
  });

  it('G10: geleertes Feld -> clear [playerNumber]; keine Aenderung -> nichts gesendet', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 5 });
    const goalId = (await value.store.load(value.accountId, MATCH_ID))!.pending.find((e) => e.type === 'GOAL')!.id;
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    await act(async () => { await result.current.update(goalId, {}); });
    await act(async () => { await result.current.update(goalId, { playerNumber: 5 }); });
    expect((await value.store.load(value.accountId, MATCH_ID))!.pending.some((e) => e.type === 'AMEND')).toBe(false);
    await act(async () => { await result.current.update(goalId, { clearPlayerNumber: true }); });
    const amend = (await value.store.load(value.accountId, MATCH_ID))!.pending.find((e) => e.type === 'AMEND')!;
    expect(amend.payload).toEqual({ clear: ['playerNumber'] });
  });

  it('G5: Helfer, finished, Tor "Ohne Nr." -> Nummer nachtragen angenommen; gesetzte Nummer gesperrt mit Text', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false);
    await commands.goal(MATCH_ID, CTX, 'helper', 'teamb', false, { playerNumber: 8 });
    await commands.finish(MATCH_ID, CTX, 'helper');
    const pending = (await value.store.load(value.accountId, MATCH_ID))!.pending.filter((e) => e.type === 'GOAL');
    const open = pending[0].id;
    const set = pending[1].id;
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    expect(result.current.amendLock(open)).toBeUndefined();
    expect(result.current.amendLock(set)).toBe('Korrektur nur durch die Turnierleitung');
    await act(async () => { await result.current.update(open, { playerNumber: 6 }); });
    const amend = (await value.store.load(value.accountId, MATCH_ID))!.pending.find((e) => e.type === 'AMEND')!;
    expect(amend.targetId).toBe(open);
    expect(params.notify.error).not.toHaveBeenCalled();
  });

  it('Loeschen (remove) nimmt den Eintrag zurueck und meldet danach', async () => {
    const { value, commands, wrapper } = await setup();
    await commands.card(MATCH_ID, CTX, 'helper', 'teamb', 'RED_CARD', { playerNumber: 2 });
    const cardId = (await value.store.load(value.accountId, MATCH_ID))!.pending.find((e) => e.type === 'RED_CARD')!.id;
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    await act(async () => { await result.current.remove(cardId); });
    expect(params.notify.success).toHaveBeenCalledWith('Rote Karte Nr. 2 zurückgenommen');
  });

  it('lokale Ablehnung: Fehler-Toast, kein Erfolgs-Toast', async () => {
    const { value, wrapper } = await setup();
    const params = baseParams(matchOf(value));
    const { result } = renderHook(() => useEngineEventEditing(params), { wrapper });
    await act(async () => { await result.current.remove('gibt-es-nicht'); });
    expect(params.notify.error).toHaveBeenCalled();
    expect(params.notify.success).not.toHaveBeenCalled();
  });
});

describe('useEngineEventEditing -- Hinweistext je Sperrgrund (G3)', () => {
  beforeEach(() => { mockActor.current = 'helper'; });
  const KO: MatchRules = { ...RULES, sections: 1, knockout: true, tiebreak: 'overtime-then-shootout', overtimeSeconds: 300 };

  async function drawThenFinish(rules: MatchRules) {
    const env = await setup(rules);
    await env.commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 1 });
    await env.commands.goal(MATCH_ID, CTX, 'helper', 'teamb', false, { playerNumber: 2 });
    await env.commands.finish(MATCH_ID, CTX, 'helper');
    return env;
  }

  it('Pause vor der Verlaengerung: Tor der regulaeren Zeit -> "nicht mehr zurücknehmbar" (Stand Engine, Aenderung C3c)', async () => {
    const { value, wrapper } = await drawThenFinish(KO);
    const { result } = renderHook(() => useEngineEventEditing(baseParams(matchOf(value))), { wrapper });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoHint).toBe('Tor aus der regulären Spielzeit – nicht mehr zurücknehmbar');
    expect(result.current.sides.home.canMinus).toBe(false);
    expect(result.current.sides.home.hint).toBe('Tor aus der regulären Spielzeit – nicht mehr zurücknehmbar');
  });

  it('Entscheidung offen (decision_pending): "Erst die Entscheidung treffen"', async () => {
    const { value, wrapper } = await drawThenFinish({ ...KO, tiebreak: null });
    const { result } = renderHook(() => useEngineEventEditing(baseParams(matchOf(value))), { wrapper });
    expect(result.current.undoHint).toBe('Erst die Entscheidung treffen');
    expect(result.current.sides.away.hint).toBe('Erst die Entscheidung treffen');
  });

  it('Strafstoßschießen: Minus deaktiviert, Hinweis verweist aufs Protokoll', async () => {
    const { value, wrapper } = await drawThenFinish({ ...KO, tiebreak: 'shootout' });
    const { result } = renderHook(() => useEngineEventEditing(baseParams(matchOf(value))), { wrapper });
    expect(result.current.sides.home.canMinus).toBe(false);
    expect(result.current.sides.home.hint).toContain('Schüsse über das Protokoll zurücknehmen');
  });

  it('Kein Kandidat: Knopf nur deaktiviert, KEIN Hinweis', async () => {
    const { value, wrapper } = await setup();
    const { result } = renderHook(() => useEngineEventEditing(baseParams(matchOf(value))), { wrapper });
    expect(result.current.sides.home).toMatchObject({ canMinus: false, hint: undefined });
    expect(result.current.undoHint).toBeUndefined();
  });
});

describe('useEngineEventEditing -- Altspiel (keine Engine-Ereignisse)', () => {
  const legacyMatch = {
    id: 'legacy-1', homeTeam: { id: 'h', name: 'H' }, awayTeam: { id: 'a', name: 'A' },
    homeScore: 1, awayScore: 0, status: 'RUNNING', playPhase: 'regular',
    events: [{ id: 'e1', type: 'GOAL' }],
  };

  it('Minus/Undo/Update/Delete gehen an die Alt-Handler; Update leitet incomplete fuer den Alt-Weg ab', () => {
    const legacy = { onGoal: vi.fn(), onUndoLastEvent: vi.fn(), onUpdateEvent: vi.fn(), onDeleteEvent: vi.fn() };
    const params = { tournamentId: 't', match: legacyMatch, readOnly: false, legacy, notify: { success: vi.fn(), error: vi.fn() } };
    const { result } = renderHook(() => useEngineEventEditing(params));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.sides.home.canMinus).toBe(true);
    expect(result.current.sides.away.canMinus).toBe(false);
    void result.current.minus('home');
    expect(legacy.onGoal).toHaveBeenCalledWith('legacy-1', 'h', -1);
    void result.current.undo();
    expect(legacy.onUndoLastEvent).toHaveBeenCalledWith('legacy-1');
    void result.current.update('e1', { playerNumber: 3 });
    expect(legacy.onUpdateEvent).toHaveBeenCalledWith('legacy-1', 'e1', { playerNumber: 3, incomplete: false });
    void result.current.update('e1', { clearPlayerNumber: true });
    expect(legacy.onUpdateEvent).toHaveBeenCalledWith('legacy-1', 'e1', { playerNumber: undefined, incomplete: true });
    void result.current.remove('e1');
    expect(legacy.onDeleteEvent).toHaveBeenCalledWith('legacy-1', 'e1');
    expect(params.notify.success).not.toHaveBeenCalled();
  });

  it('Altspiel beendet: Rueckgaengig und Minus gesperrt (wie bisher)', () => {
    const params = {
      tournamentId: 't', match: { ...legacyMatch, status: 'FINISHED' }, readOnly: false,
      legacy: { onGoal: vi.fn(), onUndoLastEvent: vi.fn() }, notify: { success: vi.fn(), error: vi.fn() },
    };
    const { result } = renderHook(() => useEngineEventEditing(params));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.sides.home.canMinus).toBe(false);
  });

  it('Altspiel Verlaengerung: Minus zaehlt die Verlaengerungstreffer', () => {
    const params = {
      tournamentId: 't', match: { ...legacyMatch, playPhase: 'overtime', homeScore: 1, overtimeScoreA: 0 }, readOnly: false,
      legacy: { onGoal: vi.fn(), onUndoLastEvent: vi.fn() }, notify: { success: vi.fn(), error: vi.fn() },
    };
    const { result } = renderHook(() => useEngineEventEditing(params));
    expect(result.current.sides.home.canMinus).toBe(false);
  });
});
