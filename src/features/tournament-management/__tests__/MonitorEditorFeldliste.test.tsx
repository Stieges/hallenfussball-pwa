/**
 * Monitor-Editor: Feldwahl nutzt dieselbe Feldliste wie die Übernahme-Prüfung (B-22b-F K4, @ME-061).
 * Turnier ohne `fields`, nur `numberOfFields`: die Warnung an einer Feld-Folie lässt sich über die Feldwahl auflösen.
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorEditor } from '../MonitorEditor';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';

vi.mock('../../../hooks', async () => {
  const monitors = await import('../../../hooks/useMonitors');
  const sponsors = await import('../../../hooks/useSponsors');
  const fields = await import('../../../hooks/useFields');
  return { useMonitors: monitors.useMonitors, useSponsors: sponsors.useSponsors, useFields: fields.useFields };
});

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ activeTournaments: [], loading: false }),
}));

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner' }),
}));

function monitor(overrides: Partial<TournamentMonitor>): TournamentMonitor {
  return {
    id: 'mon-1',
    name: 'Halle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    slides: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Turnier ohne `fields`: zwei Felder aus der Anzahl; die Folie zeigt auf field-3 */
function turnierOhneFields(fieldId: string): Tournament {
  return {
    id: 'sued', title: 'Hallencup Süd', teams: [], matches: [], sponsors: [],
    numberOfFields: 2,
    monitors: [monitor({
      slides: [{ id: 'sl-1', type: 'live', config: { fieldId }, duration: null, order: 0 }],
    })],
  } as unknown as Tournament;
}

describe('MonitorEditor – Feldliste wie bei der Übernahme (K4)', () => {
  it('Turnier ohne fields: Feld-3-Folie zeigt die Warnung; „Feld 1“ im Auswahlfeld löst sie auf', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { rerender, baseElement: container } = render(
      <MonitorEditor tournament={turnierOhneFields('field-3')} monitorId="mon-1" onTournamentUpdate={onUpdate} onClose={vi.fn()} />
    );
    expect(screen.getByTestId('slide-reference-warning')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle(/slides\.edit$/));
    const select = container.querySelector<HTMLSelectElement>('select[id$="-fieldId"]');
    expect(select).not.toBeNull();
    expect(Array.from(select?.options ?? []).map(o => o.value)).toEqual(['', 'field-1', 'field-2']);

    await userEvent.selectOptions(select!, 'field-1');
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());

    const saved = onUpdate.mock.calls[0][0] as Tournament;
    expect(saved.monitors?.[0].slides[0].config.fieldId).toBe('field-1');
    rerender(<MonitorEditor tournament={saved} monitorId="mon-1" onTournamentUpdate={onUpdate} onClose={vi.fn()} />);
    expect(screen.queryByTestId('slide-reference-warning')).not.toBeInTheDocument();
  });
});
