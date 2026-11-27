/**
 * @ZM-220 Im Profil „Halle (sehr fern)“ steht während des Spiels kein Abzeichen „Live“.
 * Aus dem Gherkin: Beispiele (Lage → Abzeichen) und Gegenbeispiel „Spielfeld (fern)“ zeigt „Live“ wie bisher.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { MonitorProfile, PerformanceSettings } from '../../../types/monitor';
import type { Match } from '../../../types/tournament';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';
import { buildTournament, slide, withMatch } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const performanceSettings = {} as PerformanceSettings;
const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const LAEUFT = { status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, sectionStartMs: 0, elapsedMs: 250_000, anchorAt: T0 };
const ANGEHALTEN = { ...LAEUFT, status: 'paused', anchorAt: null };
const HALBZEIT = { status: 'section_break', phase: 'regular', section: 1, sections: 2, sectionSeconds: 300, sectionStartMs: 0, elapsedMs: 300_000, anchorAt: null, breakStartedAt: T0 - 20_000, breakSeconds: 60 };
const VERLAENGERUNG = { ...LAEUFT, phase: 'overtime', section: 3, sections: 2, overtimeSeconds: 300, sectionSeconds: 300, elapsedMs: 60_000 };
const STRAFSTOSS = { ...LAEUFT, status: 'shootout', phase: 'shootout', anchorAt: null };

function zeige(patch: Partial<Match>, profil: MonitorProfile | undefined, feld = 'field-1', pinned?: string) {
  const tournament = buildTournament({ matches: withMatch('match-7', patch), numberOfGroups: 2, groupSystem: 'groupsAndFinals' });
  return render(
    <NowSourceContext.Provider value={() => T0}>
      <LiveSlide slide={slide('live', { fieldId: feld })} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} pinnedMatchId={pinned} profile={profil} />
    </NowSourceContext.Provider>,
  );
}

describe('@ZM-220 Profil „Halle (sehr fern)“: kein Abzeichen „Live“ während des Spiels', () => {
  it.each([
    ['Spiel läuft, Restzeit 5:50', { scoreA: 1, scoreB: 0, liveState: LAEUFT }],
    ['Uhr angehalten', { scoreA: 1, scoreB: 0, liveState: ANGEHALTEN, matchStatus: 'paused' as const }],
    ['Halbzeitpause', { scoreA: 1, scoreB: 0, liveState: HALBZEIT }],
    ['Verlängerung', { scoreA: 1, scoreB: 1, liveState: VERLAENGERUNG }],
  ])('%s → kein Abzeichen', (_lage, patch) => {
    zeige(patch, 'hall-very-far');
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByTestId('match-status-badge')).toBeNull();
  });

  it('noch nicht angepfiffen, Anstoß 14:20 → „Nächstes Spiel“', () => {
    zeige({}, 'hall-very-far', 'field-2');
    expect(within(screen.getByTestId('hall-side-left')).getByText('Nächstes Spiel')).toBeInTheDocument();
  });

  it('Strafstoßschießen → „Strafstoßschießen“', () => {
    zeige({ scoreA: 1, scoreB: 1, matchStatus: 'running', liveState: STRAFSTOSS }, 'hall-very-far');
    expect(screen.getByTestId('hall-slot-badge')).toHaveTextContent('Strafstoßschießen');
  });

  it('abgepfiffen → „Endstand“', () => {
    zeige({ matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', liveState: undefined }, 'hall-very-far', 'field-1', 'match-7');
    expect(screen.getByTestId('hall-endstand')).toHaveTextContent('Endstand');
  });

  it.each([
    ['Spiel läuft', { scoreA: 1, scoreB: 0, liveState: LAEUFT }],
    ['Uhr angehalten', { scoreA: 1, scoreB: 0, liveState: ANGEHALTEN, matchStatus: 'paused' as const }],
    ['Halbzeitpause', { scoreA: 1, scoreB: 0, liveState: HALBZEIT }],
    ['Verlängerung', { scoreA: 1, scoreB: 1, liveState: VERLAENGERUNG }],
  ])('Gegenbeispiel: Profil „Spielfeld (fern)“ (Standard) zeigt in der Lage „%s“ weiter „Live“', (_lage, patch) => {
    zeige(patch, undefined);
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Live');
  });
});
