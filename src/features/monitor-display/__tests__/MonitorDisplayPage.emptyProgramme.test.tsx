/**
 * F-04 (B-03 Fixrunde 1): Ein leeres Folienprogramm bleibt nie leer.
 * - Mit QR-Möglichkeit: Zuschauer-QR-Folie.
 * - Ohne QR-Möglichkeit: nächste immer darstellbare Folie (Spielplan).
 * Gegenbeispiel: der alte Zustand „Keine Slides konfiguriert" darf nie erscheinen.
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
import { selectDisplayableSlides, ZUSCHAUER_QR_SLIDE, SPIELPLAN_FALLBACK_SLIDE } from '../slideProgramme';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

function tournamentWithEmptyProgramme(overrides: Record<string, unknown>) {
  return {
    id: 'tour-1', title: 'Hallencup Ost', teams: [], matches: [],
    monitors: [{
      id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none',
      transitionDuration: 0, theme: 'dark', performanceMode: 'low', slides: [],
    }],
    ...overrides,
  };
}

describe('MonitorDisplayPage — leeres Folienprogramm bleibt nie leer (F-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localGet.mockResolvedValue(null);
  });

  it('Leeres Programm mit QR-Möglichkeit zeigt die Zuschauer-QR-Folie', async () => {
    supabaseGet.mockResolvedValue(tournamentWithEmptyProgramme({ isPublic: true, shareCode: 'ABC123' }));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('qr-code')).toBeInTheDocument());
    expect(screen.queryByTestId('monitor-no-slides-state')).not.toBeInTheDocument();
  });

  it('Leeres Programm ohne QR-Möglichkeit zeigt die nächste immer darstellbare Folie (Spielplan)', async () => {
    supabaseGet.mockResolvedValue(tournamentWithEmptyProgramme({ isPublic: false }));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Spielplan/)).toBeInTheDocument());
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: „Keine Slides konfiguriert" erscheint bei leerem Programm nie', async () => {
    supabaseGet.mockResolvedValue(tournamentWithEmptyProgramme({ isPublic: true, shareCode: 'ABC123' }));
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(container.textContent).toContain('Hallencup Ost'));
    expect(container.textContent).not.toMatch(/Keine Slides konfiguriert/);
    expect(screen.queryByTestId('monitor-no-slides-message')).not.toBeInTheDocument();
  });
});

describe('selectDisplayableSlides — F-04 Rückfallkette', () => {
  it('Leeres Programm → Zuschauer-QR-Folie', () => {
    expect(selectDisplayableSlides([])).toEqual([ZUSCHAUER_QR_SLIDE]);
  });

  it('Ohne QR-Möglichkeit → Spielplan-Folie', () => {
    expect(selectDisplayableSlides([], { qrMoeglich: false })).toEqual([SPIELPLAN_FALLBACK_SLIDE]);
  });

  it('Nicht leeres Programm ohne darstellbare Folien: ohne QR-Möglichkeit Spielplan-Rückfall (F11)', () => {
    expect(selectDisplayableSlides([{ id: 'a', type: 'unknown' }], { qrMoeglich: false }))
      .toEqual([SPIELPLAN_FALLBACK_SLIDE]);
  });

  it('Nicht leeres Programm ohne darstellbare Folien mit QR-Möglichkeit bleibt bei der QR-Folie', () => {
    expect(selectDisplayableSlides([{ id: 'a', type: 'unknown' }]))
      .toEqual([ZUSCHAUER_QR_SLIDE]);
  });
});