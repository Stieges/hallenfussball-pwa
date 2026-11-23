/**
 * @ZM-217 Bei einem Feld nennen Live-Folie ohne Spiel und Spielplan-Folie kein Feld.
 * Aus dem Gherkin: keine Überschrift „Feld 1“ über dem nächsten Spiel (Live-Folie ohne laufendes Spiel); folgt keines mehr, steht
 * „Heute folgt kein Spiel mehr“; die Folie „Spielplan eines Felds“ heißt „Spielplan“ statt „Spielplan Feld 1“.
 * Aber bei zwei Feldern bleiben „Feld 2“, „Auf Feld 2 folgt heute kein Spiel mehr“ und „Spielplan Feld 2“ wie bisher.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import type { Match, Tournament } from '../../../types/tournament';
import { buildTournament, FIXTURE_MATCHES, slide } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const performanceSettings = {} as PerformanceSettings;
const EIN_FELD: Partial<Tournament> = { numberOfFields: 1, fields: [{ id: 'field-1', defaultName: 'Feld 1' }] };
const alleAufFeld = (feld: number, status: Match['matchStatus']): Match[] => FIXTURE_MATCHES.map((m) => ({ ...m, field: feld, matchStatus: status }));

function liveFolie(tournament: Tournament, feld: number, hall = false) {
  return render(
    <LiveSlide slide={slide('live', { fieldId: `field-${feld}` })} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} profile={hall ? 'hall-very-far' : undefined} />,
  );
}
const listenFolie = (tournament: Tournament, feld: number) =>
  render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: `field-${feld}` })} {...withView(tournament)} theme="dark" style={{}} />);

describe('@ZM-217 Live-Folie ohne laufendes Spiel', () => {
  it('ein Feld, nichts folgt mehr (Folie ohne Profil): keine Überschrift „Feld 1“', () => {
    const { container } = liveFolie(buildTournament({ ...EIN_FELD, matches: alleAufFeld(1, 'finished') }), 1);
    expect(container.textContent ?? '').not.toContain('Feld 1');
    expect(screen.getByText('Kein Spiel geplant')).toBeInTheDocument();
  });

  it('ein Feld, nichts folgt mehr (Halle): „Heute folgt kein Spiel mehr“, ohne „Feld“', () => {
    liveFolie(buildTournament({ ...EIN_FELD, matches: alleAufFeld(1, 'finished') }), 1, true);
    expect(screen.getByTestId('hall-no-match')).toHaveTextContent(/^Heute folgt kein Spiel mehr$/);
  });

  it('Gegenbeispiel zwei Felder (Folie ohne Profil): die Überschrift „Feld 2“ bleibt', () => {
    liveFolie(buildTournament({ matches: alleAufFeld(2, 'finished') }), 2);
    expect(screen.getByText('Feld 2')).toBeInTheDocument();
  });

  it('Gegenbeispiel zwei Felder (Halle): „Auf Feld 2 folgt heute kein Spiel mehr“ wie bisher', () => {
    liveFolie(buildTournament({ matches: alleAufFeld(2, 'finished') }), 2, true);
    expect(screen.getByTestId('hall-no-match')).toHaveTextContent('Auf Feld 2 folgt heute kein Spiel mehr');
  });
});

describe('@ZM-217 Folie „Spielplan eines Felds“', () => {
  it('ein Feld: der Titel heißt „Spielplan“', () => {
    listenFolie(buildTournament({ ...EIN_FELD, matches: alleAufFeld(1, 'scheduled') }), 1);
    expect(screen.getByText('Spielplan', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/Spielplan Feld/)).toBeNull();
  });

  it('Gegenbeispiel zwei Felder: „Spielplan Feld 2“ wie bisher', () => {
    listenFolie(buildTournament(), 2);
    expect(screen.getByText('Spielplan Feld 2')).toBeInTheDocument();
  });
});
