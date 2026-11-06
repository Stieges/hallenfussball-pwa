/**
 * @LZ-001 Die Karte auf der Startseite trägt dasselbe Wort wie der Zustand, auch im Archiv: Bereit statt „Bevorstehend“,
 * Abgeschlossen bzw. Abgebrochen statt „Archiviert“. @OB-078 Am Handy trägt der Titel die volle Breite (kein Platzhalter für
 * das Schild, Innenabstand `spacing.md`). Zustandsschild: Schrift `textPrimary`, `fontSizes.sm`, ohne Großbuchstaben.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cssVars } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';

const hoisted = vi.hoisted(() => ({ mobile: true }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => hoisted.mobile }));

import { TournamentCard } from '../TournamentCard';

function turnier(extra: Partial<Tournament>): Tournament {
  return {
    id: 't1', title: 'F2-Junioren Hallenturnier', status: 'published', teams: [], matches: [{ id: 'm1', matchStatus: 'scheduled' }],
    startDate: '2026-11-28', startTime: '08:30', location: { name: 'Halle' }, placementLogic: [], groupSystem: 'roundRobin',
    ...extra,
  } as unknown as Tournament;
}

describe('@LZ-001 Wort auf der Karte', () => {
  it('Bereit: kommendes Turnier trägt „status.upcoming“ (de: Bereit)', () => {
    render(<TournamentCard tournament={turnier({})} categoryLabel="upcoming" />);
    expect(screen.getByText('dashboard:status.upcoming')).toBeInTheDocument();
  });

  it('Archiv: abgeschlossen trägt „Abgeschlossen“ (status.finished), nie „Archiviert“', () => {
    render(<TournamentCard tournament={turnier({ lifecycleStatus: 'finished' })} categoryLabel="archived" />);
    expect(screen.getByText('dashboard:status.finished')).toBeInTheDocument();
    expect(screen.queryByText('dashboard:status.archived')).toBeNull();
  });

  it('Archiv: abgebrochen trägt „Abgebrochen“ (status.cancelled)', () => {
    render(<TournamentCard tournament={turnier({ lifecycleStatus: 'cancelled' })} categoryLabel="archived" />);
    expect(screen.getByText('dashboard:status.cancelled')).toBeInTheDocument();
  });

  it('Schild: Schrift textPrimary, Größe sm, ohne Großbuchstaben, Zustand am Rand in seiner Farbe', () => {
    render(<TournamentCard tournament={turnier({})} categoryLabel="upcoming" />);
    const schild = screen.getByText('dashboard:status.upcoming');
    expect(schild.style.color).toBe(cssVars.colors.textPrimary);
    expect(schild.style.fontSize).toBe(cssVars.fontSizes.sm);
    expect(schild.style.textTransform).toBe('');
  });
});

describe('@OB-078 Karte am Handy', () => {
  it('der Titel hat keinen Platzhalter für das Schild (kein rechter Innenabstand von 120 px), die Karte am Handy den Abstand md', () => {
    render(<TournamentCard tournament={turnier({})} categoryLabel="upcoming" />);
    expect(screen.getByRole('heading', { name: 'F2-Junioren Hallenturnier' }).style.paddingRight).toBe('');
    expect(screen.getByTestId('tournament-card-t1').style.padding).toBe(cssVars.spacing.md);
  });

  it('Gegenbeispiel: ab Tablet bleibt der weite Innenabstand', () => {
    hoisted.mobile = false;
    render(<TournamentCard tournament={turnier({})} categoryLabel="upcoming" />);
    expect(screen.getByTestId('tournament-card-t1').style.padding).toBe(cssVars.spacing.xl);
    hoisted.mobile = true;
  });
});
