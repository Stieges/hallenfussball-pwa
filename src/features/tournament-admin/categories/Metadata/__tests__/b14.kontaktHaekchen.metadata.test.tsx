/**
 * B-14 (Review #346 A3): In der Turnierverwaltung lässt sich das Häkchen „Ansprechpartner öffentlich zeigen“ allein
 * setzen und wieder zurücknehmen (@W1-031, @W1-030) – Speichern wird dafür aktiv.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { MetadataCategory } from '../index';

// Das Ortsformular braucht Repositories (Ortssuche); hier geht es nur um die Kontaktdaten daneben.
vi.mock('../../../../../components/LocationForm', () => ({ LocationForm: () => null }));

function turnier(showPublic?: boolean): Tournament {
  return {
    id: 't1', title: 'Hallencup Nord', status: 'published', ageClass: 'E-Jugend', teams: [], matches: [],
    startDate: '2026-11-21', startTime: '13:00', location: { name: 'Sporthalle Nord' },
    contactInfo: { name: 'Olga Orga', email: 'olga@orga.test', phone: '0171 1112223', ...(showPublic ? { showPublic } : {}) },
  } as unknown as Tournament;
}

function renderMetadata(tournament: Tournament) {
  const onTournamentUpdate = vi.fn();
  render(<MetadataCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={onTournamentUpdate} />);
  fireEvent.click(screen.getByText('admin:metadata.locationAndContact')); // Abschnitt „Ort und Kontakt“ öffnen
  return { onTournamentUpdate, save: () => screen.getByRole('button', { name: 'admin:metadata.saveChanges' }) };
}

beforeEach(() => vi.clearAllMocks());

describe('Turnierverwaltung – Häkchen „Ansprechpartner öffentlich zeigen“ (B-14)', () => {
  it('Gegenbeispiel: ohne Änderung bleibt Speichern gesperrt', () => {
    const { save } = renderMetadata(turnier());
    expect(save()).toBeDisabled();
  });

  it('@W1-031 nur das Häkchen setzen → Speichern aktiv, gespeichert wird showPublic true', () => {
    const { onTournamentUpdate, save } = renderMetadata(turnier());
    fireEvent.click(screen.getByTestId('contact-show-public'));
    expect(save()).toBeEnabled();
    fireEvent.click(save());
    expect(onTournamentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ contactInfo: expect.objectContaining({ name: 'Olga Orga', showPublic: true }) }),
    );
  });

  it('@W1-030 nur das Häkchen zurücknehmen → Speichern aktiv, Kontakt wieder intern', () => {
    const { onTournamentUpdate, save } = renderMetadata(turnier(true));
    fireEvent.click(screen.getByTestId('contact-show-public'));
    expect(save()).toBeEnabled();
    fireEvent.click(save());
    const saved = (onTournamentUpdate.mock.calls[0] as [Partial<Tournament>])[0];
    expect(saved.contactInfo?.showPublic).not.toBe(true);
  });
});
