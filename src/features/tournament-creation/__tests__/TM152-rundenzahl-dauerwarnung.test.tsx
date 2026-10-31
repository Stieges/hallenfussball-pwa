/**
 * @TM-152 / Review #423 G3: Stunden-Warnung (`ValidationWarnings`) und Smart-Konfiguration zählen die Runden mit –
 * sonst widersprechen sie der Spielzahl und der Dauer-Schätzung im selben Schritt.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationWarnings } from '../components/ValidationWarnings';
import { countTournamentMatches } from '../utils/smartConfigCalculator';
import type { Tournament } from '../../../types/tournament';
import { i18nWrapper } from '../../tournament-management/standings/__tests__/tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

const formData = (numberOfRounds: number, groupSystem: Tournament['groupSystem'] = 'roundRobin'): Partial<Tournament> => ({
  groupSystem, numberOfTeams: 6, numberOfFields: 1, numberOfGroups: 2,
  groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, numberOfRounds,
});

describe('@TM-152 Dauer-Warnung und Smart-Konfiguration mit Rundenzahl', () => {
  it('@TM-152 6 Teams, 10 Runden (150 Spiele, 30 h): die Warnung meldet die unrealistische Dauer', async () => {
    const Wrapper = await i18nWrapper('de');
    render(<Wrapper><ValidationWarnings formData={formData(10)} /></Wrapper>);

    // Meldung über die globale i18n-Instanz (in der Testumgebung Englisch) – geprüft wird die Stundenzahl
    expect(screen.getByText(/(Dauer von|duration of) 30h/)).toBeInTheDocument();
  });

  it('@TM-152 Gegenbeispiel: 6 Teams, 1 Runde (15 Spiele, 3 h): keine Dauer-Warnung', async () => {
    const Wrapper = await i18nWrapper('de');
    render(<Wrapper><ValidationWarnings formData={formData(1)} /></Wrapper>);

    expect(screen.queryByText(/unrealisti|Lange Turnierdauer|Long tournament/)).toBeNull();
  });

  it('@TM-152 Gegenbeispiel: bei „Gruppen + Finalrunde“ zählt eine gespeicherte Rundenzahl nicht', async () => {
    const Wrapper = await i18nWrapper('de');
    render(<Wrapper><ValidationWarnings formData={formData(10, 'groupsAndFinals')} /></Wrapper>);

    expect(screen.queryByText(/unrealisti|Lange Turnierdauer|Long tournament/)).toBeNull();
  });

  it('@TM-152 Smart-Konfiguration rechnet je Runde alle Paarungen: 6 Teams, 3 Runden = 45 Spiele', () => {
    expect(countTournamentMatches(6, { rounds: 3 })).toBe(45);
    expect(countTournamentMatches(6)).toBe(15);
  });
});
