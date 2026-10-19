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

function mount(title = 'Hallencup Ost') {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<CopyTournamentDialog tournament={{ ...hallencupOstGespielt(), title }} onConfirm={onConfirm} onCancel={onCancel} />);
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
    expect(onConfirm).toHaveBeenCalledWith('Generalprobe Samstag');
  });

  it('ohne Änderung wird der Vorschlag bestätigt', async () => {
    const { onConfirm } = mount();
    await userEvent.click(screen.getByTestId('copy-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('Hallencup Ost (Probe)');
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
});
