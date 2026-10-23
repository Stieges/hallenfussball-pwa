/**
 * @SL-172 (Korrigieren): Im Bearbeiten-Dialog gilt dieselbe Grenze wie beim Erfassen – eine Rückennummer ist eine ganze Zahl
 * von 1 bis 99. Eine andere Eingabe wird mit Hinweis abgewiesen und nie gesendet; eine unveränderte Altdaten-Nummer außerhalb
 * bleibt ohne Hinweis (Speichern ändert nichts).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EditableMatchEvent } from '../../../types/tournament';
import { EventEditDialog } from '../components/Dialogs/EventEditDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'de' } }),
}));

const teams = { homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' } };
const tor = (playerNumber?: number): EditableMatchEvent => ({
  id: 'g1', type: 'GOAL', timestampSeconds: 100, payload: { teamId: 'team-a', ...(playerNumber !== undefined ? { playerNumber } : {}) },
});

function open(event: EditableMatchEvent) {
  const onUpdate = vi.fn();
  const onClose = vi.fn();
  render(<EventEditDialog isOpen onClose={onClose} event={event} onUpdate={onUpdate} onDelete={vi.fn()} {...teams} />);
  return { onUpdate, onClose, feld: screen.getByTestId('event-edit-number') };
}

describe('@SL-172 EventEditDialog: Rückennummer 1–99', () => {
  it.each([['7', 7], ['99', 99], ['1', 1]])('%j wird als Nummer %s gespeichert', (eingabe, nummer) => {
    const { onUpdate, onClose, feld } = open(tor());
    fireEvent.change(feld, { target: { value: eingabe } });
    expect(screen.queryByTestId('event-edit-number-invalid')).toBeNull();
    fireEvent.click(screen.getByTestId('event-edit-save'));
    expect(onUpdate).toHaveBeenCalledWith('g1', { playerNumber: nummer });
    expect(onClose).toHaveBeenCalled();
  });

  it.each([['0'], ['100'], ['7a'], ['1e1'], ['-3'], ['4.5'], ['999']])('%j: Hinweis, Speichern gesperrt, nichts gesendet', (eingabe) => {
    const { onUpdate, onClose, feld } = open(tor(5));
    fireEvent.change(feld, { target: { value: eingabe } });
    expect(screen.getByTestId('event-edit-number-invalid')).toHaveTextContent('eventEditDialog.numberInvalid');
    const speichern = screen.getByTestId('event-edit-save');
    expect(speichern).toBeDisabled();
    fireEvent.click(speichern);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('A1: „7a“ löscht die bisherige Nummer nie (Feld ist ein Textfeld mit Zifferntastatur, kein number-Feld)', () => {
    const { onUpdate, feld } = open(tor(5));
    expect(feld).toHaveAttribute('type', 'text');
    expect(feld).toHaveAttribute('inputmode', 'numeric');
    fireEvent.change(feld, { target: { value: '7a' } });
    expect(feld).toHaveValue('7a');
    fireEvent.click(screen.getByTestId('event-edit-save'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Korrektur der ungültigen Eingabe hebt die Sperre auf', () => {
    const { onUpdate, feld } = open(tor(5));
    fireEvent.change(feld, { target: { value: '100' } });
    fireEvent.change(feld, { target: { value: '10' } });
    expect(screen.queryByTestId('event-edit-number-invalid')).toBeNull();
    fireEvent.click(screen.getByTestId('event-edit-save'));
    expect(onUpdate).toHaveBeenCalledWith('g1', { playerNumber: 10 });
  });

  it('leere Eingabe löscht die Nummer (Tor bleibt ohne Nummer), kein Hinweis', () => {
    const { onUpdate, feld } = open(tor(5));
    fireEvent.change(feld, { target: { value: '' } });
    expect(screen.queryByTestId('event-edit-number-invalid')).toBeNull();
    fireEvent.click(screen.getByTestId('event-edit-save'));
    expect(onUpdate).toHaveBeenCalledWith('g1', { clearPlayerNumber: true });
  });

  it('Altdaten-Nummer 1000, unverändert: kein Hinweis, Speichern sendet nichts', () => {
    const { onUpdate, onClose } = open(tor(1000));
    expect(screen.queryByTestId('event-edit-number-invalid')).toBeNull();
    fireEvent.click(screen.getByTestId('event-edit-save'));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
