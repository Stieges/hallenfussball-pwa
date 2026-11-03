/**
 * @SL-193 „Feld ändern“ / „Schiedsrichter ändern“ direkt am Spiel (Aktionsauswahl), außerhalb des Bearbeiten-Modus:
 * die Änderung gilt sofort (ein Update des Turniers), aber nie bei einem angepfiffenen Spiel (@ZP-093) und nie mit einem neuen
 * Konflikt (zwei Spiele zur selben Zeit auf einem Feld).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { generateFullSchedule } from '../../../../core/generators';
import { createMockTournament } from '../../../../test/factories';
import { testUuid } from '../../../../test/testIds';
import type { Match, Team, Tournament } from '../../../../types/tournament';
import type { ScheduleDraftControls } from '../useScheduleDraft';
import { useScheduleEditActions } from '../useScheduleEditActions';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
await initRealDeI18n();

const teams: Team[] = [1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `Team ${n}`, group: 'A' }));
const base = createMockTournament({ id: 'T', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 2, refereeConfig: { mode: 'organizer', numberOfReferees: 2 } });
const alle = generateFullSchedule(base).allMatches as unknown as Match[];
const SPIEL = alle[0];

function mitSpiel(change: Partial<Match>, others: (m: Match) => Partial<Match> = () => ({})): Tournament {
  return { ...base, matches: alle.map((m) => ({ ...m, ...(m.id === SPIEL.id ? change : others(m)) })) };
}
const draft = (t: Tournament): ScheduleDraftControls => ({ isEditing: false, draftTournament: t, addStep: vi.fn() } as unknown as ScheduleDraftControls);

function arbeite(t: Tournament) {
  const onTournamentUpdate = vi.fn();
  const showWarning = vi.fn();
  const { result } = renderHook(() => useScheduleEditActions({ tournament: t, draft: draft(t), onTournamentUpdate, showSuccess: vi.fn(), showWarning }));
  return { actions: result.current, onTournamentUpdate, showWarning };
}

const andereFeld = SPIEL.field === 1 ? 2 : 1;
// Spiel 1 in einer eigenen Zeit, in der auf dem anderen Feld nichts steht
const FREIE_ZEIT = new Date('2026-11-14T20:00:00.000Z');

describe('@SL-193 Feld direkt am Spiel ändern', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ein geplantes Spiel zu freier Zeit: das Feld wechselt sofort, ein Update des Turniers', () => {
    const { actions, onTournamentUpdate, showWarning } = arbeite(mitSpiel({ scheduledTime: FREIE_ZEIT }));
    act(() => { actions.handleFieldChange(SPIEL.id, andereFeld); });
    expect(showWarning).not.toHaveBeenCalled();
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    const gespeichert = onTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(gespeichert.matches.find((m) => m.id === SPIEL.id)?.field).toBe(andereFeld);
  });

  it('@ZP-093 Gegenbeispiel: ein angepfiffenes Spiel behält sein Feld, die Meldung nennt den Grund', () => {
    const { actions, onTournamentUpdate, showWarning } = arbeite(mitSpiel({ matchStatus: 'running' }));
    act(() => { actions.handleFieldChange(SPIEL.id, andereFeld); });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: dasselbe Feld wählen ändert nichts', () => {
    const { actions, onTournamentUpdate } = arbeite(mitSpiel({ scheduledTime: FREIE_ZEIT }));
    act(() => { actions.handleFieldChange(SPIEL.id, SPIEL.field); });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: steht dort zur selben Zeit schon ein Spiel, wird das Feld nicht geändert und die Meldung nennt den Konflikt', () => {
    const t = mitSpiel({ scheduledTime: FREIE_ZEIT }, (m) => (m.id === alle[1].id ? { scheduledTime: FREIE_ZEIT, field: andereFeld } : {}));
    const { actions, onTournamentUpdate, showWarning } = arbeite(t);
    act(() => { actions.handleFieldChange(SPIEL.id, andereFeld); });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(expect.stringContaining('Feld nicht geändert'));
  });
});

describe('@ZP-093 Schiedsrichter direkt am Spiel ändern', () => {
  it('ein geplantes Spiel: der Schiedsrichter wechselt sofort', () => {
    const { actions, onTournamentUpdate } = arbeite(mitSpiel({ referee: 1 }));
    act(() => { actions.handleRefereeAssignment(SPIEL.id, 2); });
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ein angepfiffenes Spiel behält seinen Schiedsrichter', () => {
    const { actions, onTournamentUpdate, showWarning } = arbeite(mitSpiel({ referee: 1, matchStatus: 'running' }));
    act(() => { actions.handleRefereeAssignment(SPIEL.id, 2); });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(expect.stringContaining('behält seinen Schiedsrichter'));
  });
});
