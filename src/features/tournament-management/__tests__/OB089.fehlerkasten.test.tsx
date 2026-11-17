/**
 * @OB-089 Ein Fehler- oder Warnkasten hat überall einen sichtbaren, getönten Hintergrund (Befund C-FEHLERBOX-HINTERGRUND-UNGUELTIG).
 * Beispielseiten des Gherkins: Verwaltung der Sponsoren, Verwaltung der Felder, Liste der Monitore. Erwartung: Die Fläche des Kastens ist ein
 * Token der Stufe (`var(--color-error-light)`), nie ein Token mit angehängter Deckkraft (`var(--color-error)22` ergibt keine Farbe).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cssVars } from '../../../design-tokens';
import { SponsorManagement } from '../SponsorManagement';
import { FieldManagement } from '../FieldManagement';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import type { Tournament } from '../../../types/tournament';

const mockUpdateField = vi.fn();

vi.mock('../../../hooks', () => ({
  useMonitors: () => ({
    monitors: [],
    createMonitor: vi.fn(),
    deleteMonitor: vi.fn(),
    duplicateMonitor: vi.fn(),
    getDisplayUrl: vi.fn(),
  }),
  useSponsors: () => ({
    sponsors: [],
    addSponsor: vi.fn(),
    updateSponsor: vi.fn(),
    deleteSponsor: vi.fn(),
    isSponsorUsedInSlides: () => false,
  }),
  useFields: () => ({
    fields: [{ id: 'f1', defaultName: 'Feld 1' }],
    getFieldDisplayName: () => 'Feld 1',
    getFieldShortCode: () => 'F1',
    updateField: mockUpdateField,
    isFieldUsedInSlides: () => false,
  }),
}));

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner' }),
}));

vi.mock('../../../hooks/useMonitorHeartbeats', () => ({
  useMonitorHeartbeats: () => new Map(),
}));

const turnier = { id: 't1', name: 'Test', teams: [], matches: [], monitors: [], fields: [{ id: 'f1', defaultName: 'Feld 1' }] } as unknown as Tournament;

/** Der Kasten ist der Hinweis-Baustein (Ton „Fehler“) um den Fehlertext – seine Fläche muss das Token der Stufe sein, nie ein Token mit Anhang. */
function pruefeKasten(text: HTMLElement): void {
  const kasten = text.closest<HTMLElement>('[data-tone="error"]');
  expect(kasten, 'Fehlertext steht nicht in einem Fehlerkasten').not.toBeNull();
  expect(kasten!.style.background).toBe(cssVars.colors.errorLight);
  expect(kasten!.getAttribute('style') ?? '').not.toMatch(/var\(--[a-z-]+\)[0-9a-fA-F]{2}\b/);
  expect(kasten).toHaveAttribute('role', 'alert');
}

describe('@OB-089 Fehlerkasten mit getöntem Hintergrund', () => {
  it('@OB-089 Beispiel „die Verwaltung der Sponsoren“: „Name fehlt“ steht in einem Kasten mit Fehler-Hintergrund', async () => {
    const user = userEvent.setup();
    render(<SponsorManagement tournament={turnier} onTournamentUpdate={vi.fn()} />);
    await user.click(screen.getByText(/sponsor\.addSponsor/));
    await user.click(screen.getByText(/sponsor\.add$/));
    pruefeKasten(screen.getByText(/sponsor\.errors\.nameRequired/));
  });

  it('@OB-089 Beispiel „die Verwaltung der Felder“: ein Speicherfehler steht in einem Kasten mit Fehler-Hintergrund', async () => {
    const user = userEvent.setup();
    mockUpdateField.mockRejectedValueOnce(new Error('Speichern fehlgeschlagen'));
    render(<FieldManagement tournament={turnier} onTournamentUpdate={vi.fn()} />);
    await user.click(screen.getByTitle('tournament:field.editLabel'));
    await user.click(screen.getByText('tournament:common.save'));
    pruefeKasten(await screen.findByText('Speichern fehlgeschlagen'));
  });

  it('@OB-089 Beispiel „die Liste der Monitore“: ein leerer Name steht in einem Kasten mit Fehler-Hintergrund', async () => {
    const user = userEvent.setup();
    render(<MonitorsConfigTab tournament={turnier} onTournamentUpdate={vi.fn()} />);
    await user.click(screen.getByTestId('monitors-start-empty'));
    await user.click(screen.getByText(/monitors\.createAndEdit/));
    pruefeKasten(await screen.findByText(/monitors\.errors\./));
  });
});
