/**
 * @ME-074 Im leeren Reiter „Monitor“ ist die Vorlage „Hallen-Standard“ das erste Angebot.
 * Echte Hooks, echte deutsche Texte; das Turnier lebt in einem kleinen Wrapper, damit die Liste nach dem Tipp erscheint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
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

import { cssVars, dialogWidths } from '../../../design-tokens';
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

type Speichern = (t: Tournament) => Promise<void>;

function Huelle({ start, onUpdate, onEdit, speichern }: { start: Tournament; onUpdate: (t: Tournament) => void; onEdit: (id: string) => void; speichern?: Speichern }) {
  const [t, setT] = useState(start);
  return (
    <MonitorsConfigTab
      tournament={t}
      onEditMonitor={onEdit}
      onTournamentUpdate={async (n) => { onUpdate(n); await speichern?.(n); setT(n); }}
    />
  );
}

/** `speichern` darf das Speichern bremsen oder scheitern lassen (nach `onUpdate`, vor der neuen Liste) */
function oeffnen(start = nikolaus(), speichern?: Speichern) {
  const onUpdate = vi.fn();
  const onEdit = vi.fn();
  render(<Huelle start={start} onUpdate={onUpdate} onEdit={onEdit} speichern={speichern} />);
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

  it('Doppeltipp auf „Hallen-Standard anlegen“ legt genau einen Monitor an', async () => {
    let fertig: () => void = () => undefined;
    const { onUpdate } = oeffnen(nikolaus(), () => new Promise<void>(res => { fertig = res; }));
    const haupt = screen.getByRole('button', { name: 'Hallen-Standard anlegen' });
    // zwei Tipps so schnell, dass die Ansicht dazwischen nicht neu zeichnet (die Taste „arbeitet“ noch nicht)
    act(() => { haupt.click(); haupt.click(); });
    fertig();
    expect(await screen.findByRole('heading', { name: 'Hallen-Standard' })).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('heading', { name: 'Hallen-Standard' })).toHaveLength(1);
  });

  it('Gegenbeispiel: ein zweiter Tipp nach dem Anlegen findet die Taste nicht mehr (kein zweiter Monitor)', async () => {
    const { user, onUpdate } = oeffnen();
    await user.click(screen.getByRole('button', { name: 'Hallen-Standard anlegen' }));
    await screen.findByRole('heading', { name: 'Hallen-Standard' });
    expect(screen.queryByRole('button', { name: 'Hallen-Standard anlegen' })).toBeNull();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('scheitert das Speichern, steht eine Meldung da, kein Monitor in der Liste, und ein neuer Versuch ist möglich', async () => {
    let scheitern = true;
    const { user, onUpdate } = oeffnen(nikolaus(), async () => { if (scheitern) { throw new Error('offline'); } });
    await user.click(screen.getByRole('button', { name: 'Hallen-Standard anlegen' }));
    expect(await screen.findByText('Der Monitor konnte nicht angelegt werden')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hallen-Standard' })).toBeNull();
    expect(screen.getByTestId('monitors-empty-start')).toBeInTheDocument();
    // die Taste ist wieder frei: der zweite Versuch gelingt und die Meldung verschwindet
    scheitern = false;
    await user.click(screen.getByRole('button', { name: 'Hallen-Standard anlegen' }));
    expect(await screen.findByRole('heading', { name: 'Hallen-Standard' })).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Der Monitor konnte nicht angelegt werden')).toBeNull();
  });

  it('Maße des Leerzustands kommen aus den Tokens (Symbol, Breite der Tastenspalte)', () => {
    oeffnen();
    const symbol = screen.getByText('📺');
    expect(symbol.style.fontSize).toBe(cssVars.iconSizes.xl);
    const spalte = screen.getByTestId('monitors-start-hallen-standard-hint').parentElement!;
    expect(spalte.style.maxWidth).toBe(dialogWidths.sm);
  });

  it('Y5: bei mehr als einem Feld nennt der Satz unter der Haupttaste „Feld 1“', () => {
    oeffnen({ ...nikolaus(), numberOfFields: 2 });
    expect(screen.getByTestId('monitors-start-hallen-standard-hint')).toHaveTextContent(
      'Legt einen Monitor mit Live-Spiel von Feld 1, Nächsten Spielen, Tabellen und Zuschauer-QR an.'
    );
  });

  it('Helfer ohne Recht sieht im leeren Reiter nur „Noch kein Monitor angelegt“, nicht die Aufforderung „Lege einen Monitor an …“', () => {
    role.current = 'collaborator';
    oeffnen();
    expect(screen.getByText('Noch kein Monitor angelegt')).toBeInTheDocument();
    expect(screen.queryByText(/Lege einen Monitor an/)).toBeNull();
  });

  it('Gegenbeispiel: mit Recht steht die Aufforderung da', () => {
    oeffnen();
    expect(screen.getByText(/Lege einen Monitor an/)).toBeInTheDocument();
  });

  it('„Leer anlegen“ öffnet das Formular mit sichtbarem Label „Name des Monitors“ (Eingabe 16 px)', async () => {
    const { user } = oeffnen();
    await user.click(screen.getByRole('button', { name: 'Leer anlegen' }));
    const feld = screen.getByLabelText('Name des Monitors');
    expect(feld.style.fontSize).toBe(cssVars.fontSizes.lg);
    expect(screen.getByRole('button', { name: 'Anlegen und bearbeiten' }).style.minHeight).toBe(cssVars.touchTargets.primary);
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
