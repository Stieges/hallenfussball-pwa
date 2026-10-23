/**
 * useAutoSectionEnd (B-08b): Abschnittsende und Abpfiff von selbst, genau einmal.
 * Testwerte wörtlich aus dem Gherkin: @SL-005 (2 x 6 Minuten, 1 Minute Pause, Ende bei 5:59 -> 6:00),
 * @SL-009 (Spiel am Ende abgepfiffen), @SL-008 (ein Abschnitt, keine Halbzeit), @SL-070 (Pause bei 0:00),
 * @FU-070 (nur einmal beendet). Echte Engine mit Store (fake-indexeddb); Zeit über Fake-Timer, Wanduhr über `Date`.
 */
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalMatchStore } from '../../../../core/match/client';
import type { MatchEngineContextValue } from '../../../../features/match-engine/matchEngineContextInstance';
import { MatchEngineContext } from '../../../../features/match-engine/matchEngineContextInstance';
import { useEngineClockCommands } from '../../../../hooks/useEngineClockCommands';
import { phaseViewOf } from '../../engine/phaseView';
import {
  REGEL_2X6,
  T0,
  geraetAuf,
  spielAnlegen,
  zu,
  type EngineSpiel,
  type Geraet,
} from '../../__tests__/enginePhaseFixture';
import { useAutoSectionEnd, type SectionEnded } from '../useAutoSectionEnd';
import { useEnginePhase } from '../useEnginePhase';

// Der Speicher (fake-indexeddb) läuft auf echten Aufgaben, die Uhr auf Fake-Timern: nach jedem Sprung kurz echt warten.
const echtesSetTimeout = setTimeout;
const echteWartezeit = (ms: number): Promise<void> => new Promise((fertig) => { echtesSetTimeout(fertig, ms); });

vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  zu(0);
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'locks');
});

interface Umgebung { geraet: Geraet; store: LocalMatchStore; accountId: string; sender: { kick: ReturnType<typeof vi.fn> } }

function umgebung(spiel: EngineSpiel, geraet: Geraet = spiel.a, store: LocalMatchStore = spiel.store, accountId = spiel.accountId): Umgebung {
  return { geraet, store, accountId, sender: { kick: vi.fn().mockResolvedValue(undefined) } };
}

function huelle(u: Umgebung) {
  const value = { engine: u.geraet.engine, store: u.store, sender: u.sender, accountId: u.accountId } as unknown as MatchEngineContextValue;
  return function Huelle({ children }: { children: ReactNode }) {
    return <MatchEngineContext.Provider value={value}>{children}</MatchEngineContext.Provider>;
  };
}

interface Stapel { enabled?: boolean; onEnded?: (e: SectionEnded) => void; onError?: (m: string) => void }

/** Hülle, Ansicht, Befehle und Auto-Ende wie im Cockpit. */
function stapel(spiel: EngineSpiel, u: Umgebung, optionen: Stapel = {}) {
  const onEnded = optionen.onEnded ?? vi.fn();
  const onError = optionen.onError ?? vi.fn();
  const rendered = renderHook(
    (props: { enabled: boolean }) => {
      const view = useEnginePhase(spiel.matchId);
      const match = { id: spiel.matchId, homeTeam: { id: 'teama' }, awayTeam: { id: 'teamb' } };
      const commands = useEngineClockCommands({ tournamentId: 'tour-1', match, onError });
      useAutoSectionEnd({
        matchId: spiel.matchId, view, enabled: props.enabled, serverNow: () => u.geraet.engine.serverNow(), commands, onEnded,
      });
      return view;
    },
    { wrapper: huelle(u), initialProps: { enabled: optionen.enabled ?? true } },
  );
  return { ...rendered, onEnded, onError };
}

const weiter = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await echteWartezeit(30);
  });
};

function eintraege(geraet: Geraet, spiel: EngineSpiel, type: string) {
  return (geraet.engine.view(spiel.matchId)?.log ?? []).filter((event) => event.type === type);
}
function status(geraet: Geraet, spiel: EngineSpiel): string | undefined {
  return geraet.engine.view(spiel.matchId)?.result.state.status;
}

async function angepfiffen(regel = REGEL_2X6): Promise<EngineSpiel> {
  const spiel = await spielAnlegen();
  await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', regel);
  return spiel;
}

