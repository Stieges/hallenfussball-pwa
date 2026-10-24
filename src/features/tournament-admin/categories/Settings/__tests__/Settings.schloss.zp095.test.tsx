/**
 * @ZP-095 (B-26): Das Schloss an Spielzeit und Pause erklärt sich – ein Satz sagt, warum sie gesperrt sind und dass sich
 * Uhrzeiten über „Zeiten verschieben“ ändern lassen; der Satz erscheint nur, wenn „Zeiten verschieben“ angeboten wird.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { hallencupOstGespielt } from '../../../../../core/models/__fixtures__/hallencupOstGespielt';
import { initRealDeI18n } from '../../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../../../../../hooks', () => ({ useTournaments: () => ({ saveTournament: vi.fn() }) }));
vi.mock('../../../../../hooks/useRepository', () => ({ useRepository: () => ({ get: () => Promise.resolve(null) }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../../../tournament-management/FieldManagement', () => ({ FieldManagement: () => null }));

import { SettingsCategory } from '../index';

describe('@ZP-095 Schloss an Spielzeit und Pause', () => {
  it('@ZP-095 Antippen des Schlosses erklärt die Sperre und führt zu „Zeiten verschieben“', () => {
    const turnier = { ...hallencupOstGespielt(), completedAt: undefined };
    render(<SettingsCategory tournamentId={turnier.id} tournament={turnier} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Spielzeiten'));
    fireEvent.click(screen.getByTestId('settings-lock-game'));
    expect(screen.getByTestId('settings-lock-why-text')).toHaveTextContent('Spielzeit und Pause sind nach dem Festlegen gesperrt');
    expect(screen.getByTestId('settings-lock-why-text')).toHaveTextContent('„Zeiten verschieben“');
    fireEvent.click(screen.getByTestId('settings-lock-shift'));
    expect(navigate).toHaveBeenCalledWith(`/tournament/${turnier.id}/schedule?verschieben=1`);
  });

  it('@ZP-095 Gegenbeispiel: nach dem Abschluss nennt der Satz „Zeiten verschieben“ nicht', () => {
    const turnier = { ...hallencupOstGespielt(), completedAt: '2026-11-14T18:00:00.000Z' };
    render(<SettingsCategory tournamentId={turnier.id} tournament={turnier} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Spielzeiten'));
    fireEvent.click(screen.getByTestId('settings-lock-break'));
    expect(screen.getByTestId('settings-lock-why-text')).not.toHaveTextContent('Zeiten verschieben');
    expect(screen.queryByTestId('settings-time-shift')).toBeNull();
  });
});
