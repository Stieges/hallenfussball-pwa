/**
 * Admin-Center-Einstieg der Kopie fürs Proben (Paket KP): „Turnier duplizieren“ ruft dieselbe Kopierlogik
 * wie das Dashboard. @W5-024 bis @W5-026, C-COPY-AC-ID, C-COPY-AC-FELDER. Szenarien aus
 * docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { hallencupOstGespielt, OST_ID, OST_CODE } from '../../../../../core/models/__fixtures__/hallencupOstGespielt';
import { initRealDeI18n } from '../../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const saveTournament = vi.fn<(tournament: Tournament) => Promise<void>>();
vi.mock('../../../../../hooks', () => ({
  useTournaments: () => ({ saveTournament }),
}));
vi.mock('../../../../../hooks/useRepository', () => ({
  useRepository: () => ({ get: (id: string) => Promise.resolve(id === OST_ID ? hallencupOstGespielt() : null) }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../../../tournament-management/FieldManagement', () => ({ FieldManagement: () => null }));

import { SettingsCategory } from '../index';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function duplicate(original: Tournament, neuerName?: string): Promise<Tournament> {
  render(<SettingsCategory tournamentId={original.id} tournament={original} onTournamentUpdate={vi.fn()} />);
  if (neuerName !== undefined) {
    fireEvent.change(screen.getByTestId('duplicate-tournament-name'), { target: { value: neuerName } });
  }
  fireEvent.click(screen.getByTestId('duplicate-tournament-button'));
  await waitFor(() => expect(saveTournament).toHaveBeenCalledTimes(1));
  return saveTournament.mock.calls[0][0];
}

describe('Admin Center: Turnier duplizieren', () => {
  beforeEach(() => { saveTournament.mockReset(); saveTournament.mockResolvedValue(undefined); });

  it('C-COPY-AC-ID: die Kopie hat eine echte UUID, nicht tournament-<Zeit>-<Zufall>', async () => {
    const saved = await duplicate(hallencupOstGespielt());
    expect(saved.id).toMatch(UUID);
    expect(saved.id).not.toBe(OST_ID);
    expect(saved.matches.every((spiel) => UUID.test(spiel.id))).toBe(true);
  });

  it('@W5-024 C-COPY-AC-FELDER: kein Freigabe-Code, nicht öffentlich', async () => {
    const saved = await duplicate(hallencupOstGespielt());
    expect(saved.isPublic).toBe(false);
    expect(JSON.stringify(saved)).not.toContain(OST_CODE);
  });

  it('@W5-025 C-COPY-AC-FELDER: nicht abgeschlossen, Spiele leer – und Teams, Spielplan, Regeln bleiben erhalten', async () => {
    const original = hallencupOstGespielt();
    const saved = await duplicate(original);
    expect(saved.completedAt).toBeUndefined();
    expect(saved.manuallyCompleted).toBeUndefined();
    expect(saved.matches).toHaveLength(original.matches.length);
    expect(saved.matches.every((spiel) => spiel.matchStatus === 'scheduled' && spiel.finishedAt === undefined)).toBe(true);
    expect(saved.teams.map((team) => team.name)).toEqual(original.teams.map((team) => team.name));
    expect(saved.pointSystem).toEqual(original.pointSystem);
  });

  it('@W5-026 keine Monitore in der Kopie', async () => {
    const saved = await duplicate(hallencupOstGespielt());
    expect(saved.monitors).toBeUndefined();
  });

  it('@W5-027 Gegenbeispiel: das Original wird nicht angefasst', async () => {
    const original = hallencupOstGespielt();
    await duplicate(original);
    expect(original).toEqual(hallencupOstGespielt());
    expect(saveTournament.mock.calls.every(([saved]) => saved.id !== OST_ID)).toBe(true);
  });

  it('@W5-028 die Kopie heißt „Hallencup Ost (Probe)“', async () => {
    render(<SettingsCategory tournamentId={OST_ID} tournament={hallencupOstGespielt()} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('duplicate-tournament-name')).toHaveValue('Hallencup Ost (Probe)');
    fireEvent.click(screen.getByTestId('duplicate-tournament-button'));
    await waitFor(() => expect(saveTournament).toHaveBeenCalledTimes(1));
    expect(saveTournament.mock.calls[0][0].title).toBe('Hallencup Ost (Probe)');
  });

  it('@W5-028 Olli kann den Namen vor dem Speichern ändern', async () => {
    const saved = await duplicate(hallencupOstGespielt(), 'Generalprobe Samstag');
    expect(saved.title).toBe('Generalprobe Samstag');
  });

  it('@W5-028 Gegenbeispiel: Kopie einer Kopie bekommt „(Probe)“ nur einmal', () => {
    render(<SettingsCategory tournamentId={OST_ID} tournament={{ ...hallencupOstGespielt(), title: 'Hallencup Ost (Probe)' }} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('duplicate-tournament-name')).toHaveValue('Hallencup Ost (Probe)');
  });
});
