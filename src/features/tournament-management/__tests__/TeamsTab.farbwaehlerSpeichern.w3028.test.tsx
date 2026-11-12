/**
 * @W3-028 Der freie Farbwähler ruft bei jeder Zeigerbewegung `onChange`; im Reiter „Teams“ wird nicht bei jeder Bewegung das ganze Turnier
 * gespeichert, sondern beim Loslassen (oder nach kurzer Ruhe). Palettenfarben gelten sofort. Der Farbwähler (react-colorful) ist durch eine
 * Attrappe ersetzt, die fünf Zeigerbewegungen liefert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));
vi.mock('react-colorful', () => ({
  HexColorPicker: ({ onChange }: { onChange: (c: string) => void }) => (
    <button type="button" data-testid="ziehen" onClick={() => { for (const c of ['#112233', '#223344', '#334455', '#445566', '#4FC3F7']) { onChange(c); } }}>ziehen</button>
  ),
}));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamsTab } from '../TeamsTab';
import { COLOR_COMMIT_DELAY_MS } from '../components/TeamColorField';

await initRealDeI18n();

const NORD = '00000000-0000-4000-8000-000000000001';
const turnier = { id: 't', title: 'Hallencup', status: 'published', teams: [{ id: NORD, name: 'FC Nord', colors: { primary: '#C62828' } }], matches: [] } as unknown as Tournament;

async function oeffneWaehler(update: (t: Tournament) => void) {
  render(<TeamsTab tournament={turnier} onTournamentUpdate={update} />);
  await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByTestId(`team-expand-toggle-${NORD}`));
  fireEvent.click(within(screen.getByTestId(`team-card-${NORD}`)).getByRole('button', { name: /#C62828/i }));
}
const farbeImTurnier = (update: ReturnType<typeof vi.fn>) => (update.mock.calls.at(-1)?.[0] as Tournament | undefined)?.teams[0].colors?.primary;

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe('@W3-028 Farbwähler im Reiter „Teams“ speichert nicht bei jeder Zeigerbewegung', () => {
  it('fünf Bewegungen, dann Loslassen: genau eine Speicherung mit der letzten Farbe', async () => {
    const update = vi.fn();
    await oeffneWaehler(update);
    fireEvent.click(screen.getByTestId('ziehen'));
    expect(update).not.toHaveBeenCalled(); // beim Ziehen noch nichts gespeichert
    fireEvent.pointerUp(screen.getByTestId('ziehen'));
    expect(update).toHaveBeenCalledTimes(1);
    expect(farbeImTurnier(update)).toBe('#4FC3F7');
  });

  it('ohne Loslassen-Ereignis speichert die Ruhe nach dem Ziehen, ebenfalls einmal', async () => {
    const update = vi.fn();
    await oeffneWaehler(update);
    fireEvent.click(screen.getByTestId('ziehen'));
    act(() => { vi.advanceTimersByTime(COLOR_COMMIT_DELAY_MS - 50); });
    expect(update).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(100); });
    expect(update).toHaveBeenCalledTimes(1);
    expect(farbeImTurnier(update)).toBe('#4FC3F7');
  });

  it('Gegenbeispiel: eine Palettenfarbe gilt sofort, ohne Warten', async () => {
    const update = vi.fn();
    await oeffneWaehler(update);
    fireEvent.click(screen.getByRole('option', { name: 'Blau' }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(farbeImTurnier(update)).toBe('#0033CC');
  });

  it('Verlassen des Reiters vor dem Speichern: die gezogene Farbe geht nicht verloren', async () => {
    const update = vi.fn();
    const { unmount } = render(<TeamsTab tournament={turnier} onTournamentUpdate={update} />);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByTestId(`team-expand-toggle-${NORD}`));
    fireEvent.click(within(screen.getByTestId(`team-card-${NORD}`)).getByRole('button', { name: /#C62828/i }));
    fireEvent.click(screen.getByTestId('ziehen'));
    unmount();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
