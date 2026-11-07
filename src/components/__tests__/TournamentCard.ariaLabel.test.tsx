/**
 * @OB-079 Der aria-label der Karte überdeckt ihren Inhalt: Er nennt Name, Zustand (nur wenn er nicht „Bereit“ ist), Altersklasse, Zeit,
 * Ort, Rolle und Quelle – sonst liest der Screenreader nur den Namen vor. Teile, die es nicht gibt, fehlen ganz (kein loses Komma).
 * Die Test-Übersetzung gibt die deutschen Wörter zurück, damit der vorgelesene Satz lesbar ist.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

const WORTE: Record<string, string> = {
  'status.running': 'Läuft', 'status.finished': 'Abgeschlossen', 'status.cancelled': 'Abgebrochen', 'status.draft': 'Entwurf', 'status.upcoming': 'Bereit',
  'sections.today': 'Heute', 'card.role.co-admin': 'Co-Admin', 'card.role.collaborator': 'Helfer',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => (key === 'card.ariaLabelTitle' ? `Turnier: ${opts?.title}` : WORTE[key] ?? key),
    i18n: { language: 'de' },
  }),
}));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { TournamentCard } from '../TournamentCard';

const turnier = (extra: Partial<Tournament> = {}): Tournament => ({
  id: 'f2', title: 'Nikolausturnier', status: 'published', teams: [], matches: [{ id: 'm', matchStatus: 'scheduled' }],
  startDate: '2026-11-28', startTime: '08:30', ageClass: 'F-Junioren', location: { name: 'Bergader SportARENA' }, placementLogic: [],
  ...extra,
} as unknown as Tournament);

const labelOf = () => screen.getByTestId('tournament-card-f2').querySelector('article')!.getAttribute('aria-label')!;

describe('@OB-079 aria-label der Karte', () => {
  it('Bereit: Name, Altersklasse, Zeit und Ort – ohne Zustandswort', () => {
    render(<TournamentCard tournament={turnier()} categoryLabel="upcoming" onClick={vi.fn()} />);
    expect(labelOf()).toBe('Turnier: Nikolausturnier, F-Junioren, Sa 28.11. · 08:30, Bergader SportARENA');
  });

  it('unter „Heute“ steht nur die Uhrzeit', () => {
    render(<TournamentCard tournament={turnier()} categoryLabel="upcoming" inToday onClick={vi.fn()} />);
    expect(labelOf()).toBe('Turnier: Nikolausturnier, F-Junioren, 08:30, Bergader SportARENA');
  });

  it.each([['running', 'Läuft'], ['archived', 'Abgeschlossen']])('Zustand %s: das Wort „%s“ steht nach dem Namen', (kategorie, wort) => {
    render(<TournamentCard tournament={turnier()} categoryLabel={kategorie} inToday onClick={vi.fn()} />);
    expect(labelOf()).toBe(`Turnier: Nikolausturnier, ${wort}, F-Junioren, 08:30, Bergader SportARENA`);
  });

  it('abgebrochen: „Abgebrochen“', () => {
    render(<TournamentCard tournament={turnier({ lifecycleStatus: 'cancelled' })} categoryLabel="archived" inToday onClick={vi.fn()} />);
    expect(labelOf()).toContain(', Abgebrochen, ');
  });

  it('mit Rolle: die Rolle („Co-Admin“) steht hinter dem Ort', () => {
    render(<TournamentCard tournament={turnier({ myRole: 'co-admin' })} categoryLabel="upcoming" inToday onClick={vi.fn()} />);
    expect(labelOf()).toBe('Turnier: Nikolausturnier, F-Junioren, 08:30, Bergader SportARENA, Co-Admin');
  });

  it('externes Turnier: die Quelle steht am Ende', () => {
    render(<TournamentCard tournament={turnier({ externalSource: 'Datei' })} categoryLabel="upcoming" onClick={vi.fn()} />);
    expect(labelOf()).toBe('Turnier: Nikolausturnier, F-Junioren, Sa 28.11. · 08:30, Bergader SportARENA, Datei');
  });

  it('Gegenbeispiel: Eigentümer hat keine Rolle im Satz; ohne Altersklasse und ohne Ort bleibt kein loses Komma', () => {
    render(<TournamentCard tournament={turnier({ myRole: 'owner', ageClass: '  ', location: { name: '' } })} categoryLabel="upcoming" inToday onClick={vi.fn()} />);
    expect(labelOf()).toBe('Turnier: Nikolausturnier, 08:30');
  });

  it('Gegenbeispiel: Entwurf (kein „Bereit“) wird dem Screenreader gesagt', () => {
    render(<TournamentCard tournament={turnier({ status: 'draft' })} categoryLabel="draft" onClick={vi.fn()} />);
    expect(labelOf()).toContain('Turnier: Nikolausturnier, Entwurf, ');
  });
});