describe('useAutoSectionEnd: Abschnittsende', () => {
  it('@SL-005 Grenze beidseitig: bei 5:59,999 läuft der Abschnitt, 1 ms später beginnt die Halbzeitpause mit genau einem Ende', async () => {
    const spiel = await angepfiffen();
    const { onEnded } = stapel(spiel, umgebung(spiel));
    await weiter(359_999);
    expect(status(spiel.a, spiel)).toBe('running');
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(0);
    await weiter(1);
    expect(status(spiel.a, spiel)).toBe('section_break');
    const enden = eintraege(spiel.a, spiel, 'SECTION_END');
    expect(enden).toHaveLength(1);
    expect(enden[0]).toMatchObject({ clockMs: 360_000, at: T0 + 360_000, section: 1 });
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledWith({ eventId: enden[0].id, kind: 'section' });
  });

  it('@SL-005 die Pausen-Restzeit zählt ab der Grenze: eine Sekunde später 0:59', async () => {
    const spiel = await angepfiffen();
    const { result } = stapel(spiel, umgebung(spiel));
    await weiter(361_000);
    expect(result.current?.status).toBe('section_break');
    expect(result.current?.breakRemainingMs).toBe(59_000);
  });

  it('@FU-070 zwanzig Neuzeichnungen mit frischen Ansichten rund um die Grenze: weiter genau ein Ende', async () => {
    const spiel = await angepfiffen();
    const { rerender, onEnded } = stapel(spiel, umgebung(spiel));
    await weiter(355_000);
    for (let i = 0; i < 20; i += 1) {
      await weiter(500);
      rerender({ enabled: true });
    }
    await weiter(10_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('@SL-070 das Gerät schläft bis 7:30: genau ein Ende bei Uhr 6:00 zur Wanduhr der Grenze, Pausen-Restzeit 0:00 statt 1:00', async () => {
    const spiel = await angepfiffen();
    zu(450_000);
    const { result } = stapel(spiel, umgebung(spiel));
    await weiter(0);
    const enden = eintraege(spiel.a, spiel, 'SECTION_END');
    expect(enden).toHaveLength(1);
    expect(enden[0]).toMatchObject({ clockMs: 360_000, at: T0 + 360_000 });
    expect(result.current?.breakRemainingMs).toBe(0);
    // Pause bei 0:00 + 10 Minuten: bleibt dabei, kein weiteres Ereignis
    await weiter(600_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(1);
    expect(status(spiel.a, spiel)).toBe('section_break');
    expect(result.current?.breakRemainingMs).toBe(0);
  });

  it('Pause hält die Grenze an: 100 s gespielt, 10 Minuten Pause, nach dem Weiter endet der Abschnitt erst nach den restlichen 260 s', async () => {
    const spiel = await angepfiffen();
    stapel(spiel, umgebung(spiel));
    await weiter(100_000);
    await act(async () => { await spiel.a.commands.pause(spiel.matchId, spiel.ctx, 'leitung'); });
    await weiter(600_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(0);
    await act(async () => { await spiel.a.commands.resume(spiel.matchId, spiel.ctx, 'leitung'); });
    await weiter(259_999);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(0);
    await weiter(1);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(1);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')[0]).toMatchObject({ clockMs: 360_000 });
  });

  it('Gegenbeispiel (R4/H3): ohne Steuer (enabled false) endet nichts; nach dem Wechsel auf enabled genau einmal mit der Grenze', async () => {
    const spiel = await angepfiffen();
    const { rerender, onEnded } = stapel(spiel, umgebung(spiel), { enabled: false });
    await weiter(400_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(0);
    expect(onEnded).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await weiter(0);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(1);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')[0]).toMatchObject({ clockMs: 360_000 });
  });

  it('Gegenbeispiel: ein beendetes Spiel und ein Spiel vor dem Anpfiff enden nicht noch einmal', async () => {
    const spiel = await spielAnlegen();
    stapel(spiel, umgebung(spiel));
    await weiter(700_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(0);
    expect(eintraege(spiel.a, spiel, 'MATCH_END')).toHaveLength(0);
  });
});

describe('useAutoSectionEnd: letzter Abschnitt und ein Abschnitt', () => {
  it('@SL-009 zweiter Abschnitt 5:59 -> 6:00: Spiel abgepfiffen, genau ein MATCH_END, Uhr 12:00', async () => {
    const spiel = await angepfiffen();
    const { onEnded } = stapel(spiel, umgebung(spiel));
    await weiter(360_000);
    expect(status(spiel.a, spiel)).toBe('section_break');
    zu(420_000);
    await act(async () => { await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung'); });
    await weiter(359_999);
    expect(status(spiel.a, spiel)).toBe('running');
    await weiter(1);
    expect(status(spiel.a, spiel)).toBe('finished');
    const enden = eintraege(spiel.a, spiel, 'MATCH_END');
    expect(enden).toHaveLength(1);
    expect(enden[0]).toMatchObject({ clockMs: 720_000 });
    expect(onEnded).toHaveBeenLastCalledWith({ eventId: enden[0].id, kind: 'match' });
    expect(onEnded).toHaveBeenCalledTimes(2);
  });

  it('@SL-008 Gegenbeispiel: ein Spiel am Stück (1 x 10) hat nie ein Abschnittsende, nach 10:00 genau ein MATCH_END', async () => {
    const spiel = await angepfiffen({ ...REGEL_2X6, sections: 1, sectionSeconds: 600 });
    const { onEnded } = stapel(spiel, umgebung(spiel));
    await weiter(599_999);
    expect(status(spiel.a, spiel)).toBe('running');
    await weiter(1);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(0);
    expect(eintraege(spiel.a, spiel, 'MATCH_END')).toHaveLength(1);
    expect(onEnded).toHaveBeenCalledWith(expect.objectContaining({ kind: 'match' }));
  });
});

describe('useAutoSectionEnd: genau einmal über Geräte, Tabs, Neuladen und Netzfehler', () => {
  it('Neuladen nach dem Ende: eine neue Engine mit demselben Log sendet nichts und meldet kein Ende', async () => {
    const spiel = await angepfiffen();
    const erste = stapel(spiel, umgebung(spiel));
    await weiter(360_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(1);
    erste.unmount();
    const neu = await geraetAuf(spiel.store, spiel.accountId);
    await neu.engine.notifyStoreChange(spiel.matchId);
    const zweite = stapel(spiel, umgebung(spiel, neu));
    await weiter(5_000);
    expect(eintraege(neu, spiel, 'SECTION_END')).toHaveLength(1);
    expect(zweite.onEnded).not.toHaveBeenCalled();
  });

  it('Wiederholung nach Netzfehler: der Sender scheitert, es bleibt bei einem gespeicherten Ende', async () => {
    const spiel = await angepfiffen();
    const u = umgebung(spiel);
    u.sender.kick.mockRejectedValue(new Error('offline'));
    const { onError } = stapel(spiel, u);
    await weiter(360_000);
    await weiter(30_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(1);
    const copy = await spiel.store.load(spiel.accountId, spiel.matchId);
    expect(copy?.pending.filter((event) => event.type === 'SECTION_END')).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('zwei Tabs mit eigenen Engines auf demselben Speicher und gemeinsamer Sperre: ein Ende im Speicher', async () => {
    const spiel = await angepfiffen();
    const gehalten = new Set<string>();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: async (name: string, _o: unknown, rueckruf: (lock: unknown) => Promise<unknown>) => {
          if (gehalten.has(name)) { return rueckruf(null); }
          gehalten.add(name);
          try { return await rueckruf({ name }); } finally { gehalten.delete(name); }
        },
      },
    });
    const tabB = await geraetAuf(spiel.store, spiel.accountId);
    await tabB.engine.notifyStoreChange(spiel.matchId);
    stapel(spiel, umgebung(spiel));
    stapel(spiel, umgebung(spiel, tabB));
    await weiter(360_000);
    const copy = await spiel.store.load(spiel.accountId, spiel.matchId);
    expect(copy?.pending.filter((event) => event.type === 'SECTION_END')).toHaveLength(1);
  });

  it('zwei Geräte mit eigenem Speicher: beide senden dasselbe Ende (gleiche ID, gleicher Inhalt), der Server nimmt es einmal an', async () => {
    const spiel = await angepfiffen();
    const kopie = await spiel.store.load(spiel.accountId, spiel.matchId);
    if (!kopie) { throw new Error('keine Kopie'); }
    const storeB = new LocalMatchStore();
    const geraetB = await geraetAuf(storeB, 'acc-b');
    await geraetB.engine.ensureMatch(spiel.matchId, spiel.ctx);
    await storeB.applyConfirmed('acc-b', spiel.matchId, kopie.pending.map((e, i) => ({ ...e, seq: i + 1 })), kopie.pending.length);
    await geraetB.engine.notifyStoreChange(spiel.matchId);
    stapel(spiel, umgebung(spiel));
    stapel(spiel, umgebung(spiel, geraetB, storeB, 'acc-b'));
    await weiter(360_000);
    const a = (await spiel.store.load(spiel.accountId, spiel.matchId))?.pending.filter((e) => e.type === 'SECTION_END') ?? [];
    const b = (await storeB.load('acc-b', spiel.matchId))?.pending.filter((e) => e.type === 'SECTION_END') ?? [];
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(b[0].id).toBe(a[0].id);
    expect({ ...b[0], actor: undefined }).toEqual({ ...a[0], actor: undefined });
    // Server (append_match_events): gleiche ID + gleicher Inhalt = duplicate -> genau ein Eintrag
    const server = new Map([a[0], b[0]].map((e) => [e.id, e]));
    expect(server.size).toBe(1);
  });
});

describe('useAutoSectionEnd: Ansicht ohne Engine', () => {
  it('ohne Ansicht (Spiel ohne Engine-Kopie) wird kein Befehl gesendet', async () => {
    const endSection = vi.fn();
    const finish = vi.fn();
    renderHook(() => useAutoSectionEnd({
      matchId: 'm', view: null, enabled: true, serverNow: () => Date.now(), commands: { endSection, finish }, onEnded: vi.fn(),
    }));
    await weiter(1_000_000);
    expect(endSection).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it('@FU-070 Wiederholung: bleibt die Ansicht unverändert fällig (Befehl wirkt nicht), löst ein erneuter Lauf des Effekts kein zweites Ende aus', async () => {
    const spiel = await angepfiffen();
    const ansicht = spiel.a.engine.view(spiel.matchId);
    if (!ansicht) { throw new Error('keine Ansicht'); }
    const view = phaseViewOf(ansicht.result.state, spiel.ctx, spiel.a.engine.serverNow());
    const endSection = vi.fn().mockResolvedValue('id-1');
    const { rerender } = renderHook((p: { enabled: boolean }) => useAutoSectionEnd({
      matchId: spiel.matchId, view, enabled: p.enabled, serverNow: () => spiel.a.engine.serverNow(), commands: { endSection, finish: vi.fn() }, onEnded: vi.fn(),
    }), { initialProps: { enabled: true } });
    await weiter(360_000);
    expect(endSection).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    rerender({ enabled: true });
    await weiter(5_000);
    expect(endSection).toHaveBeenCalledTimes(1);
  });

  it('der Befehl läuft still (kein Hinweis bei einer Ablehnung) und mit Grenze und fester ID', async () => {
    const spiel = await angepfiffen();
    const ansicht = spiel.a.engine.view(spiel.matchId);
    if (!ansicht) { throw new Error('keine Ansicht'); }
    const view = phaseViewOf(ansicht.result.state, spiel.ctx, spiel.a.engine.serverNow());
    const endSection = vi.fn().mockResolvedValue('id-1');
    const finish = vi.fn();
    renderHook(() => useAutoSectionEnd({
      matchId: spiel.matchId, view, enabled: true, serverNow: () => spiel.a.engine.serverNow(), commands: { endSection, finish }, onEnded: vi.fn(),
    }));
    await weiter(360_000);
    expect(endSection).toHaveBeenCalledTimes(1);
    expect(endSection).toHaveBeenCalledWith(
      { clockMs: 360_000, at: T0 + 360_000, section: 1, id: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      { silent: true },
    );
    expect(finish).not.toHaveBeenCalled();
  });
});

describe('useAutoSectionEnd: Uhrsprung', () => {
  it('springt die Uhr des Geräts hinter die Grenze, ohne dass der Zeitgeber feuert, löst die nächste Ansicht das Ende genau einmal aus', async () => {
    const spiel = await angepfiffen();
    stapel(spiel, umgebung(spiel));
    await weiter(1_000);
    zu(450_000); // Zeitabgleich/Schlaf: Date springt, der Zeitgeber (relativ) bleibt stehen
    await weiter(300); // ein Takt der Ansicht
    await weiter(10);
    const enden = eintraege(spiel.a, spiel, 'SECTION_END');
    expect(enden).toHaveLength(1);
    expect(enden[0]).toMatchObject({ clockMs: 360_000, at: T0 + 360_000 });
    await weiter(5_000);
    expect(eintraege(spiel.a, spiel, 'SECTION_END')).toHaveLength(1);
  });
});
