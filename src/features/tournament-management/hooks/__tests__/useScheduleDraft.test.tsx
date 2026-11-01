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
import { at, hallencup, matchOf, spiel } from '../../schedule-draft/__tests__/draftFixture';

function setup(start: Tournament = hallencup(), speichern: 'gelingt' | 'scheitert' = 'gelingt') {
  const onTournamentUpdate = vi.fn();
  const showSuccess = vi.fn();
  const showWarning = vi.fn();
  const showError = vi.fn();
  // Speichern mit Rückmeldung: der Entwurf schließt erst, wenn es aufgelöst ist
  const saveTournament = vi.fn(async (t: Tournament) => {
    await Promise.resolve();
    if (speichern === 'scheitert') { throw new Error('abgelehnt'); }
    onTournamentUpdate(t);
  });
  const hook = renderHook((p: { tournament: Tournament }) => {
    const draft = useScheduleDraft({ tournament: p.tournament, schedule: generateFullSchedule(p.tournament), saveTournament, showSuccess, showWarning, showError });
    const edit = useScheduleEditActions({ tournament: p.tournament, draft, onTournamentUpdate, showSuccess, showWarning });
    return { draft, edit };
  }, { initialProps: { tournament: start } });
  const r = () => hook.result.current;
  const saved = (): Tournament => onTournamentUpdate.mock.calls[0][0] as Tournament;
  return { r, rerender: hook.rerender, onTournamentUpdate, showSuccess, showWarning, showError, saveTournament, saved };
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
  it('@ZP-102 Spiel 6 inzwischen angepfiffen: Spiel 4 wird übernommen, der Tausch nicht, mit Hinweis – ein Update', async () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    h.rerender({ tournament: mit(hallencup(), 's6', { matchStatus: 'running' }) });
    await act(async () => { h.r().draft.save(); await Promise.resolve(); await Promise.resolve(); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(matchOf(h.saved(), 's4').referee).toBe(3);
    expect(matchOf(h.saved(), 's6').scheduledTime).toEqual(at(24));
    expect(matchOf(h.saved(), 's9').scheduledTime).toEqual(at(48));
    expect(h.showWarning).toHaveBeenCalledWith('tournament:draft.notApplied');
    expect(h.r().draft.isEditing).toBe(false);
  });

  it('@ZP-102 ein Konflikt wird vor dem Speichern gezeigt; erst „Trotzdem speichern“ speichert', async () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleFieldChange('s4', 1); }); // Spiel 3 und 4 um 15:12 auf Feld 1
    await act(async () => { h.r().draft.save(); await Promise.resolve(); await Promise.resolve(); });
    expect(h.r().draft.conflictOpen).toBe(true);
    expect(h.r().draft.conflicts.some((c) => c.type === 'field_overlap')).toBe(true);
    expect(h.onTournamentUpdate).not.toHaveBeenCalled();
    await act(async () => { await h.r().draft.saveAnyway(); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
  });

  it('@ZP-102 Gegenbeispiel: ohne Konflikt speichert „Speichern“ sofort alle Änderungen in einem Update', async () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    await act(async () => { h.r().draft.save(); await Promise.resolve(); await Promise.resolve(); });
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(matchOf(h.saved(), 's6').scheduledTime).toEqual(at(48));
    expect(matchOf(h.saved(), 's4').referee).toBe(3);
    expect(h.showWarning).not.toHaveBeenCalled();
  });
});

describe('@ZP-102 Speichern gilt erst, wenn es bestätigt ist', () => {
  it('@ZP-102 scheitert das Speichern, bleibt der Entwurf stehen und die App meldet den Fehler', async () => {
    const h = setup(hallencup(), 'scheitert');
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    await act(async () => { h.r().draft.save(); await Promise.resolve(); await Promise.resolve(); });
    expect(h.saveTournament).toHaveBeenCalledTimes(1);
    expect(h.showError).toHaveBeenCalledWith('tournament:draft.saveFailed');
    expect(h.showSuccess).not.toHaveBeenCalledWith('tournament:actions.changesSaved');
    expect(h.r().draft.isEditing).toBe(true);
    expect(h.r().draft.changeCount).toBe(1);
    expect(matchOf(h.r().draft.draftTournament, 's6').scheduledTime).toEqual(at(48));
  });

  it('@ZP-102 Gegenbeispiel: bis das Speichern bestätigt ist, bleibt der Entwurf sichtbar (kein Aufflackern des alten Stands)', async () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    act(() => { h.r().draft.save(); });
    expect(h.r().draft.isSaving).toBe(true);
    expect(h.r().draft.isEditing).toBe(true);
    expect(matchOf(h.r().draft.draftTournament, 's6').scheduledTime).toEqual(at(48));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(h.r().draft.isEditing).toBe(false);
    expect(h.showSuccess).toHaveBeenCalledWith('tournament:actions.changesSaved');
  });
});

describe('@ZP-104 Tastenkürzel', () => {
  it('@ZP-104 Strg+Z nimmt den letzten Schritt zurück', () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })); });
    expect(h.r().draft.changeCount).toBe(0);
  });

  it.each(['input', 'textarea', 'select'])('@ZP-104 Gegenbeispiel: Strg+Z in einem %s gehört dem Feld, nicht dem Entwurf', (tag) => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    const feld = document.createElement(tag);
    document.body.appendChild(feld);
    act(() => { feld.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); });
    expect(h.r().draft.changeCount).toBe(1);
    feld.remove();
  });
});

