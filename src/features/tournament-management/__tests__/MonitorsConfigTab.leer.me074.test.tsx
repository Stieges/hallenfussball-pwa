/**
 * @ME-074 Im leeren Reiter „Monitor“ ist die Vorlage „Hallen-Standard“ das erste Angebot.
 * Echte Hooks, echte deutsche Texte; das Turnier lebt in einem kleinen Wrapper, damit die Liste nach dem Tipp erscheint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'owner' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));
vi.mock('../../../hooks/useMonitorHeartbeats', () => ({ useMonitorHeartbeats: () => new Map() }));
vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ activeTournaments: [], loading: false }) }));
vi.mock('../../../hooks', async () => {
  const mod = await import('../../../hooks/useMonitors');
  return { useMonitors: mod.useMonitors };
});

import { cssVars } from '../../../design-tokens';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { createMockTournament } from '../../../test/factories';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import { MonitorsConfigTab } from '../MonitorsConfigTab';

await initRealDeI18n();

const nikolaus = (monitors: TournamentMonitor[] = []): Tournament => createMockTournament({
  id: 'nikolaus', title: 'Nikolaus-Turnier', numberOfFields: 1, groupSystem: 'roundRobin',
  teams: ['A', 'B', 'C', 'D', 'E', 'F'].map(name => ({ id: `t-${name}`, name })), monitors,
});

const vorhanden: TournamentMonitor = {
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
  performanceMode: 'auto', slides: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
};

function Huelle({ start, onUpdate, onEdit }: { start: Tournament; onUpdate: (t: Tournament) => void; onEdit: (id: string) => void }) {
  const [t, setT] = useState(start);
  return <MonitorsConfigTab tournament={t} onEditMonitor={onEdit} onTournamentUpdate={async (n) => { onUpdate(n); setT(n); }} />;
}

function oeffnen(start = nikolaus()) {
  const onUpdate = vi.fn();
  const onEdit = vi.fn();
  render(<Huelle start={start} onUpdate={onUpdate} onEdit={onEdit} />);
  return { onUpdate, onEdit, user: userEvent.setup() };
}

beforeEach(() => { role.current = 'owner'; });

describe('@ME-074 leerer Reiter', () => {
  it('„Hallen-Standard anlegen“ ist die Haupttaste (56 px) mit einem Satz darunter; „Leer anlegen“ und „Aus anderem Turnier übernehmen“ folgen', () => {
    oeffnen();
    const haupt = screen.getByRole('button', { name: 'Hallen-Standard anlegen' });
    expect(haupt.style.minHeight).toBe(cssVars.touchTargets.primary);
    expect(screen.getByTestId('monitors-start-hallen-standard-hint')).toHaveTextContent(
      'Legt einen Monitor mit Live-Spiel, Nächsten Spielen, Tabellen und Zuschauer-QR an.'
    );
    const tasten = screen.getAllByRole('button').map(b => b.textContent);
    expect(tasten.indexOf('Hallen-Standard anlegen')).toBeLessThan(tasten.indexOf('Leer anlegen'));
    expect(tasten.indexOf('Leer anlegen')).toBeLessThan(tasten.indexOf('Aus anderem Turnier übernehmen'));
    // „Neuer Monitor“ gibt es im leeren Reiter nicht
    expect(screen.queryByRole('button', { name: /Neuer Monitor/ })).toBeNull();
  });

  it('ein Tipp legt den Monitor wie in @ME-058 an und zeigt ihn in der Liste, ohne den Editor zu öffnen', async () => {
    const { user, onUpdate, onEdit } = oeffnen();
    await user.click(screen.getByRole('button', { name: 'Hallen-Standard anlegen' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const monitore = (onUpdate.mock.calls[0][0] as Tournament).monitors!;
    expect(monitore).toHaveLength(1);
    expect(monitore[0].name).toBe('Hallen-Standard');
    expect(monitore[0].slides.map(s => s.type)).toEqual(['live', 'next-matches', 'all-standings', 'qr-code']);
    expect(monitore[0].slides[0].config.fieldId).toBe('field-1');
    expect(onEdit).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Hallen-Standard' })).toBeInTheDocument();
    expect(screen.getByText('4 Folien')).toBeInTheDocument();
    expect(screen.queryByTestId('monitors-empty-start')).toBeNull();
    expect(screen.getByRole('button', { name: /Neuer Monitor/ })).toBeInTheDocument();
  });

  it('„Leer anlegen“ öffnet das Formular mit sichtbarem Label „Name des Monitors“ (Eingabe 16 px)', async () => {
    const { user } = oeffnen();
    await user.click(screen.getByRole('button', { name: 'Leer anlegen' }));
    const feld = screen.getByLabelText('Name des Monitors');
    expect(feld.style.fontSize).toBe(cssVars.fontSizes.lg);
    expect(screen.getByRole('button', { name: 'Erstellen & Bearbeiten' }).style.minHeight).toBe(cssVars.touchTargets.primary);
  });

  it('„Aus anderem Turnier übernehmen“ öffnet das bisherige Blatt', async () => {
    const { user } = oeffnen();
    await user.click(screen.getByRole('button', { name: 'Aus anderem Turnier übernehmen' }));
    expect(await screen.findByTestId('monitor-transfer-sheet')).toBeInTheDocument();
  });

  it('Gegenbeispiel: gibt es schon einen Monitor, bleibt „Neuer Monitor“ über der Liste und die Vorlage liegt unter „Monitore übernehmen“', () => {
    oeffnen(nikolaus([vorhanden]));
    expect(screen.queryByRole('button', { name: 'Hallen-Standard anlegen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Leer anlegen' })).toBeNull();
    const neu = screen.getByRole('button', { name: /Neuer Monitor/ });
    expect(neu.style.minHeight).toBe(cssVars.touchTargets.primary);
    expect(screen.getByRole('button', { name: 'Monitore übernehmen' })).toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne Recht „Bildschirme verwalten“ gibt es keine Tasten zum Anlegen', () => {
    role.current = 'collaborator';
    oeffnen();
    expect(screen.queryByRole('button', { name: 'Hallen-Standard anlegen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Leer anlegen' })).toBeNull();
    expect(screen.getByText('Noch kein Monitor angelegt')).toBeInTheDocument();
  });
});
