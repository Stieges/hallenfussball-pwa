/**
 * usePenaltyExpiryNotice (Aufgabe 3.3): @SL-096 eine abgelaufene Zeitstrafe meldet das Cockpit in der Meldezeile;
 * Gegenbeispiele: Ende mit Restzeit (Gegentor @SL-030), unverändert laufende Strafe, Spielwechsel.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import i18n from 'i18next';
import { alsUebersetzer } from '../../model/alsUebersetzer';
import { makePhaseView } from '../../__tests__/cockpitFixtures';
import type { PhaseView } from '../../engine/phaseView';
import { usePenaltyExpiryNotice } from '../usePenaltyExpiryNotice';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const TEAMS = { home: { id: 'fc-nord', name: 'FC Nord' }, away: { id: 'sv-sued', name: 'SV Süd' } };
const mitStrafe = (remainingMs: number, ohneNummer = false): PhaseView =>
  makePhaseView({ penalties: [{ id: 'p1', teamId: 'sv-sued', ...(ohneNummer ? {} : { playerNumber: 5 }), remainingMs }] });
const ohneStrafe = (): PhaseView => makePhaseView({ penalties: [] });

function setup(view: PhaseView, matchId = 'match-11') {
  const melde = vi.fn();
  const t = alsUebersetzer(i18n.getFixedT('de', 'cockpit'));
  const hook = renderHook((p: { view: PhaseView; matchId: string }) => usePenaltyExpiryNotice(p.matchId, p.view, TEAMS, melde, t), {
    initialProps: { view, matchId },
  });
  return { ...hook, melde };
}

describe('usePenaltyExpiryNotice', () => {
  it('@SL-096 eine Strafe von SV Süd, Nr. 5, die mit 0,8 s Rest endet, meldet „Zeitstrafe SV Süd Nr. 5 abgelaufen“ (Stufe 2)', () => {
    const { rerender, melde } = setup(mitStrafe(800));
    rerender({ view: ohneStrafe(), matchId: 'match-11' });
    expect(melde).toHaveBeenCalledWith(2, 'Zeitstrafe SV Süd Nr. 5 abgelaufen');
  });

  it('@SL-096 ohne Rückennummer: „Zeitstrafe SV Süd abgelaufen“', () => {
    const { rerender, melde } = setup(mitStrafe(500, true));
    rerender({ view: ohneStrafe(), matchId: 'match-11' });
    expect(melde).toHaveBeenCalledWith(2, 'Zeitstrafe SV Süd abgelaufen');
  });

  it('@SL-030 Gegenbeispiel: endet die Strafe mit Restzeit (Gegentor), meldet das Cockpit kein „abgelaufen“', () => {
    const { rerender, melde } = setup(mitStrafe(45_000));
    rerender({ view: ohneStrafe(), matchId: 'match-11' });
    expect(melde).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: eine weiterlaufende Strafe meldet nichts, auch nach Neuzeichnen', () => {
    const { rerender, melde } = setup(mitStrafe(800));
    rerender({ view: mitStrafe(700), matchId: 'match-11' });
    expect(melde).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: beim Wechsel auf ein anderes Spiel meldet das Cockpit die Strafe des vorigen Spiels nicht', () => {
    const { rerender, melde } = setup(mitStrafe(800));
    rerender({ view: ohneStrafe(), matchId: 'match-12' });
    expect(melde).not.toHaveBeenCalled();
  });
});
