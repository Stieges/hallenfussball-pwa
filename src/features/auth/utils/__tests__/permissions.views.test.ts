/**
 * permissions — Sichtbarkeit, globale Rechte und Rollen-Rangfolge (A-07h, Abdeckung features/auth).
 *
 * Die Rechte, die über rolePermissions.json laufen, prüft permissions.rolePermissions.test.ts.
 * Hier stehen die übrigen Regeln: wer welche Ansicht sehen darf, wer global Turniere anlegt, und
 * wie Rollen gegeneinander gerankt sind. Jeder Fall hat ein Gegenbeispiel.
 */
import { describe, it, expect } from 'vitest';
import type { TournamentRole } from '../../types/auth.types';
import {
  canViewTournament,
  canViewSchedule,
  canViewStandings,
  canViewMembers,
  canViewInvitations,
  canCreateTournament,
  isGlobalAdmin,
  isGuest,
  isHigherRole,
  isDowngrade,
  getAssignableRoles,
} from '../permissions';

const ALL_ROLES: TournamentRole[] = ['owner', 'co-admin', 'trainer', 'collaborator', 'viewer'];

describe('Sichtbarkeit im Turnier', () => {
  it('Turnier, Spielplan und Tabelle sind für jede Rolle sichtbar', () => {
    for (const role of ALL_ROLES) {
      expect(canViewTournament(role)).toBe(true);
      expect(canViewSchedule(role)).toBe(true);
      expect(canViewStandings(role)).toBe(true);
    }
  });

  it('Mitglieder und Einladungen sieht nur Owner und Co-Admin', () => {
    expect(canViewMembers('owner')).toBe(true);
    expect(canViewMembers('co-admin')).toBe(true);
    expect(canViewInvitations('owner')).toBe(true);
    expect(canViewInvitations('co-admin')).toBe(true);
  });

  it('Gegenbeispiel: Trainer, Mitarbeiter und Zuschauer sehen weder Mitglieder noch Einladungen', () => {
    for (const role of ['trainer', 'collaborator', 'viewer'] as TournamentRole[]) {
      expect(canViewMembers(role)).toBe(false);
      expect(canViewInvitations(role)).toBe(false);
    }
  });
});

describe('Globale Rechte', () => {
  it('dürfen Turniere anlegen: normale Nutzer und Admins', () => {
    expect(canCreateTournament('user')).toBe(true);
    expect(canCreateTournament('admin')).toBe(true);
  });

  it('Gegenbeispiel: ein Gast darf kein Turnier anlegen', () => {
    expect(canCreateTournament('guest')).toBe(false);
  });

  it('isGlobalAdmin gilt nur für den Admin', () => {
    expect(isGlobalAdmin('admin')).toBe(true);
    expect(isGlobalAdmin('user')).toBe(false);
    expect(isGlobalAdmin('guest')).toBe(false);
  });

  it('isGuest gilt nur für den Gast', () => {
    expect(isGuest('guest')).toBe(true);
    expect(isGuest('user')).toBe(false);
    expect(isGuest('admin')).toBe(false);
  });
});

describe('Rollen-Rangfolge', () => {
  it('Owner steht über allen anderen Rollen', () => {
    expect(isHigherRole('owner', 'co-admin')).toBe(true);
    expect(isHigherRole('owner', 'viewer')).toBe(true);
  });

  it('Trainer steht über Mitarbeiter und Zuschauer, aber unter dem Co-Admin', () => {
    expect(isHigherRole('trainer', 'collaborator')).toBe(true);
    expect(isHigherRole('co-admin', 'trainer')).toBe(true);
    expect(isHigherRole('trainer', 'co-admin')).toBe(false);
  });

  it('Gegenbeispiel: gleiche Rolle ist nicht höher als sich selbst', () => {
    expect(isHigherRole('trainer', 'trainer')).toBe(false);
  });

  it('Gegenbeispiel: Zuschauer ist nie höher als eine andere Rolle', () => {
    expect(isHigherRole('viewer', 'collaborator')).toBe(false);
  });

  it('Herabstufung liegt vor, wenn die neue Rolle niedriger ist', () => {
    expect(isDowngrade('co-admin', 'trainer')).toBe(true);
  });

  it('Gegenbeispiel: Beförderung und gleiche Rolle sind keine Herabstufung', () => {
    expect(isDowngrade('trainer', 'co-admin')).toBe(false);
    expect(isDowngrade('trainer', 'trainer')).toBe(false);
  });
});

describe('getAssignableRoles', () => {
  it('der Owner darf alle Rollen unterhalb des Owners vergeben', () => {
    expect(getAssignableRoles('owner')).toEqual(['co-admin', 'trainer', 'collaborator', 'viewer']);
  });

  it('Gegenbeispiel: ein Zuschauer darf keine Rolle vergeben', () => {
    expect(getAssignableRoles('viewer')).toEqual([]);
  });
});
