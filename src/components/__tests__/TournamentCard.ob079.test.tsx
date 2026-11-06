/**
 * @OB-079 Die Turnierkarte auf der Startseite zeigt nur, was man zum Finden braucht (docs/anforderungen/2026-10-02_oberflaeche.md).
 * Gegeben Olli hat am Samstag F2 (08:30), F1 (13:00) und D (16:30) in der Bergader SportARENA. Dann zeigt jede Karte Name, Zustandswort,
 * unter „Heute“ die Uhrzeit, sonst Tag und Uhrzeit, und den Ort; Altersklasse, Modus, Veranstalter und Platzierung stehen nicht auf der Karte.
 * („Alle drei Karten ohne Scrollen“ prüft das Playwright-Spec startseite-turniertag.spec.ts.)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import { formatCardTime } from '../../utils/formatCardTime';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { TournamentCard } from '../TournamentCard';

const f2 = {
  id: 'f2', title: 'F2-Junioren Hallenturnier', status: 'published', teams: [], matches: [{ id: 'm', matchStatus: 'scheduled' }],
  startDate: '2026-11-28', startTime: '08:30', ageClass: 'F-Junioren', organizer: 'TSV Waging', groupSystem: 'groupsAndFinals',
  location: { name: 'Bergader SportARENA', city: 'Waging am See' },
  placementLogic: [{ id: 'points', enabled: true }, { id: 'goalDifference', enabled: true }],
} as unknown as Tournament;

describe('@OB-079 Inhalt der Karte', () => {
  it('unter „Heute“: Name, Zustandswort, nur die Uhrzeit und der Ort', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    expect(screen.getByRole('heading', { name: 'F2-Junioren Hallenturnier' })).toBeInTheDocument();
    expect(screen.getByText('dashboard:status.upcoming')).toBeInTheDocument();
    expect(screen.getByTestId('card-time')).toHaveTextContent(/^08:30$/);
    expect(screen.getByTestId('card-location')).toHaveTextContent('Bergader SportARENA');
    expect(screen.getByTestId('card-location')).toHaveAttribute('title', 'Bergader SportARENA');
  });

  it('außerhalb von „Heute“: Tag und Uhrzeit („Sa 28.11. · 08:30“)', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" />);
    expect(screen.getByTestId('card-time')).toHaveTextContent('Sa 28.11. · 08:30');
  });

  it('Gegenbeispiel: Altersklasse, Modus, Veranstalter und Platzierung stehen nicht auf der Karte', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    const karte = screen.getByTestId('tournament-card-f2');
    expect(karte).not.toHaveTextContent('F-Junioren');
    expect(karte).not.toHaveTextContent('TSV Waging');
    expect(karte).not.toHaveTextContent('card.groupSystem');
    expect(karte).not.toHaveTextContent('card.labels');
    expect(karte).not.toHaveTextContent('card.placementAbbreviations');
    expect(karte.querySelector('dl')).toBeNull();
  });

  it('der Name bricht an Leerzeichen um, nie im Wort, höchstens zwei Zeilen', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    const titel = screen.getByRole('heading', { name: 'F2-Junioren Hallenturnier' });
    expect(titel.style.wordBreak).toBe('normal');
    expect(titel.style.overflowWrap).toBe('normal');
    expect(titel.style.webkitLineClamp).toBe('2');
  });

  it('der Ort ist einzeilig und wird mit Auslassung gekürzt', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    const ort = screen.getByTestId('card-location');
    expect(ort.style.whiteSpace).toBe('nowrap');
    expect(ort.style.textOverflow).toBe('ellipsis');
  });

  it('Gegenbeispiel: ohne Ort steht kein leerer Trenner da; ohne Datum steht „card.noDate“', () => {
    const ohne = { ...f2, id: 'x', location: { name: '' }, startDate: undefined, startTime: undefined, date: undefined } as unknown as Tournament;
    render(<TournamentCard tournament={ohne} categoryLabel="upcoming" />);
    expect(screen.queryByTestId('card-location')).toBeNull();
    expect(screen.getByTestId('card-time')).toHaveTextContent('card.noDate');
  });
});

describe('@OB-079 Zeitformat in beiden Sprachen', () => {
  it.each([
    ['de', true, 'Sa 28.11. · 08:30'],
    ['de', false, '08:30'],
    ['en', true, 'Sat 28 Nov · 08:30'],
    ['en', false, '08:30'],
  ])('Sprache %s, mit Tag %s: „%s“', (sprache, mitTag, erwartet) => {
    expect(formatCardTime(f2, sprache, mitTag, 'kein Datum')).toBe(erwartet);
  });

  it('Gegenbeispiel: ohne Uhrzeit fällt die Zeit auf das Datumsfeld oder den Ersatztext zurück', () => {
    const t = { id: 'a', date: '', startDate: undefined } as unknown as Tournament;
    expect(formatCardTime(t, 'de', true, 'Kein Datum')).toBe('Kein Datum');
  });
});
