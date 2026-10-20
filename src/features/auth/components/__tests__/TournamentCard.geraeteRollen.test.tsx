/**
 * Turnier-Karte und Rollen-Abzeichen für die Geräte-Rollen (A-27, brief-A-27.md R-A27-7, § 7 T2-UI (a)).
 * Texte wie im Bestand ohne i18n (TournamentCard/ROLE_LABELS); die Rollen entstehen erst mit A-16 (helper) bzw. B-20
 * (screen). Gegenbeispiel: die Karte eines Kontos mit Rolle collaborator bleibt unverändert.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TournamentCard } from '../TournamentCard';
import { RoleBadge } from '../RoleBadge';
import type { TournamentMembership, TournamentRole } from '../../types/auth.types';

const tournament = { id: 'live-cup', title: 'Live-Cup', status: 'live' as const, teamCount: 8, fieldCount: 2 };

function membership(role: TournamentRole): TournamentMembership {
  return {
    id: `m-${role}`,
    userId: 'u-tom',
    tournamentId: 'live-cup',
    role,
    teamIds: [],
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-10T09:00:00.000Z',
  };
}

describe('Turnier-Karte mit Geräte-Rolle', () => {
  it('Helfer-Zugang (helper): „Du hilfst bei diesem Turnier“ und Abzeichen „Helfer“', () => {
    render(<TournamentCard tournament={tournament} membership={membership('helper')} />);
    expect(screen.getByText('Du hilfst bei diesem Turnier')).toBeInTheDocument();
    expect(screen.getByText('Helfer')).toBeInTheDocument();
  });

  it('Bildschirm (screen): „Dieses Gerät zeigt das Turnier an“ und Abzeichen „Bildschirm“', () => {
    render(<TournamentCard tournament={tournament} membership={membership('screen')} />);
    expect(screen.getByText('Dieses Gerät zeigt das Turnier an')).toBeInTheDocument();
    expect(screen.getByText('Bildschirm')).toBeInTheDocument();
  });

  it('Gegenbeispiel: Konto mit Rolle collaborator bleibt „Du kannst Ergebnisse eingeben“', () => {
    render(<TournamentCard tournament={tournament} membership={membership('collaborator')} />);
    expect(screen.getByText('Du kannst Ergebnisse eingeben')).toBeInTheDocument();
  });

  it('Rollen-Abzeichen „Bildschirm“ einzeln', () => {
    render(<RoleBadge role="screen" />);
    expect(screen.getByText('Bildschirm')).toBeInTheDocument();
  });
});
