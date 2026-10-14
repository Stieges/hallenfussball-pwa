/**
 * F-03 (B-03 Fixrunde 1): Die Zuschauer-QR-Folie zeigt die öffentliche Zuschauer-Adresse
 * (generateLiveUrl → /#/live/{code}), nie die Verwaltung (/#/tournament/{id}).
 * Ohne isPublic/Share-Code gibt es keinen QR.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string }) => (
    <div data-testid="qr-code" data-value={props.value} />
  ),
}));

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: vi.fn(), lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

// Nur unbekannte Folien → mit QR-Möglichkeit fällt selectDisplayableSlides auf die
// Zuschauer-QR-Folie zurück, ohne QR-Möglichkeit auf die Spielplan-Folie (F11).
function tournamentWith(overrides: Record<string, unknown>) {
  return {
    id: 'tour-1', title: 'Hallencup Ost', teams: [], matches: [],
    monitors: [{
      id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none',
      transitionDuration: 0, theme: 'dark', performanceMode: 'low',
      slides: [{ id: 's1', type: 'unknown-type', duration: 15, order: 0 }],
    }],
    ...overrides,
  };
}

describe('MonitorDisplayPage — Zuschauer-QR zeigt die Live-Adresse (F-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localGet.mockResolvedValue(null);
  });

  it('QR-Wert ist die öffentliche Zuschauer-Adresse /#/live/ABC123 und enthält nie /tournament/', async () => {
    supabaseGet.mockResolvedValue(tournamentWith({ isPublic: true, shareCode: 'ABC123' }));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('qr-code')).toBeInTheDocument());
    const value = screen.getByTestId('qr-code').getAttribute('data-value') ?? '';
    expect(value).toMatch(/\/#\/live\/ABC123$/);
    expect(value).not.toMatch(/\/tournament\//);
  });

  it('Ohne isPublic keinen QR – auch nicht mit Share-Code (F11: Spielplan-Folie)', async () => {
    supabaseGet.mockResolvedValue(tournamentWith({ isPublic: false, shareCode: 'ABC123' }));
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(container.textContent).toContain('Spielplan'));
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  it('Ohne Share-Code keinen QR – auch wenn öffentlich (F11: Spielplan-Folie)', async () => {
    supabaseGet.mockResolvedValue(tournamentWith({ isPublic: true }));
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(container.textContent).toContain('Spielplan'));
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });
});