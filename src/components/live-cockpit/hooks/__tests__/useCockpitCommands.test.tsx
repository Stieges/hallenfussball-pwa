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

vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
await initRealDeI18n();

function setup(options: { offen?: OffenerEintrag | null; props?: Partial<LiveCockpitProps>; settings?: Partial<MatchCockpitSettings>; events?: unknown[] } = {}) {
  const match = makeLiveMatch(options.events ? { events: options.events as never } : {});
  const props = makeProps(match, options.props);
  const flows = { offen: options.offen ?? null, oeffne: vi.fn(), schliesse: vi.fn() };
  const sides = { getauscht: false, links: 'home' as const, rechts: 'away' as const, tausche: vi.fn() };
  const melde = vi.fn();
  const sound = { play: vi.fn(), activate: vi.fn().mockResolvedValue(undefined), isActivated: true };
  const state = { isOvertime: false };
  const hook = renderHook(() =>
    useCockpitCommands({ props, settings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...options.settings }, sound, flows, sides, melde, isOvertime: state.isOvertime }),
  );
  return { hook, props, flows, sides, melde, state };
}

describe('useCockpitCommands – Tor', () => {
  it('Tor FC Nord, Nr. 7, Vorlage Nr. 3: onGoal mit Nummer und Vorlage, Erfolgsmeldung, Auswahl schließt', () => {
    const { hook, props, flows, melde } = setup({ offen: { art: 'tor', seite: 'home' } });
    hook.result.current.overlayHandlers.confirmGoal(7, [3, null], false);
    expect(props.onGoal).toHaveBeenCalledWith('match-11', 'fc-nord', 1, { playerNumber: 7, assists: [3], incomplete: false });
    expect(melde).toHaveBeenCalledWith(3, expect.stringContaining('Tor für FC Nord (#7)'));
    expect(flows.schliesse).toHaveBeenCalledTimes(1);
  });

  it('Tor ohne Nummer („ohne Nr.“): onGoal ohne Nummer, Hinweismeldung', () => {
    const { hook, props, melde } = setup({ offen: { art: 'tor', seite: 'away' } });
    hook.result.current.overlayHandlers.confirmGoal(null, undefined, true);
    expect(props.onGoal).toHaveBeenCalledWith('match-11', 'sv-sued', 1, { playerNumber: undefined, assists: undefined, incomplete: true });
    expect(melde).toHaveBeenCalledWith(3, expect.stringContaining('Tor für SV Süd (ohne Nr.)'));
  });

  it('Tor ohne Angaben (Nummer übersprungen): einfache Erfolgsmeldung', () => {
    const { hook, melde } = setup({ offen: { art: 'tor', seite: 'home' } });
    hook.result.current.overlayHandlers.confirmGoal(null);
    expect(melde).toHaveBeenCalledWith(3, 'Tor für FC Nord!');
  });

  it('Gegenbeispiel: ohne offene Tor-Auswahl zählt kein Tor', () => {
    const { hook, props, flows } = setup({ offen: null });
    hook.result.current.overlayHandlers.confirmGoal(7);
    expect(props.onGoal).not.toHaveBeenCalled();
    expect(flows.schliesse).not.toHaveBeenCalled();
  });
});

describe('useCockpitCommands – Karte, Zeitstrafe, Wechsel, Foul', () => {
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

  it('Wechsel bei FC Nord: Nr. 4 raus, Nr. 9 rein; leere Listen zeigen „?“', () => {
    const onSubstitution = vi.fn();
    const { hook, melde } = setup({ props: { onSubstitution } });
    hook.result.current.overlayHandlers.confirmSubstitution('fc-nord', [4], [9]);
    expect(onSubstitution).toHaveBeenCalledWith('match-11', 'fc-nord', { playersOut: [4], playersIn: [9] });
    expect(melde).toHaveBeenCalledWith(3, 'Wechsel FC Nord: #4 → #9');
    hook.result.current.overlayHandlers.confirmSubstitution('sv-sued', [], []);
    expect(onSubstitution).toHaveBeenLastCalledWith('match-11', 'sv-sued', { playersOut: undefined, playersIn: undefined });
    expect(melde).toHaveBeenLastCalledWith(3, 'Wechsel SV Süd: ? → ?');
  });

  it('Foul für FC Nord: onFoul mit Team und Meldung', () => {
    const onFoul = vi.fn();
    const { hook, melde } = setup({ props: { onFoul } });
    hook.result.current.teamHandlers.home.onFoul();
    expect(onFoul).toHaveBeenCalledWith('match-11', 'fc-nord');
    expect(melde).toHaveBeenCalledWith(3, 'Foul für FC Nord');
  });

  it('die Knöpfe je Seite öffnen die passende Auswahl (Tor, Gelb-Rot, Wechsel)', () => {
    const { hook, flows } = setup();
    hook.result.current.teamHandlers.away.onGoal();
    expect(flows.oeffne).toHaveBeenLastCalledWith({ art: 'tor', seite: 'away' });
    hook.result.current.teamHandlers.home.onYellowRedCard();
    expect(flows.oeffne).toHaveBeenLastCalledWith({ art: 'karte', seite: 'home', kartenArt: 'YELLOW_RED' });
    hook.result.current.teamHandlers.home.onSubstitution();
    expect(flows.oeffne).toHaveBeenLastCalledWith({ art: 'wechsel', seite: 'home' });
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
    expect(hook.result.current.onTimerClick).toBeUndefined();
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

  it('automatischer Abpfiff bei abgelaufener Zeit: die Liste ist danach ebenfalls leer', () => {
    const { hook, props, state } = mitStrafe();
    state.isOvertime = true;
    hook.rerender();
    expect(props.onFinish).toHaveBeenCalledWith('match-11');
    expect(hook.result.current.activePenalties).toEqual([]);
  });

  it('Gegenbeispiel: ohne Abpfiff bleibt die Zeitstrafe in der Liste', () => {
    const { hook } = mitStrafe();
    act(() => hook.result.current.controls.onPauseResume());
    expect(hook.result.current.activePenalties).toHaveLength(1);
  });
});
