/**
 * @OB-079 Der aria-label der Karte überdeckt ihren Inhalt und nennt darum auch Zeit und Ort (sonst liest der Screenreader nur Name und Zustand).
 * Die Test-Übersetzung gibt Schlüssel und Werte zurück, damit die genannten Werte sichtbar sind.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}|${JSON.stringify(opts ?? {})}`,
    i18n: { language: 'de' },
  }),
}));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { TournamentCard } from '../TournamentCard';

const turnier = (extra: Partial<Tournament> = {}): Tournament => ({
  id: 'f2', title: 'F2-Junioren Hallenturnier', status: 'published', teams: [], matches: [{ id: 'm', matchStatus: 'scheduled' }],
  startDate: '2026-11-28', startTime: '08:30', location: { name: 'Bergader SportARENA' }, placementLogic: [],
  ...extra,
} as unknown as Tournament);

const labelOf = () => screen.getByTestId('tournament-card-f2').querySelector('article')!.getAttribute('aria-label')!;
const optionen = (label: string): Record<string, string> => JSON.parse(label.slice(label.indexOf('|') + 1));

describe('@OB-079 aria-label der Karte', () => {
  it('nennt Name, Zustand, Zeit und Ort', () => {
    render(<TournamentCard tournament={turnier()} categoryLabel="upcoming" onClick={vi.fn()} />);
    expect(labelOf()).toMatch(/^card\.ariaLabel\|/);
    expect(optionen(labelOf())).toMatchObject({ title: 'F2-Junioren Hallenturnier', time: 'Sa 28.11. · 08:30', location: 'Bergader SportARENA' });
  });

  it('unter „Heute“ steht nur die Uhrzeit', () => {
    render(<TournamentCard tournament={turnier()} categoryLabel="upcoming" inToday onClick={vi.fn()} />);
    expect(optionen(labelOf()).time).toBe('08:30');
  });

  it('externes Turnier: eigener Schlüssel mit Quelle und ebenfalls Zeit und Ort', () => {
    render(<TournamentCard tournament={turnier({ externalSource: 'Datei' })} categoryLabel="upcoming" onClick={vi.fn()} />);
    expect(labelOf()).toMatch(/^card\.ariaLabelExternal\|/);
    expect(optionen(labelOf())).toMatchObject({ source: 'Datei', location: 'Bergader SportARENA' });
  });

  it('Gegenbeispiel: ohne Ort gilt der Schlüssel ohne Ort (kein loses Komma in der Übersetzung)', () => {
    render(<TournamentCard tournament={turnier({ location: { name: '' } })} categoryLabel="upcoming" onClick={vi.fn()} />);
    expect(labelOf()).toMatch(/^card\.ariaLabelNoLocation\|/);
  });

  it('Gegenbeispiel: externes Turnier ohne Ort: Schlüssel ohne Ort, mit Quelle', () => {
    render(<TournamentCard tournament={turnier({ location: { name: '' }, externalSource: 'Datei' })} categoryLabel="upcoming" onClick={vi.fn()} />);
    expect(labelOf()).toMatch(/^card\.ariaLabelExternalNoLocation\|/);
    expect(optionen(labelOf()).source).toBe('Datei');
  });
});
