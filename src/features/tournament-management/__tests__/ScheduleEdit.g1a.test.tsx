/**
 * Bearbeiten-Oberfläche (G1a):
 * - @ZP-100 „Tauschen mit …“: Auswahl des Zielspiels, angepfiffene Spiele und das Spiel selbst sind nicht wählbar
 * - @ZP-101 die Leiste zeigt „n Änderungen nicht gespeichert“; „Speichern“ erst mit einer Änderung
 * - @ZP-103 „Abbrechen“ fragt „n Änderungen verwerfen?“ mit „Verwerfen“ / „Weiter bearbeiten“
 * - @W3-034 „Zuteilung zurücksetzen“ im Block erst nach Rückfrage; @ZP-093 / @W3-011 Block: gesperrt, Teamnamen
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ScheduledMatch } from '../../../core/generators';
import { useSwapWith } from '../../../components/schedule/swapWithContext';
import { RefereeAssignmentEditor } from '../../../components/RefereeAssignmentEditor';
import { ScheduleSwapWith } from '../components/ScheduleSwapWith';
import { ScheduleEditDialogs } from '../components/ScheduleEditDialogs';
import { ScheduleToolbar } from '../components/ScheduleToolbar';
import type { ScheduleDraftControls } from '../hooks/useScheduleDraft';
import type { ScheduleEditActions } from '../hooks/useScheduleEditActions';
import { createMockTournament } from '../../../test/factories';

vi.mock('../../../components/ScheduleActionButtons', () => ({ ScheduleActionButtons: () => null }));

const spiel = (n: number, minute: number, field: number): ScheduledMatch => {
  const start = new Date(2026, 10, 14, 15, minute);
  return { id: `s${n}`, matchNumber: n, time: `15:${String(minute).padStart(2, '0')}`, field, homeTeam: `Heim ${n}`, awayTeam: `Gast ${n}`, startTime: start, endTime: start, referee: 1 } as unknown as ScheduledMatch;
};
const SPIELE = [spiel(3, 12, 1), spiel(5, 24, 1), spiel(6, 24, 2), spiel(9, 48, 1)];

function Ausloeser({ id }: { id: string }) {
  const api = useSwapWith();
  return <button onClick={() => api?.request(id)}>start-{id}</button>;
}

describe('@ZP-100 „Tauschen mit …“ (Weg ohne Ziehen)', () => {
  it('@ZP-100 Spiel 6 mit Spiel 3 tauschen: Auswahl ohne Spiel 6 selbst und ohne angepfiffenes Spiel 5', () => {
    const onSwap = vi.fn(() => true);
    render(<ScheduleSwapWith enabled matches={SPIELE} lockedIds={new Set(['s5'])} onSwap={onSwap}><Ausloeser id="s6" /></ScheduleSwapWith>);
    fireEvent.click(screen.getByText('start-s6'));
    const auswahl = screen.getByTestId('swap-with-select');
    expect(within(auswahl).getAllByRole<HTMLOptionElement>('option').map((o) => o.value)).toEqual(['s3', 's9']);
    fireEvent.change(auswahl, { target: { value: 's3' } });
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onSwap).toHaveBeenCalledWith('s6', 's3');
    expect(screen.queryByTestId('swap-with-select')).toBeNull();
  });

  it('@ZP-100 Gegenbeispiel: „Abbrechen“ tauscht nichts', () => {
    const onSwap = vi.fn(() => true);
    render(<ScheduleSwapWith enabled matches={SPIELE} lockedIds={new Set()} onSwap={onSwap}><Ausloeser id="s6" /></ScheduleSwapWith>);
    fireEvent.click(screen.getByText('start-s6'));
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onSwap).not.toHaveBeenCalled();
  });

  it('@ZP-100 Gegenbeispiel: außerhalb des Bearbeiten-Modus stellt der Reiter keine Auswahl bereit', () => {
    render(<ScheduleSwapWith enabled={false} matches={SPIELE} lockedIds={new Set()} onSwap={vi.fn()}><Ausloeser id="s6" /></ScheduleSwapWith>);
    fireEvent.click(screen.getByText('start-s6'));
    expect(screen.queryByTestId('swap-with-select')).toBeNull();
  });
});

const toolbar = (changeCount: number) => {
  const tournament = createMockTournament();
  return render(
    <ScheduleToolbar isEditing onStartEditing={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} changeCount={changeCount}
      onUndo={vi.fn()} onRedo={vi.fn()} canUndo={changeCount > 0} canRedo={false} onRedistributeSR={vi.fn()} onRedistributeFields={vi.fn()}
      showSRButton showFieldsButton viewMode="table" onViewModeChange={vi.fn()} tournament={tournament}
      schedule={{ allMatches: [] } as never} standings={[]} />,
  );
};

describe('@ZP-101 Leiste im Bearbeiten-Modus', () => {
  it('@ZP-101 mit einer Änderung zeigt die Leiste „1 Änderung nicht gespeichert“, Speichern ist frei', () => {
    toolbar(1);
    expect(screen.getByTestId('schedule-unsaved-count').textContent).toBe('tournament:draft.unsaved');
    expect(screen.getByTestId('schedule-edit-save')).toHaveProperty('disabled', false);
  });

  it('@ZP-101 Gegenbeispiel: ohne Änderung steht „Bearbeitungsmodus“, Speichern ist gesperrt', () => {
    toolbar(0);
    expect(screen.getByTestId('schedule-unsaved-count').textContent).toBe('tournament:toolbar.editMode');
    expect(screen.getByTestId('schedule-edit-save')).toHaveProperty('disabled', true);
  });
});

describe('@ZP-103 Rückfrage beim Abbrechen', () => {
  it('@ZP-103 „3 Änderungen verwerfen?“ mit „Verwerfen“ und „Weiter bearbeiten“', () => {
    const draft = { discardOpen: true, changeCount: 3, conflicts: [], conflictOpen: false, confirmDiscard: vi.fn(), keepEditing: vi.fn() } as unknown as ScheduleDraftControls;
    const edit = { overwriteDialogProps: { isOpen: false, title: '', message: '', onConfirm: vi.fn() } } as unknown as ScheduleEditActions;
    render(<ScheduleEditDialogs draft={draft} edit={edit} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('tournament:draft.discardTitle')).toBeTruthy();
    fireEvent.click(within(dialog).getByTestId('confirm-dialog-cancel'));
    expect(draft.keepEditing).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByTestId('confirm-dialog-confirm'));
    expect(draft.confirmDiscard).toHaveBeenCalled();
    expect(within(dialog).getByTestId('confirm-dialog-confirm').textContent).toBe('tournament:draft.discard');
    expect(within(dialog).getByTestId('confirm-dialog-cancel').textContent).toBe('tournament:draft.keepEditing');
  });
});

describe('Block „Manuelle Schiedsrichter-Zuweisung“', () => {
  const teams = ['FC Nord', 'SV Süd', 'TSV West', 'SC Ost', 'DJK Berg', 'TuS Tal'].map((name, i) => ({ id: `t${i}`, name }));
  const block = (props: Partial<React.ComponentProps<typeof RefereeAssignmentEditor>> = {}) => {
    const onReset = vi.fn();
    const onChange = vi.fn();
    render(<RefereeAssignmentEditor matches={SPIELE} refereeConfig={{ mode: 'teams', manualAssignments: { s3: 2 } }} teams={teams}
      onAssignmentChange={onChange} onResetAssignments={onReset} {...props} />);
    fireEvent.click(screen.getByText(/refereeEditor\.title/));
    return { onReset, onChange };
  };

  it('@W3-011 Teams pfeifen: die Auswahl nennt die 6 Teams mit Namen, nicht 4 Spielnummern', () => {
    block();
    const auswahl = screen.getByTestId('referee-select-s9');
    const optionen = within(auswahl).getAllByRole('option').map((o) => o.textContent);
    expect(optionen).toHaveLength(7);
    expect(optionen[0]).toBe('wizard:refereeEditor.noReferee');
    expect(optionen.slice(1).every((o) => o === 'wizard:refereeEditor.optionCount')).toBe(true);
  });

  it('@ZP-093 ein angepfiffenes Spiel ist im Block gesperrt, ein geplantes nicht', () => {
    block({ lockedMatchIds: new Set(['s5']) });
    expect(screen.getByTestId('referee-select-s5')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('referee-select-s6')).toHaveProperty('disabled', false);
  });

  it('@W3-034 „Zuteilung zurücksetzen“ fragt zuerst; erst nach Bestätigung wird zurückgesetzt', () => {
    const { onReset } = block();
    fireEvent.click(screen.getByTestId('referee-reset'));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByText('wizard:refereeEditor.resetTitle')).toBeTruthy();
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    return vi.waitFor(() => expect(onReset).toHaveBeenCalledTimes(1));
  });

  it('@W3-034 Gegenbeispiel: „Abbrechen“ in der Rückfrage setzt nichts zurück', async () => {
    const { onReset } = block();
    fireEvent.click(screen.getByTestId('referee-reset'));
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    await Promise.resolve();
    expect(onReset).not.toHaveBeenCalled();
  });
});
