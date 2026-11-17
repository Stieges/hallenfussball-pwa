/**
 * @ZM-212 Monitor-Editor: das Profil „Halle (sehr fern)“ ist wählbar, ein Hinweis nennt die Folgen; die Folienliste des Monitors bleibt
 * erhalten (ein Zurückstellen des Profils verliert nichts); gespeichert wird im selben Monitor-JSON (Feld `profile`, keine Migration).
 * Echte deutsche Texte (Profile „Spielfeld (fern)“ und „Halle (sehr fern)“).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonitorEditor } from '../MonitorEditor';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const hoisted = vi.hoisted(() => ({
  monitor: {
    id: 'monitor-1', name: 'Hallenmonitor Feld 1', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
    performanceMode: 'auto',
    slides: [
      { id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 },
      { id: 's2', type: 'next-matches', config: { matchCount: 3 }, duration: null, order: 1 },
      { id: 's3', type: 'standings', config: { groupId: 'A' }, duration: null, order: 2 },
    ],
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    profile: undefined as string | undefined,
  },
  saveMonitor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../hooks', () => ({
  useMonitors: () => ({
    getMonitorById: () => hoisted.monitor, saveMonitor: hoisted.saveMonitor, addSlide: vi.fn(), updateSlide: vi.fn(),
    removeSlide: vi.fn(), reorderSlides: vi.fn(), getDisplayUrl: () => '',
  }),
  useSponsors: () => ({ sponsors: [] }),
  useFields: () => ({ fields: [], getFieldDisplayName: (id: string) => id }),
}));

const turnier = { id: 't1', name: 'Hallencup Ost', teams: [], matches: [], groups: [], isPublic: false, monitors: [hoisted.monitor] } as unknown as Tournament;
const rendere = () => render(<MonitorEditor tournament={turnier} monitorId="monitor-1" onTournamentUpdate={vi.fn()} onClose={vi.fn()} />);
const auswahl = () => screen.getByTestId<HTMLSelectElement>('monitor-profile-select');

describe('@ZM-212 Monitor-Editor: Profil „Halle (sehr fern)“', () => {
  beforeEach(() => { vi.clearAllMocks(); hoisted.monitor.profile = undefined; });

  it('Ein Monitor ohne Profil steht auf „Spielfeld (fern)“, die Auswahl bietet „Halle (sehr fern)“ an; kein Hinweis', () => {
    rendere();
    expect(auswahl().value).toBe('');
    expect([...auswahl().options].map((o) => o.textContent)).toEqual(['Spielfeld (fern)', 'Halle (sehr fern)']);
    expect(screen.queryByTestId('monitor-profile-hint')).toBeNull();
  });

  it('Wählt Olli „Halle (sehr fern)“, steht ein Hinweis: nur die Live-Folie, die übrigen Folien (2) sind aus dieser Entfernung nicht lesbar', () => {
    rendere();
    fireEvent.change(auswahl(), { target: { value: 'hall-very-far' } });
    const hinweis = screen.getByTestId('monitor-profile-hint');
    expect(hinweis).toHaveTextContent('nur die Live-Folie');
    expect(hinweis).toHaveTextContent('nicht lesbar');
    expect(hinweis).toHaveTextContent('2 Folien der Liste werden nicht gezeigt');
  });

  it('Speichern legt das Profil im Monitor ab und behält alle drei Folien (nichts wird gelöscht)', () => {
    rendere();
    fireEvent.change(auswahl(), { target: { value: 'hall-very-far' } });
    expect(hoisted.saveMonitor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('monitor-editor-save'));
    const gespeichert = hoisted.saveMonitor.mock.calls[0][0] as { profile?: string; slides: { id: string }[] };
    expect(gespeichert.profile).toBe('hall-very-far');
    expect(gespeichert.slides.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('Zurückstellen auf „Spielfeld (fern)“ entfernt das Profil, die Folien bleiben', () => {
    hoisted.monitor.profile = 'hall-very-far';
    rendere();
    expect(auswahl().value).toBe('hall-very-far');
    fireEvent.change(auswahl(), { target: { value: '' } });
    expect(screen.queryByTestId('monitor-profile-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('monitor-editor-save'));
    const gespeichert = hoisted.saveMonitor.mock.calls[0][0] as { profile?: string; slides: unknown[] };
    expect(gespeichert.profile).toBeUndefined();
    expect(gespeichert.slides).toHaveLength(3);
  });

  it('Ohne Änderung wird nichts gespeichert (Profil unberührt)', () => {
    hoisted.monitor.profile = 'hall-very-far';
    rendere();
    fireEvent.click(screen.getByTestId('monitor-editor-save'));
    expect(hoisted.saveMonitor).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein unbekannter gespeicherter Wert (neuere Fassung) zeigt „Spielfeld (fern)“ ohne Hinweis und bricht nichts', () => {
    hoisted.monitor.profile = 'zukunft-profil';
    rendere();
    expect(auswahl().value).toBe('');
    expect(screen.queryByTestId('monitor-profile-hint')).toBeNull();
  });
});
