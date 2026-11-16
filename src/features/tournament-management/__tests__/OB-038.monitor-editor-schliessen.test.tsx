/**
 * @OB-038 Taste zum Schließen: auch im Monitor-Editor (Dialog und „nicht gefunden“) dasselbe gezeichnete Kreuz mit Namen für Vorlesehilfen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MonitorEditor } from '../MonitorEditor';
import { Icons } from '../../../components/ui/Icons';
import type { Tournament } from '../../../types/tournament';

const monitor = {
  id: 'monitor-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
  performanceMode: 'auto', slides: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

vi.mock('../../../hooks', () => ({
  useMonitors: () => ({
    getMonitorById: () => monitor, saveMonitor: vi.fn(), addSlide: vi.fn(), updateSlide: vi.fn(),
    removeSlide: vi.fn(), reorderSlides: vi.fn(), getDisplayUrl: () => '',
  }),
  useSponsors: () => ({ sponsors: [] }),
  useFields: () => ({ fields: [], getFieldDisplayName: (id: string) => id }),
}));

const turnier = { id: 't1', name: 'Hallencup Ost', teams: [], matches: [], groups: [], isPublic: false, monitors: [monitor] } as unknown as Tournament;
const kreuz = renderToStaticMarkup(<Icons.X size={20} />).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

describe('@OB-038 Schließen-Taste im Monitor-Editor', () => {
  it.each([['Editor-Dialog', 'monitor-1'], ['Monitor nicht gefunden', 'gibt-es-nicht']] as const)('%s: gezeichnetes Kreuz, Name, kein Textzeichen', (_n, id) => {
    render(<MonitorEditor tournament={turnier} monitorId={id} onTournamentUpdate={vi.fn()} onClose={vi.fn()} />);
    const taste = screen.getByRole('button', { name: /monitorEditor.close/ });
    expect(taste.querySelector('svg')!.innerHTML).toBe(kreuz);
    expect(taste.textContent).toBe('');
  });
});
