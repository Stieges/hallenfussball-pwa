/**
 * @OB-079 Die Turnierkarte auf der Startseite zeigt nur, was man zum Finden braucht (docs/anforderungen/2026-10-02_oberflaeche.md).
 * Gegeben Olli hat am Samstag F2 (08:30), F1 (13:00) und D (16:30) in der Bergader SportARENA. Dann zeigt jede Karte Name,
 * Altersklasse, unter „Heute“ die Uhrzeit, sonst Tag und Uhrzeit, und den Ort; Modus, Veranstalter und Platzierung stehen nicht auf der Karte.
 * (Die Altersklasse prüft TournamentCard.altersklasse.test.tsx, Zustandswort und Rollen-Schild TournamentCard.zustand.ob079.test.tsx.)
 * („Alle drei Karten ohne Scrollen“ prüft das Playwright-Spec startseite-turniertag.spec.ts.)
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
  it('unter „Heute“: Name, nur die Uhrzeit und der Ort (Bereit steht nicht auf der Karte)', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    expect(screen.getByRole('heading', { name: 'F2-Junioren Hallenturnier' })).toBeInTheDocument();
    expect(screen.queryByText('dashboard:status.upcoming')).toBeNull();
    expect(screen.getByTestId('card-time')).toHaveTextContent(/^08:30$/);
    expect(screen.getByTestId('card-age-class')).toHaveTextContent('F-Junioren');
    expect(screen.getByTestId('card-location')).toHaveTextContent('Bergader SportARENA');
  });

  it('außerhalb von „Heute“: Tag und Uhrzeit („Sa 28.11. · 08:30“)', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" />);
    expect(screen.getByTestId('card-time')).toHaveTextContent('Sa 28.11. · 08:30');
    expect(screen.getByTestId('card-age-class').parentElement).toHaveTextContent('F-Junioren · Sa 28.11. · 08:30');
  });

  it('Gegenbeispiel: Modus, Veranstalter und Platzierung stehen nicht auf der Karte', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    const karte = screen.getByTestId('tournament-card-f2');
    expect(karte).not.toHaveTextContent('TSV Waging');
    expect(karte).not.toHaveTextContent('card.groupSystem');
    expect(karte).not.toHaveTextContent('card.labels');
    expect(karte).not.toHaveTextContent('card.placementAbbreviations');
    expect(karte.querySelector('dl')).toBeNull();
  });

  it('der Name steht in voller Breite, bricht an Leerzeichen um, nie im Wort und wird nie abgeschnitten', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    const titel = screen.getByRole('heading', { name: 'F2-Junioren Hallenturnier' });
    expect(titel.style.wordBreak).toBe('normal');
    expect(titel.style.overflowWrap).toBe('normal');
    // nie abgeschnitten (kein line-clamp): 50 Zeichen bleiben in voller Breite bei zwei Zeilen
    expect(titel.style.webkitLineClamp).toBe('');
    expect(titel.style.overflow).toBe('');
  });

  it('der Ort wird nie mit Auslassung gekürzt (er bricht notfalls um)', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" inToday />);
    const ort = screen.getByTestId('card-location');
    expect(ort.style.textOverflow).toBe('');
    expect(ort.style.whiteSpace).toBe('');
    expect(ort).toHaveTextContent('Bergader SportARENA');
  });

  it('Gegenbeispiel: ohne Ort steht kein leerer Trenner da; ohne Datum steht „card.noDate“', () => {
    const ohne = { ...f2, id: 'x', location: { name: '' }, startDate: undefined, startTime: undefined, date: undefined } as unknown as Tournament;
    render(<TournamentCard tournament={ohne} categoryLabel="upcoming" />);
    expect(screen.queryByTestId('card-location')).toBeNull();
    expect(screen.getByTestId('card-time')).toHaveTextContent('card.noDate');
  });
});

describe('@OB-079 Menü der kompakten Karte', () => {
  it('die Karte unter der Maus liegt über ihren Nachbarn (das Menü ragt in die nächste Karte); beim Verlassen ist alles zurückgesetzt', () => {
    render(<TournamentCard tournament={f2} categoryLabel="upcoming" onClick={vi.fn()} />);
    const karte = screen.getByTestId('tournament-card-f2');
    fireEvent.mouseEnter(karte);
    expect(karte.style.zIndex).toBe('1');
    expect(karte.style.transform).toBe('translateY(-2px)');
    fireEvent.mouseLeave(karte);
    expect(karte.style.zIndex).toBe('auto');
    expect(karte.style.transform).toBe('none');
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

  it('Gegenbeispiel: ohne Uhrzeit steht nur der Tag („Sa 28.11.“), unter „Heute“ nichts; nie das rohe Datumsfeld', () => {
    const ohneZeit = { id: 'a', startDate: '2026-11-28', startTime: undefined } as unknown as Tournament;
    expect(formatCardTime(ohneZeit, 'de', true, 'Kein Datum')).toBe('Sa 28.11.');
    expect(formatCardTime(ohneZeit, 'en', true, 'No date')).toBe('Sat 28 Nov');
    expect(formatCardTime(ohneZeit, 'de', false, 'Kein Datum')).toBe('');
    const altesFormat = { id: 'b', date: '28.11.2026' } as unknown as Tournament;
    expect(formatCardTime(altesFormat, 'de', true, 'Kein Datum')).toBe('Sa 28.11.');
  });

  it('Gegenbeispiel: ohne jedes Datum steht der Ersatztext', () => {
    const t = { id: 'a', date: '', startDate: undefined } as unknown as Tournament;
    expect(formatCardTime(t, 'de', true, 'Kein Datum')).toBe('Kein Datum');
  });
});
