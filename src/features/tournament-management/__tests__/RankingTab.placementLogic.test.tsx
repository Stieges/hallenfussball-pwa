/**
 * Regressionstest: leere Platzierungskriterien in der Gesamtplatzierung
 * (Abschluss-Review feat/terminologie-zentral, Befund 1).
 *
 * Spiegelt TabellenTab.placementLogic.test.tsx — RankingTab rendert dieselbe
 * Zeile unabhängig und kann unabhängig kaputtgehen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankingTab } from '../RankingTab';
import {
  buildTestTournament,
  buildScheduleAndStandings,
  createRealI18nWrapper,
} from './placementLogicTestHelpers';

// Siehe placementLogicTestHelpers.tsx: echte i18next-Instanz statt des
// globalen Passthrough-Mocks, der `defaultValue` ignoriert.
vi.unmock('i18next');
vi.unmock('react-i18next');

async function renderRankingTab(placementLogic: Parameters<typeof buildTestTournament>[0]) {
  const tournament = buildTestTournament(placementLogic);
  const { schedule, standings } = buildScheduleAndStandings(tournament);
  const Wrapper = await createRealI18nWrapper();

  render(
    <Wrapper>
      <RankingTab tournament={tournament} schedule={schedule} currentStandings={standings} />
    </Wrapper>
  );
}

describe('RankingTab: Platzierungskriterien-Beschriftung', () => {
  it('löst ein Kriterium ohne `label` über wizard.json auf (neues/importiertes Turnier)', async () => {
    await renderRankingTab([{ id: 'goalDifference', enabled: true }]);

    // wizard.json: placementLogic.criteria.goalDifference = "Tordifferenz"
    expect(screen.getByText('1. Tordifferenz', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText(/^1\.\s*$/, { selector: 'strong' })).not.toBeInTheDocument();
    expect(screen.queryByText(/goalDifference/)).not.toBeInTheDocument();
  });

  it('fällt für ein Kriterium mit gespeichertem `label` ohne passenden Schlüssel auf das Label zurück (Altdaten/Import)', async () => {
    await renderRankingTab([
      { id: 'legacyCriterionOhneSchluessel', label: 'Alte Bezeichnung', enabled: true },
    ]);

    expect(screen.getByText('1. Alte Bezeichnung', { selector: 'strong' })).toBeInTheDocument();
  });
});
