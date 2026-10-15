/**
 * Gegenbeispiel-Tests für den Team-Auswahl-Dialog (B-13d2).
 * Klick in den Inhalt schließt nicht (stopPropagation); Klick auf den Hintergrund schließt;
 * Auswahl eines Teams ruft den Handler mit dem Team auf.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamSelectorDialog } from '../components/TeamSelectorDialog';
import { buildLiveViewTournament } from '../../../screens/__tests__/liveViewFixture';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

function renderDialog() {
  const teams = buildLiveViewTournament().teams;
  const onSelectTeam = vi.fn();
  const onClose = vi.fn();
  render(
    <TeamSelectorDialog teams={teams} myTeamId={null} onSelectTeam={onSelectTeam} onClose={onClose} />
  );
  return { onSelectTeam, onClose };
}

describe('TeamSelectorDialog (B-13d2)', () => {
  it('Klick in den Inhalt schließt den Dialog nicht (Gegenbeispiel)', () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByText('Mein Team wählen'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Klick auf den Hintergrund schließt den Dialog', () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByTestId('team-selector-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Auswahl eines Teams ruft den Handler mit der Team-ID auf', () => {
    const { onSelectTeam, onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /SV Süd/ }));
    expect(onSelectTeam).toHaveBeenCalledWith('team-sued');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('„Kein Team“ ruft den Handler mit null auf', () => {
    const { onSelectTeam } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Kein Team (alle anzeigen)' }));
    expect(onSelectTeam).toHaveBeenCalledWith(null);
  });
});
