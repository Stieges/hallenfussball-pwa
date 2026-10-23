/**
 * @W5-026 zweite Hälfte: Olli holt die Monitore des Hallencup Ost mit „Monitore übernehmen“ auf die Kopie.
 * Die erste Hälfte (Kopie ohne Monitore, Original behält sie) steht in tournamentCopy.proben.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import type { Tournament } from '../../../types/tournament';
import { buildCopiedTournament } from '../../../core/models/tournamentCopy';
import { hallencupOstGespielt } from '../../../core/models/__fixtures__/hallencupOstGespielt';

const { mockActive } = vi.hoisted(() => ({ mockActive: { current: [] as unknown[] } }));

vi.mock('../../../hooks', async () => {
  const mod = await import('../../../hooks/useMonitors');
  return { useMonitors: mod.useMonitors };
});
vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ activeTournaments: mockActive.current, loading: false }),
}));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner' }) }));
vi.mock('../../../hooks/useMonitorHeartbeats', () => ({ useMonitorHeartbeats: () => new Map() }));

describe('@W5-026 Monitore übernehmen auf die Kopie', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@W5-026 die Kopie hat keine Monitore; Olli übernimmt sie aus „Hallencup Ost“ und das Original behält seine', async () => {
    const original = hallencupOstGespielt();
    const kopie = buildCopiedTournament(original, {
      newId: crypto.randomUUID(), title: 'Hallencup Ost (Probe)', now: '2026-11-20T10:00:00.000Z', makeId: () => crypto.randomUUID(),
    });
    expect(kopie.monitors).toBeUndefined();
    mockActive.current = [original, kopie];

    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<MonitorsConfigTab tournament={kopie} onTournamentUpdate={onUpdate} />);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    await userEvent.click(await screen.findByTestId(`transfer-source-${original.id}`));
    await userEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const gespeichert = onUpdate.mock.calls[0][0] as Tournament;
    expect(gespeichert.id).toBe(kopie.id);
    expect(gespeichert.monitors?.map((m) => m.name)).toEqual(['Haupthalle']);
    // neue Monitore, nicht die des Originals
    expect(gespeichert.monitors?.[0].id).not.toBe('mon-1');
    expect(original).toEqual(hallencupOstGespielt());
  });

  it('Gegenbeispiel: ohne Monitore im Original gibt es nichts zu übernehmen', async () => {
    const original = { ...hallencupOstGespielt(), monitors: [] };
    const kopie = buildCopiedTournament(original, {
      newId: crypto.randomUUID(), title: 'Hallencup Ost (Probe)', now: '2026-11-20T10:00:00.000Z', makeId: () => crypto.randomUUID(),
    });
    mockActive.current = [original, kopie];
    render(<MonitorsConfigTab tournament={kopie} onTournamentUpdate={vi.fn()} />);
    await userEvent.click(screen.getByTestId('monitors-transfer-open'));
    expect(screen.queryByTestId(`transfer-source-${original.id}`)).not.toBeInTheDocument();
  });
});
