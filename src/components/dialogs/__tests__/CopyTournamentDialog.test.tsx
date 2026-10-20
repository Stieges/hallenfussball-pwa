/** @W5-028 – Dashboard-Einstieg: Kopie-Dialog mit „(Probe)“-Vorschlag, Name vor dem Speichern änderbar. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyTournamentDialog } from '../CopyTournamentDialog';
import { hallencupOstGespielt } from '../../../core/models/__fixtures__/hallencupOstGespielt';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

function mount(title = 'Hallencup Ost', startDate = '2099-11-26') {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<CopyTournamentDialog tournament={{ ...hallencupOstGespielt(), title, startDate }} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
}

describe('@W5-028 Kopie-Dialog im Dashboard', () => {
  it('schlägt „Hallencup Ost (Probe)“ vor', () => {
    mount();
    expect(screen.getByTestId('copy-dialog-name')).toHaveValue('Hallencup Ost (Probe)');
  });

  it('Olli kann den Namen vor dem Speichern ändern; bestätigt wird der geänderte Name', async () => {
    const { onConfirm } = mount();
    const feld = screen.getByTestId('copy-dialog-name');
    await userEvent.clear(feld);
    await userEvent.type(feld, 'Generalprobe Samstag');
    await userEvent.click(screen.getByTestId('copy-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('Generalprobe Samstag', '2099-11-26');
  });

  it('ohne Änderung wird der Vorschlag bestätigt', async () => {
    const { onConfirm } = mount();
    await userEvent.click(screen.getByTestId('copy-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('Hallencup Ost (Probe)', '2099-11-26');
  });

  it('Gegenbeispiel: Kopie einer Kopie schlägt nicht „(Probe) (Probe)“ vor', () => {
    mount('Hallencup Ost (Probe)');
    expect(screen.getByTestId('copy-dialog-name')).toHaveValue('Hallencup Ost (Probe)');
  });

  it('Gegenbeispiel: leerer Name kann nicht gespeichert werden; Abbrechen speichert nichts', async () => {
    const { onConfirm, onCancel } = mount();
    await userEvent.clear(screen.getByTestId('copy-dialog-name'));
    expect(screen.getByTestId('copy-dialog-confirm')).toBeDisabled();
    await userEvent.click(screen.getByTestId('copy-dialog-cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ohne Turnier ist der Dialog zu', () => {
    render(<CopyTournamentDialog tournament={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByTestId('copy-dialog-name')).not.toBeInTheDocument();
  });

  it('@W5-025 „Datum der Probe“: Original in der Zukunft, das Datum ist vorbelegt', () => {
    mount();
    expect(screen.getByLabelText('Datum der Probe')).toHaveValue('2099-11-26');
  });

  it('@W5-025 „Datum der Probe“: Original in der Vergangenheit, vorbelegt mit morgen, und genau das wird bestätigt', async () => {
    const { onConfirm } = mount('Hallencup Ost', '2020-01-01');
    const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
    const erwartet = `${morgen.getFullYear()}-${String(morgen.getMonth() + 1).padStart(2, '0')}-${String(morgen.getDate()).padStart(2, '0')}`;
    expect(screen.getByTestId('copy-dialog-date')).toHaveValue(erwartet);
    await userEvent.click(screen.getByTestId('copy-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('Hallencup Ost (Probe)', erwartet);
  });

  it('@W5-025 das Datum lässt sich ändern; ohne Datum kann nicht gespeichert werden', async () => {
    const { onConfirm } = mount();
    const feld = screen.getByTestId('copy-dialog-date');
    await userEvent.clear(feld);
    expect(screen.getByTestId('copy-dialog-confirm')).toBeDisabled();
    await userEvent.type(feld, '2099-12-24');
    await userEvent.click(screen.getByTestId('copy-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('Hallencup Ost (Probe)', '2099-12-24');
  });

  // B5 (Review #280): Mutation M5 (htmlFor entfernt) muss rot werden
  it('B5 das Namensfeld ist über sein Label auffindbar (Label und Feld verknüpft)', () => {
    mount();
    expect(screen.getByLabelText('Name der Kopie')).toBe(screen.getByTestId('copy-dialog-name'));
  });
});
