/**
 * useCockpitCommands – Befehls-Adapter der Cockpit-Hülle (Scheibe 1, ohne Verhaltensänderung).
 *
 * Charakterisierung des bisherigen Verhaltens beim Zerlegen von `LiveCockpit.tsx`: Welche
 * `on…`-Rückrufe der Aufrufer bekommt, welche Meldung erscheint und dass die Auswahl danach
 * schließt. Testwerte: Spiel 11, FC Nord (Heim) gegen SV Süd (Gast), Nr. 7 (Gherkin „Spiel leiten“).
 * Die Meldungen laufen seit Aufgabe 2.3 über die Meldezeile (`melde(stufe, text)`, Bestätigung = Stufe 3).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type MatchCockpitSettings } from '../../../../types/tournament';
import { makeLiveMatch, makeProps } from '../../__tests__/cockpitFixtures';
import type { LiveCockpitProps } from '../../types';
import type { OffenerEintrag } from '../../model/cockpitTypes';
import { useCockpitCommands } from '../useCockpitCommands';
import type { ReactNode } from 'react';
import type { MatchEngineContextValue } from '../../../../features/match-engine/matchEngineContextInstance';
import { MatchEngineContext } from '../../../../features/match-engine/matchEngineContextInstance';
import { phaseViewOf } from '../../engine/phaseView';
import { REGEL_2X6, spielAnlegen, zu } from '../../__tests__/enginePhaseFixture';

const echtesSetTimeout = setTimeout;

vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
await initRealDeI18n();

function setup(options: { offen?: OffenerEintrag | null; props?: Partial<LiveCockpitProps>; settings?: Partial<MatchCockpitSettings>; events?: unknown[] } = {}) {
  const match = makeLiveMatch(options.events ? { events: options.events as never } : {});
  const props = makeProps(match, options.props);
  const flows = {
    offen: options.offen ?? null, oeffne: vi.fn(), schliesse: vi.fn(), tippeTor: vi.fn(), waehleNummer: vi.fn(),
    schliesseAuswahl: vi.fn(), waehleEigentor: vi.fn(),
  };
  const sides = { getauscht: false, links: 'home' as const, rechts: 'away' as const, tausche: vi.fn() };
  const melde = vi.fn();
  const sound = { play: vi.fn(), activate: vi.fn().mockResolvedValue(undefined), isActivated: true };
  const hook = renderHook(() =>
    useCockpitCommands({ props, settings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...options.settings }, sound, flows, sides, melde, engineView: null }),
  );
  return { hook, props, flows, sides, melde };
}

describe('useCockpitCommands – Tor (Aufgabe 3.4)', () => {
  it('@SL-019 der Tipp auf die Spalte übergibt das Tor dem Eintrags-Ablauf (tippeTor je Seite), ohne Dialog und ohne eigenes onGoal', () => {
    const { hook, props, flows } = setup();
    hook.result.current.teamHandlers.home.onTor();
    expect(flows.tippeTor).toHaveBeenLastCalledWith('home');
    hook.result.current.teamHandlers.away.onTor();
    expect(flows.tippeTor).toHaveBeenLastCalledWith('away');
    expect(flows.oeffne).not.toHaveBeenCalled();
    expect(props.onGoal).not.toHaveBeenCalled();
  });

  it('@SL-037 Gegenbeispiel: es gibt keinen Rückruf „Tor mit Torvorlagen bestätigen“ mehr', () => {
    const { hook } = setup();
    expect('confirmGoal' in hook.result.current.overlayHandlers).toBe(false);
  });
});

describe('useCockpitCommands – Karte, Zeitstrafe, Foul', () => {
  it('Gelbe Karte für SV Süd, Nr. 7: onCard, Meldung mit Nummer, Auswahl schließt', () => {
    const { hook, flows, melde } = setup(); // ohne Karten-Rückruf: nichts wird gesendet, nichts bricht
    hook.result.current.overlayHandlers.confirmCard('YELLOW', 'sv-sued', 7);
    expect(melde).toHaveBeenCalledWith(3, 'Gelbe Karte für SV Süd (#7)');
    expect(flows.schliesse).toHaveBeenCalledTimes(1);
  });

  it('Karte mit Rückruf: onCard bekommt Kartenart, Team und Nummer', () => {
    const onCard = vi.fn();
    const { hook } = setup({ props: { onCard } });
    hook.result.current.overlayHandlers.confirmCard('YELLOW_RED', 'fc-nord', 7);
    expect(onCard).toHaveBeenCalledWith('match-11', 'fc-nord', 'YELLOW_RED', { playerNumber: 7 });
  });

  it('Zeitstrafe 2 Minuten für FC Nord, Nr. 4: onTimePenalty mit Dauer, Meldung, Auswahl schließt', () => {
    const onTimePenalty = vi.fn();
    const { hook, flows, melde } = setup({ props: { onTimePenalty } });
    hook.result.current.overlayHandlers.confirmTimePenalty(120, 'fc-nord', 4);
    expect(onTimePenalty).toHaveBeenCalledWith('match-11', 'fc-nord', { playerNumber: 4, durationSeconds: 120 });
    expect(melde).toHaveBeenCalledWith(3, '2 Min Zeitstrafe für FC Nord (#4)');
    expect(flows.schliesse).toHaveBeenCalledTimes(1);
  });

  it('@SL-037 es gibt keinen Wechsel-Ablauf mehr: kein Rückruf `confirmSubstitution`, kein Handler `onSubstitution` je Seite', () => {
    const onSubstitution = vi.fn();
    const { hook } = setup({ props: { onSubstitution } });
    expect('confirmSubstitution' in hook.result.current.overlayHandlers).toBe(false);
    expect('onSubstitution' in hook.result.current.teamHandlers.home).toBe(false);
    expect(onSubstitution).not.toHaveBeenCalled();
  });

  it('Foul für FC Nord: onFoul mit Team und Meldung', () => {
    const onFoul = vi.fn();
    const { hook, melde } = setup({ props: { onFoul } });
    hook.result.current.teamHandlers.home.onFoul();
    expect(onFoul).toHaveBeenCalledWith('match-11', 'fc-nord');
    expect(melde).toHaveBeenCalledWith(3, 'Foul für FC Nord');
  });

  it('die Tipps je Seite öffnen die passende Auswahl (Zeitstrafe, Karte)', () => {
    const { hook, flows } = setup();
    hook.result.current.teamHandlers.home.onZeitstrafe();
    expect(flows.oeffne).toHaveBeenLastCalledWith({ art: 'zeitstrafe', seite: 'home' });
    hook.result.current.teamHandlers.home.onKarte();
    expect(flows.oeffne).toHaveBeenLastCalledWith({ art: 'karte', seite: 'home' });
  });
});

describe('useCockpitCommands – Uhr und Bedienung', () => {
  it('Zeit anpassen im Countdown: Restzeit 4:00 bei 10 Minuten Spielzeit ergibt 360 s verstrichen', () => {
    const onAdjustTime = vi.fn();
    const { hook, melde } = setup({ props: { onAdjustTime }, settings: { timerDirection: 'countdown' } });
    hook.result.current.overlayHandlers.confirmTimeAdjust(240);
    expect(onAdjustTime).toHaveBeenCalledWith('match-11', 360);
    expect(melde).toHaveBeenCalledWith(3, 'Zeit auf 4:00 gesetzt');
  });

  it('Gegenbeispiel: bei aufwärts zählender Uhr gilt die eingegebene Zeit als verstrichen', () => {
    const onAdjustTime = vi.fn();
    const { hook } = setup({ props: { onAdjustTime }, settings: { timerDirection: 'elapsed' } });
    hook.result.current.overlayHandlers.confirmTimeAdjust(240);
    expect(onAdjustTime).toHaveBeenCalledWith('match-11', 240);
  });

  it('Anpfiff und Seiten tauschen melden sich; ohne Zeit-Rückruf gibt es keinen Zeit-Knopf', () => {
    const { hook, props, sides, melde } = setup();
    hook.result.current.controls.onSwitchSides();
    expect(sides.tausche).toHaveBeenCalledTimes(1);
    expect(melde).toHaveBeenCalledWith(3, 'Seiten getauscht');
    hook.result.current.controls.onStart();
    expect(props.onStart).toHaveBeenCalledWith('match-11');
    expect(melde).toHaveBeenCalledWith(3, 'Spiel angepfiffen');
    expect(hook.result.current.controls.onEditTime).toBeUndefined();
  });

  it('Pause meldet „Spiel pausiert“, der Abpfiff meldet „Spiel abgepfiffen“', () => {
    const { hook, props, melde } = setup();
    hook.result.current.controls.onPauseResume();
    expect(props.onPause).toHaveBeenCalledWith('match-11');
    expect(melde).toHaveBeenCalledWith(3, 'Spiel pausiert');
    hook.result.current.controls.onFinish();
    expect(props.onFinish).toHaveBeenCalledWith('match-11');
    expect(melde).toHaveBeenCalledWith(3, 'Spiel abgepfiffen');
  });
});

describe('useCockpitCommands – Ereignisse, Sperre, Entscheidung', () => {
  const tor = { id: 'e1', matchId: 'match-11', type: 'GOAL', timestampSeconds: 192, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 } };

  it('Nummer ändern aus der Liste: ein vorhandenes Ereignis öffnet die Auswahl, ein unbekanntes nicht', () => {
    const { hook, flows } = setup({ events: [tor] });
    hook.result.current.onSidebarEventEdit?.({ id: 'e1' } as never);
    expect(flows.oeffne).toHaveBeenCalledWith({ art: 'nummer', seite: null, eventId: 'e1' });
    flows.oeffne.mockClear();
    hook.result.current.onSidebarEventEdit?.({ id: 'gibt-es-nicht' } as never);
    expect(flows.oeffne).not.toHaveBeenCalled();
  });

  it('das bearbeitete Ereignis kommt frisch aus dem Spiel; ohne passende ID ist es leer', () => {
    const mit = setup({ events: [tor], offen: { art: 'nummer', seite: null, eventId: 'e1' } });
    expect(mit.hook.result.current.editingEvent).toMatchObject({ id: 'e1', type: 'GOAL', timestampSeconds: 192 });
    const ohne = setup({ events: [tor], offen: { art: 'nummer', seite: null, eventId: 'weg' } });
    expect(ohne.hook.result.current.editingEvent).toBeNull();
  });

  it('Gegenbeispiel: im Nur-Lesen-Modus gibt es keinen Bearbeiten-Rückruf für die Liste', () => {
    const { hook } = setup({ events: [tor], props: { readOnly: true } });
    expect(hook.result.current.onSidebarEventEdit).toBeUndefined();
  });

  it('Tiebreak-Handler gibt es nur, wenn der Aufrufer sie liefert; das Strafstoßschießen zeigt sich nie im Nur-Lesen-Modus', () => {
    const ohne = setup();
    expect(ohne.hook.result.current.overlayHandlers.startOvertime).toBeUndefined();
    expect(ohne.hook.result.current.overlayHandlers.endAsDraw).toBeUndefined();
    const mit = setup({ props: { onStartOvertime: vi.fn(), onForceFinish: vi.fn() } });
    expect(mit.hook.result.current.overlayHandlers.startOvertime).toBeDefined();
    expect(mit.hook.result.current.overlayHandlers.endAsDraw).toBeDefined();
    expect(ohne.hook.result.current.dialogs.showPenaltyShootout).toBe(false);
  });
});

// BUG-008 (Zeitstrafe verschwindet nicht nach Spielende) und @FU-074: Mit dem Abpfiff endet jede
// laufende Zeitstrafe – von Hand wie automatisch. Spiel 11, FC Nord, Nr. 4, 2 Minuten.
describe('useCockpitCommands – BUG-008 Zeitstrafen nach dem Abpfiff', () => {
  const mitStrafe = () => {
    const ctx = setup({ props: { onTimePenalty: vi.fn() } });
    act(() => ctx.hook.result.current.overlayHandlers.confirmTimePenalty(120, 'fc-nord', 4));
    expect(ctx.hook.result.current.activePenalties).toHaveLength(1);
    return ctx;
  };

  it('Abpfiff von Hand: die Liste der laufenden Zeitstrafen ist danach leer', () => {
    const { hook } = mitStrafe();
    act(() => hook.result.current.controls.onFinish());
    expect(hook.result.current.activePenalties).toEqual([]);
  });

  it('Gegenbeispiel: ohne Abpfiff bleibt die Zeitstrafe in der Liste', () => {
    const { hook } = mitStrafe();
    act(() => hook.result.current.controls.onPauseResume());
    expect(hook.result.current.activePenalties).toHaveLength(1);
  });
});

// B-08b: der automatische Abpfiff läuft über die Engine (`useAutoSectionEnd`); danach ist die Liste ebenfalls leer (BUG-008).
describe('useCockpitCommands – BUG-008 Zeitstrafen nach dem automatischen Abpfiff (Engine)', () => {
  it('Spielzeit abgelaufen: die Engine beendet das Spiel einmal, die Liste der Zeitstrafen ist leer, die Meldung erscheint', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    try {
      zu(0);
      const spiel = await spielAnlegen();
      await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', { ...REGEL_2X6, sections: 1, sectionSeconds: 600 });
      const ansicht = spiel.a.engine.view(spiel.matchId);
      if (!ansicht) { throw new Error('keine Ansicht'); }
      const engineView = phaseViewOf(ansicht.result.state, spiel.ctx, spiel.a.engine.serverNow());
      const match = makeLiveMatch({ id: spiel.matchId, homeTeam: { id: 'teama', name: 'FC Nord' }, awayTeam: { id: 'teamb', name: 'SV Süd' } });
      const props = makeProps(match, { onTimePenalty: vi.fn() });
      const flows = { offen: null, oeffne: vi.fn(), schliesse: vi.fn(), tippeTor: vi.fn(), waehleNummer: vi.fn(), schliesseAuswahl: vi.fn(), waehleEigentor: vi.fn() };
      const sides = { getauscht: false, links: 'home' as const, rechts: 'away' as const, tausche: vi.fn() };
      const melde = vi.fn();
      const sound = { play: vi.fn(), activate: vi.fn().mockResolvedValue(undefined), isActivated: true };
      const wert = { engine: spiel.a.engine, store: spiel.store, sender: { kick: vi.fn().mockResolvedValue(undefined) }, accountId: spiel.accountId } as unknown as MatchEngineContextValue;
      const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={wert}>{children}</MatchEngineContext.Provider>;
      const hook = renderHook(
        () => useCockpitCommands({ props, settings: DEFAULT_MATCH_COCKPIT_SETTINGS, sound, flows, sides, melde, engineView }),
        { wrapper },
      );
      act(() => hook.result.current.overlayHandlers.confirmTimePenalty(120, 'teama', 4));
      expect(hook.result.current.activePenalties).toHaveLength(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600_000);
        await new Promise<void>((fertig) => { echtesSetTimeout(fertig, 40); });
      });
      expect((spiel.a.engine.view(spiel.matchId)?.log ?? []).filter((e) => e.type === 'MATCH_END')).toHaveLength(1);
      expect(hook.result.current.activePenalties).toEqual([]);
      expect(melde).toHaveBeenCalledWith(3, 'Spiel abgepfiffen');
      expect(sound.play).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
