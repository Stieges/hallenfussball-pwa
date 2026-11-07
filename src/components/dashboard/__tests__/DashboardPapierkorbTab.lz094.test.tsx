/**
 * @LZ-094 „Papierkorb leeren“ löscht nach einer Rückfrage alle Turniere im Papierkorb, ohne weitere Rückfrage.
 * Gegeben im Papierkorb liegen „Wintercup“ und „Testturnier alt“. Befund C-PAPIERKORB-LEEREN-NUR-LETZTES: früher rief die
 * Taste je Turnier die Rückfrage der App und zog nach dem Bestätigen eine zweite, nur für das letzte Turnier.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import { DashboardPapierkorbTab } from '../DashboardPapierkorbTab';

const turnier = (id: string, title: string): Tournament =>
  ({ id, title, status: 'published', deletedAt: new Date().toISOString(), matches: [], teams: [], placementLogic: [] } as unknown as Tournament);
const papierkorb = [turnier('wc', 'Wintercup'), turnier('alt', 'Testturnier alt')];

function zeige(extra: Partial<React.ComponentProps<typeof DashboardPapierkorbTab>> = {}) {
  const onEmptyTrash = vi.fn();
  const onPermanentDelete = vi.fn();
  render(
    <DashboardPapierkorbTab
      trashedTournaments={papierkorb}
      onTournamentClick={vi.fn()}
      onRestore={vi.fn()}
      onPermanentDelete={onPermanentDelete}
      onEmptyTrash={onEmptyTrash}
      {...extra}
    />,
  );
  return { onEmptyTrash, onPermanentDelete };
}

describe('@LZ-094 Papierkorb leeren', () => {
  it('eine Rückfrage, Bestätigen leert den Papierkorb einmal; die Einzel-Löschung (mit eigener Rückfrage) wird nicht je Turnier gerufen', async () => {
    const user = userEvent.setup();
    const { onEmptyTrash, onPermanentDelete } = zeige();
    await user.click(screen.getByTestId('trash-empty-button'));
    expect(onEmptyTrash).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onEmptyTrash).toHaveBeenCalledTimes(1);
    expect(onPermanentDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-dialog-confirm')).toBeNull();
  });

  it('Abbrechen in der Rückfrage löscht nichts', async () => {
    const user = userEvent.setup();
    const { onEmptyTrash } = zeige();
    await user.click(screen.getByTestId('trash-empty-button'));
    await user.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onEmptyTrash).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: bei nur einem Turnier im Papierkorb gibt es die Taste „Papierkorb leeren“ nicht', () => {
    zeige({ trashedTournaments: [turnier('wc', 'Wintercup')] });
    expect(screen.queryByTestId('trash-empty-button')).toBeNull();
  });
});
