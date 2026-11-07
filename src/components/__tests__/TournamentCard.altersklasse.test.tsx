/**
 * Turnierkarte: Die Altersklasse steht auf der Karte, vor der Zeit (@OB-079, Daniel 07.11.: „altersklasse ja“; löst die frühere Fassung
 * „nicht auf der Karte“ ab). Sie wird wie in der Übersicht des Turniers gezeigt (`ageClassText`, unverändert). Fehlt sie, bleibt die Zeile wie heute.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { TournamentCard } from '../TournamentCard';

function turnier(id: string, ageClass: string | undefined, startTime: string): Tournament {
  return {
    id, title: 'Nikolausturnier', status: 'published', teams: [], matches: [{ id: 'm', matchStatus: 'scheduled' }],
    startDate: '2026-11-28', startTime, ageClass,
    location: { name: 'Bergader SportARENA', city: 'Waging am See' }, placementLogic: [], groupSystem: 'groupsAndFinals',
  } as unknown as Tournament;
}

describe('Turnierkarte zeigt die Altersklasse (@OB-079)', () => {
  it('drei Karten mit dem Namen „Nikolausturnier“ unterscheiden sich an der Altersklasse („D-Junioren · 16:30“)', () => {
    render(
      <>
        <TournamentCard tournament={turnier('f2', 'F2-Junioren', '08:30')} categoryLabel="upcoming" inToday />
        <TournamentCard tournament={turnier('f1', 'F1-Junioren', '13:00')} categoryLabel="upcoming" inToday />
        <TournamentCard tournament={turnier('d', 'D-Junioren', '16:30')} categoryLabel="upcoming" inToday />
      </>,
    );
    const zeile = (id: string) => screen.getByTestId(`tournament-card-${id}`).querySelector('[data-testid="card-age-class"]')!.parentElement!;
    expect(zeile('f2')).toHaveTextContent(/^F2-Junioren · 08:30$/);
    expect(zeile('f1')).toHaveTextContent(/^F1-Junioren · 13:00$/);
    expect(zeile('d')).toHaveTextContent(/^D-Junioren · 16:30$/);
    // alle drei heißen gleich – nur die Altersklasse unterscheidet sie
    expect(screen.getAllByRole('heading', { name: 'Nikolausturnier' })).toHaveLength(3);
  });

  it('außerhalb von „Heute“: Altersklasse, Tag und Uhrzeit („D-Junioren · Sa 28.11. · 08:30“)', () => {
    render(<TournamentCard tournament={turnier('d', 'D-Junioren', '08:30')} categoryLabel="upcoming" />);
    expect(screen.getByTestId('card-age-class')).toHaveTextContent(/^D-Junioren$/);
    expect(screen.getByTestId('card-age-class').parentElement).toHaveTextContent(/^D-Junioren · Sa 28\.11\. · 08:30$/);
  });

  it('die Altersklasse steht in der Zeile mit der Zeit, nicht beim Ort', () => {
    render(<TournamentCard tournament={turnier('d', 'D-Junioren', '16:30')} categoryLabel="upcoming" inToday />);
    expect(screen.getByTestId('card-location')).not.toHaveTextContent('D-Junioren');
    expect(screen.getByTestId('card-age-class').parentElement).toContainElement(screen.getByTestId('card-time'));
  });

  it('steht der Jahrgang schon im Namen, erscheint die Altersklasse trotzdem (keine Namens-Erkennung)', () => {
    const t = { ...turnier('d', 'D-Junioren', '16:30'), title: 'D-Junioren Nikolausturnier' };
    render(<TournamentCard tournament={t} categoryLabel="upcoming" inToday />);
    expect(screen.getByTestId('card-age-class')).toHaveTextContent('D-Junioren');
  });

  it('die Altersklasse steht unverändert da (wie in der Übersicht), umgebende Leerzeichen entfallen', () => {
    render(<TournamentCard tournament={turnier('x', '  Ü40 ', '10:00')} categoryLabel="upcoming" inToday />);
    expect(screen.getByTestId('card-age-class').textContent).toBe('Ü40');
  });

  it.each([undefined, '', '   '])('Gegenbeispiel: Altersklasse „%s“ – Zeile wie heute, ohne losen Trenner', (wert) => {
    render(<TournamentCard tournament={turnier('x', wert, '10:00')} categoryLabel="upcoming" inToday />);
    expect(screen.queryByTestId('card-age-class')).toBeNull();
    expect(screen.getByTestId('card-time')).toHaveTextContent(/^10:00$/);
    expect(screen.getByTestId('card-time').parentElement).toHaveTextContent(/^10:00$/);
  });

  it('Gegenbeispiel: Altersklasse ohne Uhrzeit unter „Heute“ steht allein, ohne Trenner', () => {
    const t = { ...turnier('x', 'D-Junioren', '10:00'), startTime: undefined } as Tournament;
    render(<TournamentCard tournament={t} categoryLabel="upcoming" inToday />);
    expect(screen.getByTestId('card-age-class').parentElement).toHaveTextContent(/^D-Junioren$/);
  });

  it('Gegenbeispiel: ohne Altersklasse steht in Zeile 2 nur die Uhrzeit, kein Platzhalter und kein Trenner', () => {
    render(<TournamentCard tournament={turnier('x', undefined, '16:30')} categoryLabel="upcoming" inToday />);
    expect(screen.queryByTestId('card-age-class')).toBeNull();
    expect(screen.getByTestId('card-time').parentElement).toHaveTextContent(/^16:30$/);
  });

  it('Gegenbeispiel: Modus, Veranstalter und Platzierung bleiben weg', () => {
    const t = { ...turnier('x', 'D-Junioren', '10:00'), organizer: 'TSV Waging' } as Tournament;
    render(<TournamentCard tournament={t} categoryLabel="upcoming" inToday />);
    const karte = screen.getByTestId('tournament-card-x');
    expect(karte).not.toHaveTextContent('TSV Waging');
    expect(karte).not.toHaveTextContent('card.groupSystem');
    expect(karte).not.toHaveTextContent('card.labels');
    expect(karte.querySelector('dl')).toBeNull();
  });
});