describe('@ZP-105 „Speichern“ fragt nur nach Konflikten, die Ollis Änderungen auslösen', () => {
  // Pause für Team 1 zwischen Spiel 1 (15:00–15:10) und Spiel 4 (jetzt 15:11) ist schon vor dem Bearbeiten zu kurz (2 Minuten nötig)
  const mitPausenKonflikt = () => mit(hallencup({ groupPhaseBreakDuration: 2 }), 's4', { scheduledTime: at(11) });

  it('@ZP-105 ein schon bestehender Konflikt: der Tausch wird ohne Rückfrage übernommen, der Konflikt bleibt Hinweis in der Leiste', async () => {
    const h = setup(mitPausenKonflikt());
    expect(h.r().draft.conflictCount).toBeGreaterThan(0);
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    await act(async () => { h.r().draft.save(); await Promise.resolve(); await Promise.resolve(); });
    expect(h.r().draft.conflictOpen).toBe(false);
    expect(h.onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(matchOf(h.saved(), 's6').scheduledTime).toEqual(at(48));
    h.rerender({ tournament: h.saved() });
    expect(h.r().draft.conflictCount).toBeGreaterThan(0);
  });

  it('@ZP-105 Aber: erzeugt Ollis Tausch selbst eine Doppelbelegung, fragt die App vor dem Übernehmen nach', async () => {
    const h = setup(mitPausenKonflikt());
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s9', 's4'); }); // Spiel 9 (Team 3 und 5) um 15:11, wo Spiel 3 Team 5 hat
    await act(async () => { h.r().draft.save(); await Promise.resolve(); });
    expect(h.r().draft.conflictOpen).toBe(true);
    expect(h.r().draft.conflicts.length).toBeGreaterThan(0);
    expect(h.r().draft.conflicts.every((c) => c.matchIds.some((id) => id === 's9' || id === 's4'))).toBe(true);
    expect(h.onTournamentUpdate).not.toHaveBeenCalled();
  });
});

describe('@ZP-106 fremde Änderung nicht still überschreiben (Speichern)', () => {
  it('@ZP-106 Ute hat Spiel 9 verschoben: der Tausch wird nicht übernommen und genannt, Spiel 9 steht weiter auf der neuen Zeit', async () => {
    const h = setup();
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s6', 's9'); });
    act(() => { h.r().edit.handleRefereeAssignment('s4', 3); });
    h.rerender({ tournament: mit(hallencup(), 's9', { scheduledTime: at(58) }) });
    await act(async () => { h.r().draft.save(); await Promise.resolve(); await Promise.resolve(); });
    expect(matchOf(h.saved(), 's9').scheduledTime).toEqual(at(58));
    expect(matchOf(h.saved(), 's6').scheduledTime).toEqual(at(24));
    expect(matchOf(h.saved(), 's4').referee).toBe(3);
    expect(h.showWarning).toHaveBeenCalledWith('tournament:draft.notApplied');
  });
});

describe('@ZP-107 Getauscht wird nur innerhalb derselben Phase', () => {
  const mitHalbfinale = () => {
    const t = hallencup();
    return { ...t, matches: [...t.matches, spiel(9, { id: 'hf1', matchNumber: 10, phase: 'semifinal', isFinal: true, scheduledTime: at(60) })] };
  };

  it('@ZP-107 Spiel 9 auf Halbfinale 1 gezogen: nichts getauscht, Meldung „Nur Spiele derselben Phase lassen sich tauschen“', () => {
    const h = setup(mitHalbfinale());
    act(() => { h.r().draft.startEditing(); });
    let ok: boolean | undefined;
    act(() => { ok = h.r().edit.handleMatchSwap('s9', 'hf1'); });
    expect(ok).toBe(false);
    expect(h.r().draft.changeCount).toBe(0);
    expect(h.showWarning).toHaveBeenCalledWith('tournament:draft.samePhaseOnly');
  });

  it('@ZP-107 auch im Raster tauscht ein Ablegen über die Phasengrenze nichts', () => {
    const h = setup(mitHalbfinale());
    act(() => { h.r().draft.startEditing(); });
    const t = h.r().draft.draftTournament;
    const [s9, hf] = [matchOf(t, 's9'), matchOf(t, 'hf1')];
    const getauscht = t.matches.map((m) => (m.id === 's9' ? { ...m, scheduledTime: hf.scheduledTime } : m.id === 'hf1' ? { ...m, scheduledTime: s9.scheduledTime } : m));
    act(() => { h.r().edit.handleGridChange({ ...t, matches: getauscht }); });
    expect(h.r().draft.changeCount).toBe(0);
    expect(h.showWarning).toHaveBeenCalledWith('tournament:draft.samePhaseOnly');
  });

  it('@ZP-107 Gegenbeispiel: zwei Gruppenspiele lassen sich weiter tauschen', () => {
    const h = setup(mitHalbfinale());
    act(() => { h.r().draft.startEditing(); });
    act(() => { h.r().edit.handleMatchSwap('s9', 's6'); });
    expect(h.r().draft.changeCount).toBe(1);
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
