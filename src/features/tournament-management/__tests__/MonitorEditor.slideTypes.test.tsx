/** MonitorEditor: angebotene Folien (@OB-002), ohne „Wenn kein Spiel läuft“ (@OB-001), Vorbelegung 3 (R-f5). */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorEditor } from '../MonitorEditor';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide } from '../../../types/monitor';

const hoisted = vi.hoisted(() => ({
  monitor: {
    id: 'monitor-1',
    name: 'Haupthalle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    slides: [] as MonitorSlide[],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  addSlide: vi.fn(),
}));

vi.mock('../../../hooks', () => ({
  useMonitors: () => ({
    getMonitorById: () => hoisted.monitor,
    updateMonitor: vi.fn(),
    addSlide: hoisted.addSlide,
    updateSlide: vi.fn(),
    removeSlide: vi.fn(),
    reorderSlides: vi.fn(),
    getDisplayUrl: () => '',
  }),
  useSponsors: () => ({ sponsors: [] }),
  useFields: () => ({ fields: [{ id: 'f1', name: 'Feld 1' }], getFieldDisplayName: (id: string) => id }),
}));

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return { id: 't1', name: 'Hallencup Ost', teams: [], matches: [], groups: [], numberOfGroups: 2,
    groupSystem: 'groups', isPublic: false, monitors: [hoisted.monitor], ...overrides } as unknown as Tournament;
}

function renderEditor(t: Tournament) {
  return render(<MonitorEditor tournament={t} monitorId="monitor-1" onTournamentUpdate={vi.fn()} onClose={vi.fn()} />);
}

async function openAddMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /addSlide/ }));
}

describe('MonitorEditor – angebotene Folien-Typen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.monitor.slides = [];
    // Neue Folie ohne Config (wie ein Monitor ohne matchCount) – prüft die Vorbelegung im Editor
    hoisted.addSlide.mockImplementation(async (_monitorId: string, type: MonitorSlide['type']) => {
      const slide: MonitorSlide = { id: `s-${hoisted.monitor.slides.length}`, type, config: {}, duration: 15, order: hoisted.monitor.slides.length };
      hoisted.monitor.slides.push(slide);
      return slide;
    });
  });

  it('bietet genau die Folien an, die der Monitor zeigt (@OB-002)', async () => {
    const user = userEvent.setup();
    renderEditor(tournament());
    await openAddMenu(user);

    for (const label of [/Live-Spiel/, /Tabelle$/, /Spielplan \(Feld\)/, /Sponsor/, /Eigener Text/, /Zuschauer-QR/, /Alle Tabellen/, /Nächste Spiele/]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    // Gegenbeispiele: kein Renderer im Monitor → verborgen
    expect(screen.queryByRole('button', { name: /Torschützen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Spielplan \(Gruppe\)/ })).toBeNull();
  });

  it('zeigt bei nicht öffentlichem Turnier den Hinweis am Eintrag Zuschauer-QR', async () => {
    const user = userEvent.setup();
    renderEditor(tournament({ isPublic: false }));
    await openAddMenu(user);
    expect(screen.getByRole('button', { name: /Zuschauer-QR/ })).toHaveTextContent(/qrHidden/);
  });

  it('zeigt bei öffentlichem Turnier mit Share-Code keinen Hinweis', async () => {
    const user = userEvent.setup();
    renderEditor(tournament({ isPublic: true, shareCode: 'ABC123' }));
    await openAddMenu(user);
    expect(screen.getByRole('button', { name: /Zuschauer-QR/ })).not.toHaveTextContent(/qrHidden/);
  });

  it('Nächste Spiele neu angelegt: Anzahl ist 3 (R-f5)', async () => {
    const user = userEvent.setup();
    const { container } = renderEditor(tournament());
    await openAddMenu(user);
    await user.click(screen.getByRole('button', { name: /Nächste Spiele/ }));

    const select = container.querySelector<HTMLSelectElement>('select[id$="-matchCount"]');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('3');
  });

  it('Live-Folie bearbeiten: keine Auswahl „Wenn kein Spiel läuft“, „Anhalten“ bleibt (@OB-001, @ZM-074)', async () => {
    const user = userEvent.setup();
    hoisted.monitor.slides = [{ id: 's-live', type: 'live', config: { fieldId: 'f1' }, duration: null, order: 0 }];
    const { container } = renderEditor(tournament());
    await user.click(screen.getByTitle(/slides\.edit$/));
    expect(container.querySelector('select[id$="-whenIdle"]')).toBeNull();
    expect(screen.queryByText(/whenIdleLabel/)).toBeNull();
    expect(screen.getByText(/pauseRotation/)).toBeInTheDocument();
  });
});
