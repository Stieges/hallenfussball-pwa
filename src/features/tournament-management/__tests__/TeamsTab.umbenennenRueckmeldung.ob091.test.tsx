/**
 * @OB-091 Nach dem Umbenennen: Bearbeitung schließt, „Name gespeichert“ erscheint, die Karte zeigt den neuen Namen,
 * und ein zweiter Tipp gleich danach an dieselbe Stelle („Umbenennen“) öffnet die Bearbeitung nicht erneut.
 * Zeit nur über eingefrorenes `Date` (keine feste Wartezeit).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Tournament } from '../../../types/tournament';
import { ToastProvider } from '../../../components/ui/Toast';

vi.mock('../../auth/hooks/useCan', () => ({ useCan: () => true }));

import { TeamsTab } from '../TeamsTab';

const turnier = (name: string): Tournament => ({ id: 't1', title: 'Wintercup', status: 'published', teams: [{ id: 'ufer', name }], matches: [] }) as unknown as Tournament;

function Huelle() {
  const [t, setT] = useState(turnier('SG Taching/Tengling'));
  return <ToastProvider><TeamsTab tournament={t} onTournamentUpdate={setT} /></ToastProvider>;
}

async function umbenennenUndSpeichern(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('team-expand-toggle-ufer'));
  await user.click(screen.getByTestId('team-edit-button-ufer'));
  await user.type(screen.getByTestId('team-rename-input-ufer'), '{selectall}SG Tengling/Taching');
  await user.click(screen.getByTestId('team-rename-save-ufer'));
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-26T10:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('TeamsTab @OB-091', () => {
  it('@OB-091 nach „Speichern“ schließt die Bearbeitung, „Name gespeichert“ erscheint, die Karte zeigt den neuen Namen', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    render(<Huelle />);
    await umbenennenUndSpeichern(user);
    expect(screen.queryByTestId('team-rename-input-ufer')).toBeNull();
    expect(await screen.findByText('tournament:teams.renameSaved')).toBeTruthy();
    // endet auf den neuen Namen (jsdom hängt bei Textknoten-Wechsel mit <wbr> den alten Text davor; im Browser prüft das Playwright-Spiegelstück genau)
    expect(screen.getByTestId('team-name-ufer').textContent).toMatch(/SG Tengling\/Taching$/);
  });

  it('@OB-091 ein zweiter Tipp gleich danach auf „Umbenennen“ öffnet die Bearbeitung nicht erneut', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    render(<Huelle />);
    await umbenennenUndSpeichern(user);
    await user.click(screen.getByTestId('team-edit-button-ufer'));
    expect(screen.queryByTestId('team-rename-input-ufer')).toBeNull();
  });

  it('@OB-091 Gegenbeispiel: später öffnet „Umbenennen“ die Bearbeitung wieder', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    render(<Huelle />);
    await umbenennenUndSpeichern(user);
    vi.setSystemTime(new Date('2026-11-26T10:00:05Z'));
    await user.click(screen.getByTestId('team-edit-button-ufer'));
    expect(screen.getByTestId('team-rename-input-ufer')).toBeTruthy();
  });
});
