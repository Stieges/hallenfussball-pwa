/**
 * A-05 (@FU-007): Hinweis auf beiseitegelegte Altformat-Turniere.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const countLegacyTournaments = vi.fn<() => Promise<number>>();
vi.mock('../../core/storage/legacyTournamentStore', () => ({
  LEGACY_TOURNAMENTS_NOTICE_EVENT: 'legacy-tournaments-quarantined',
  countLegacyTournaments: () => countLegacyTournaments(),
}));

import { LegacyTournamentNotice } from '../dashboard/LegacyTournamentNotice';

describe('LegacyTournamentNotice (@FU-007)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@FU-007 zeigt den Hinweis, wenn Altformat-Turniere beiseitegelegt sind', async () => {
    countLegacyTournaments.mockResolvedValue(2);
    render(<LegacyTournamentNotice />);
    expect(await screen.findByTestId('legacy-tournament-notice')).toHaveTextContent('dashboard:legacyNotice.message');
  });

  it('Gegenbeispiel: ohne beiseitegelegte Turniere kein Hinweis', async () => {
    countLegacyTournaments.mockResolvedValue(0);
    render(<LegacyTournamentNotice />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('legacy-tournament-notice')).toBeNull();
  });

  it('@FU-007 erscheint auch, wenn das Ereignis waehrend des Ladens eintrifft, und laesst sich schliessen', async () => {
    countLegacyTournaments.mockResolvedValue(0);
    render(<LegacyTournamentNotice />);
    countLegacyTournaments.mockResolvedValue(1);
    await act(async () => { window.dispatchEvent(new CustomEvent('legacy-tournaments-quarantined')); });
    fireEvent.click(await screen.findByTestId('legacy-tournament-notice-dismiss'));
    expect(screen.queryByTestId('legacy-tournament-notice')).toBeNull();
  });
});
