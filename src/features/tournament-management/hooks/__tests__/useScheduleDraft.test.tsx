/**
 * „Spielplan bearbeiten“ als Entwurf (useScheduleDraft + useScheduleEditActions):
 * @ZP-101 Änderungen gelten erst nach „Speichern“, @ZP-102 Speichern prüft zuerst und lässt Angepfiffenes aus,
 * @ZP-103 Abbrechen mit Rückfrage, @ZP-104 Rückgängig je Änderung, @ZP-093 angepfiffen = gesperrt (auch Schiedsrichter),
 * @W3-034 Zurücksetzen im Block, @W3-035 Rückfrage vor dem Überschreiben von Handarbeit.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Match, Tournament } from '../../../../types/tournament';
import { generateFullSchedule } from '../../../../core/generators';
import { useScheduleDraft } from '../useScheduleDraft';
import { useScheduleEditActions } from '../useScheduleEditActions';
import { at, hallencup, matchOf } from '../../schedule-draft/__tests__/draftFixture';

function setup(start: Tournament = hallencup()) {
  const onTournamentUpdate = vi.fn();
  const showSuccess = vi.fn();
  const showWarning = vi.fn();
  const hook = renderHook((p: { tournament: Tournament }) => {
    const draft = useScheduleDraft({ tournament: p.tournament, schedule: generateFullSchedule(p.tournament), onTournamentUpdate, showSuccess, showWarning });
    const edit = useScheduleEditActions({ tournament: p.tournament, draft, onTournamentUpdate, showSuccess, showWarning });
    return { draft, edit };
  }, { initialProps: { tournament: start } });
  const r = () => hook.result.current;
  const saved = (): Tournament => onTournamentUpdate.mock.calls[0][0] as Tournament;
  return { r, rerender: hook.rerender, onTournamentUpdate, showSuccess, showWarning, saved };
}

const ohneSchiri = (t: Tournament): Tournament => ({ ...t, matches: t.matches.map((m) => ({ ...m, referee: undefined })) });
const mit = (t: Tournament, id: string, extra: Partial<Match>): Tournament => ({ ...t, matches: t.matches.map((m) => (m.id === id ? { ...m, ...extra } : m)) });

describe('@ZP-101 Im Bearbeiten-Modus gilt eine Änderung erst nach „Speichern“', () => {
  const faelle: [string, Tournament, (h: ReturnType<typeof setup>) => void, (t: Tournament) => void][] = [
    ['zwei Spiele tauscht', hallencup(), (h) => { h.r().edit.handleMatchSwap('s6', 's3'); },
      (t) => expect(matchOf(t, 's6').scheduledTime).toEqual(at(12))],
    ['die Schiedsrichter neu verteilt', ohneSchiri(hallencup()), (h) => { h.r().edit.handleRedistributeSR(); },
      (t) => expect(matchOf(t, 's2').referee).toBeDefined()],
    ['die Felder neu verteilt', mit(hallencup(), 's4', { field: 1 }), (h) => { h.r().edit.handleRedistributeFields(); },
      (t) => expect(matchOf(t, 's3').field).not.toBe(matchOf(t, 's4').field)],
    ['den Schiedsrichter von Spiel 4 ändert', hallencup(), (h) => { h.r().edit.handleRefereeAssignment('s4', 1); },
      (t) => expect(matchOf(t, 's4').referee).toBe(1)],
    ['das Feld von Spiel 4 ändert', hallencup(), (h) => { h.r().edit.handleFieldChange('s4', 1); },
      (t) => expect(matchOf(t, 's4').field).toBe(1)],
  ];

  it.each(faelle)('@ZP-101 Olli %s: nichts wird gespeichert, die Leiste zählt 1 Änderung, die Anzeige zeigt den Entwurf', (_name, start, aendern, imEntwurf) => {
    const h = setup(start);
    act(() => { h.r().draft.startEditing(); });
    act(() => { aendern(h); });
    expect(h.onTournamentUpdate).not.toHaveBeenCalled();
    expect(h.r().draft.changeCount).toBe(1);
    imEntwurf(h.r().draft.draftTournament);
  });
});

describe('@ZP-102 „Speichern“ prüft zuerst und übernimmt dann alle Änderungen zusammen', () => {
  it('@ZP-102 Spiel 6 inzwischen angepfiffen: Spiel 4 wird übernommen, der Tausch nicht, mit Hinweis – ein Update', () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    h.rerender({ tournament: mit(hallencup(), 's6', { matchStatus: 'running' }) });
    act(() => { h.r().draft.save(); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(matchOf(h.saved(), 's4').referee).toBe(3);
    expect(matchOf(h.saved(), 's6').scheduledTime).toEqual(at(24));
    expect(matchOf(h.saved(), 's9').scheduledTime).toEqual(at(48));
    expect(h.showWarning).toHaveBeenCalledWith('tournament:draft.notApplied');
    expect(h.r().draft.isEditing).toBe(false);
  });

  it('@ZP-102 ein Konflikt wird vor dem Speichern gezeigt; erst „Trotzdem speichern“ speichert', () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleFieldChange('s4', 1); }); // Spiel 3 und 4 um 15:12 auf Feld 1
    act(() => { h.r().draft.save(); });
    expect(h.r().draft.conflictOpen).toBe(true);
    expect(h.r().draft.conflicts.some((c) => c.type === 'field_overlap')).toBe(true);
    expect(h.onTournamentUpdate).not.toHaveBeenCalled();
    act(() => { h.r().draft.saveAnyway(); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
  });

  it('@ZP-102 Gegenbeispiel: ohne Konflikt speichert „Speichern“ sofort alle Änderungen in einem Update', () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    act(() => { h.r().draft.save(); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(matchOf(h.saved(), 's6').scheduledTime).toEqual(at(48));
    expect(matchOf(h.saved(), 's4').referee).toBe(3);
    expect(h.showWarning).not.toHaveBeenCalled();
  });
});

describe('@ZP-103 „Abbrechen“ verwirft die Änderungen erst nach Rückfrage', () => {
  const dreiAenderungen = () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's8'); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    act(() => { h.r().edit.handleFieldChange('s7', 2); });
    act(() => { h.r().draft.requestCancel(); });
    return h;
  };

  it('@ZP-103 3 Änderungen: die App fragt, nach „Verwerfen“ ist der Spielplan wie vorher', () => {
    const h = dreiAenderungen();
    expect(h.r().draft.discardOpen).toBe(true);
    expect(h.r().draft.changeCount).toBe(3);
    act(() => { h.r().draft.confirmDiscard(); });
    expect(h.r().draft.isEditing).toBe(false);
    expect(h.r().draft.draftTournament.matches).toEqual(hallencup().matches);
    expect(h.onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@ZP-103 3 Änderungen: nach „Weiter bearbeiten“ bleibt alles stehen', () => {
    const h = dreiAenderungen();
    act(() => { h.r().draft.keepEditing(); });
    expect(h.r().draft.discardOpen).toBe(false);
    expect(h.r().draft.isEditing).toBe(true);
    expect(h.r().draft.changeCount).toBe(3);
    expect(matchOf(h.r().draft.draftTournament, 's7').field).toBe(2);
  });

  it('@ZP-103 keine Änderung: der Bearbeiten-Modus schließt sofort, ohne Rückfrage', () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().draft.requestCancel(); });
    expect(h.r().draft.discardOpen).toBe(false);
    expect(h.r().draft.isEditing).toBe(false);
  });
});

describe('@ZP-104 Rückgängig nimmt jede Änderung einzeln zurück', () => {
  it('@ZP-104 nach der Schiedsrichter-Änderung an Spiel 4 hat Spiel 4 nach „Rückgängig“ wieder den vorigen', () => {
    const h = setup();
    const vorher = matchOf(hallencup(), 's4').referee;
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    expect(h.r().draft.canUndo).toBe(true);
    act(() => { h.r().draft.undo(); });
    expect(matchOf(h.r().draft.draftTournament, 's4').referee).toBe(vorher);
    act(() => { h.r().draft.redo(); });
    expect(matchOf(h.r().draft.draftTournament, 's4').referee).toBe(3);
  });

  it('@ZP-104 Aber: „Neu verteilen“ ohne Wirkung („bereits optimal“) ergibt keinen Schritt', () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleRedistributeFields(); });
    expect(h.showSuccess).toHaveBeenCalledWith('tournament:actions.fieldsAlreadyOptimal');
    expect(h.r().draft.canUndo).toBe(false);
    expect(h.r().draft.changeCount).toBe(0);
  });
});

describe('@ZP-093 angepfiffen = gesperrt, auch für den Schiedsrichter', () => {
  it.each(['running', 'paused', 'finished'] as const)('@ZP-093 Spiel 5 (%s): Tausch, Feld und Schiedsrichter werden abgelehnt, mit Rückmeldung', (status) => {
    const h = setup(mit(hallencup(), 's5', { matchStatus: status }));
    act(() => { h.r().draft.startEditing(); });
    let ok: boolean | undefined;
    act(() => { ok = h.r().edit.handleMatchSwap('s6', 's5'); });
    act(() => { h.r().edit.handleFieldChange('s5', 2); });
    act(() => { h.r().edit.handleRefereeAssignment('s5', 3); });
    expect(ok).toBe(false);
    expect(h.r().draft.changeCount).toBe(0);
    expect(h.showWarning).toHaveBeenCalledWith('tournament:schedule.startedLocked');
    expect(h.showWarning).toHaveBeenCalledWith('tournament:schedule.refereeLocked');
  });

  it('@ZP-093 auch im Block „Manuelle Schiedsrichter-Zuweisung“ (ohne Bearbeiten) bleibt der Schiedsrichter eines beendeten Spiels', () => {
    const h = setup(mit(hallencup(), 's5', { matchStatus: 'finished' }));
    act(() => { h.r().edit.handleRefereeAssignment('s5', null); });
    expect(h.onTournamentUpdate).not.toHaveBeenCalled();
    expect(h.showWarning).toHaveBeenCalledWith('tournament:schedule.refereeLocked');
  });

  it('@W3-011 Gegenbeispiel: im Block gilt der Schiedsrichter eines geplanten Spiels sofort (Hand-Zuteilung)', () => {
    const h = setup();
    act(() => { h.r().edit.handleRefereeAssignment('s5', 1); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(matchOf(h.saved(), 's5').referee).toBe(1);
    expect(h.saved().refereeConfig?.manualAssignments).toEqual({ s5: 1 });
  });

  it('@ZP-093 wird ein getauschtes Spiel inzwischen angepfiffen, steht es im Entwurf wieder auf seinem Platz', () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s5', 's7'); });
    h.rerender({ tournament: mit(hallencup(), 's5', { matchStatus: 'paused' }) });
    expect(matchOf(h.r().draft.draftTournament, 's5').scheduledTime).toEqual(at(24));
    expect(matchOf(h.r().draft.draftTournament, 's7').scheduledTime).toEqual(at(36));
  });
});

describe('@W3-034/@W3-035 Schiedsrichter neu verteilen und zurücksetzen', () => {
  /** Spiel 4 von Hand mit einem anderen Schiedsrichter, als die Regeln ergeben */
  const handarbeit = (): Tournament => {
    const base = hallencup();
    return { ...mit(base, 's4', { referee: 3 }), refereeConfig: { ...base.refereeConfig!, manualAssignments: { s4: 3 } } };
  };

  it('@W3-035 Neu verteilen fragt „1 Spiel wurde von Hand zugeteilt – trotzdem neu verteilen?“; nach „Abbrechen“ bleibt Spiel 4', async () => {
    const h = setup(handarbeit());
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleRedistributeSR(); });
    expect(h.r().edit.overwriteDialogProps.isOpen).toBe(true);
    expect(h.r().edit.overwriteDialogProps.message).toBe('tournament:draft.overwriteManual');
    await act(async () => { h.r().edit.overwriteDialogProps.onCancel?.(); await Promise.resolve(); });
    expect(h.r().draft.changeCount).toBe(0);
    expect(matchOf(h.r().draft.draftTournament, 's4').referee).toBe(3);
  });

  it('@W3-035 nach „Neu verteilen“ in der Rückfrage wird verteilt (im Entwurf)', async () => {
    const h = setup(handarbeit());
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleRedistributeSR(); });
    await act(async () => { h.r().edit.overwriteDialogProps.onConfirm(); await Promise.resolve(); });
    expect(h.r().draft.changeCount).toBe(1);
    expect(h.r().draft.draftTournament.refereeConfig?.manualAssignments?.s4).toBeUndefined();
    expect(h.onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@W3-034 Zurücksetzen im Block (ohne Bearbeiten) speichert sofort, beendete Spiele behalten ihren Schiedsrichter', () => {
    const start = mit(handarbeit(), 's1', { matchStatus: 'finished', referee: 3 });
    const h = setup(start);
    act(() => { h.r().edit.handleResetRefereeAssignments(); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(matchOf(h.saved(), 's1').referee).toBe(3);
    expect(h.saved().refereeConfig?.manualAssignments?.s4).toBeUndefined();
    expect(h.saved().matches.map((m) => [m.scheduledTime, m.field])).toEqual(start.matches.map((m) => [m.scheduledTime, m.field]));
  });
});
