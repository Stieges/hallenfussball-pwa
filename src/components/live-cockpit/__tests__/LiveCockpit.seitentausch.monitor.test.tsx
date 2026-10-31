/**
 * Gegenprobe H6 (Plan Cockpit v2 A2/M3, @SL-065): „Seiten tauschen“ ändert nur die Anzeige des Cockpits – der Hallenmonitor bleibt Heim links,
 * in denselben Farben (er liest dieselben Kästen `MatchView.boxes` und kennt keine Anzeigeseite).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';
import type { CockpitKasten } from '../typesFarben';
import { LiveMatchDisplay } from '../../monitor/LiveMatchDisplay';
import type { LiveMatch as MonitorMatch } from '../../../hooks/useLiveMatches';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const LILA = '#6A1B9A';
const GRUEN = '#2E7D32';
const kasten: CockpitKasten = { home: { fill: { kind: 'solid', color: LILA }, bib: false }, away: { fill: { kind: 'solid', color: GRUEN }, bib: false } };
const monitorSpiel = {
  id: 'match-11', number: 11, homeTeam: { id: 'petting', name: 'TSV Petting' }, awayTeam: { id: 'otting', name: 'DJK Otting' },
  homeScore: 2, awayScore: 0, status: 'RUNNING', elapsedSeconds: 100, durationSeconds: 600, field: 1,
} as unknown as MonitorMatch;

describe('H6 Seitentausch im Cockpit, Monitor bleibt Heim links', () => {
  it('im Cockpit steht Petting nach dem Tausch rechts (Lila), der Monitor mit denselben Kästen zeigt Petting weiter links in Lila', async () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch({ homeTeam: { id: 'petting', name: 'TSV Petting' }, awayTeam: { id: 'otting', name: 'DJK Otting' } }), { kasten })} />);
    await userEvent.click(screen.getByTestId('cockpit-more-button'));
    await userEvent.click(await screen.findByTestId('mehr-seiten-tauschen'));
    expect(screen.getByTestId('scoreboard-box-rechts')).toHaveAttribute('data-color', LILA);
    expect(screen.getByTestId('scoreboard-name-rechts')).toHaveTextContent('TSV Petting');

    const { container } = render(<LiveMatchDisplay match={monitorSpiel} boxes={kasten} />);
    const heim = container.querySelector('[data-testid="live-block-home"]');
    const gast = container.querySelector('[data-testid="live-block-away"]');
    expect(heim && gast).toBeTruthy();
    expect(heim!.compareDocumentPosition(gast!) & Node.DOCUMENT_POSITION_FOLLOWING, 'Heim steht links (vor Gast)').toBeTruthy();
    expect(heim!.querySelector('[data-testid="live-box-home"]')).toHaveStyle({ backgroundColor: LILA });
    expect(container.querySelector('[data-testid="live-name-home"]')).toHaveTextContent('TSV Petting');
    expect(kasten.home.fill).toEqual({ kind: 'solid', color: LILA }); // das Cockpit hat die Kästen nicht verändert
  });
});

describe('@SL-190 Ein Seitentausch gilt nur für das Spiel, in dem Tom getauscht hat', () => {
  it('Spiel 11 getauscht (SV Süd links), danach Spiel 12 „TSV Ost – DJK West“: TSV Ost links, die Karten-Taste links gilt für TSV Ost', async () => {
    const spiel11 = makeLiveMatch();
    const spiel12 = makeLiveMatch({ id: 'match-12', number: 12, homeTeam: { id: 'tsv-ost', name: 'TSV Ost' }, awayTeam: { id: 'djk-west', name: 'DJK West' } });
    const { rerender } = render(<LiveCockpit {...makeProps(spiel11)} />);
    await userEvent.click(screen.getByTestId('cockpit-more-button'));
    await userEvent.click(await screen.findByTestId('mehr-seiten-tauschen'));
    expect(screen.getByTestId('scoreboard-name-links')).toHaveTextContent('SV Süd');

    rerender(<LiveCockpit {...makeProps(spiel12)} />);
    expect(screen.getByTestId('scoreboard-name-links')).toHaveTextContent('TSV Ost');
    expect(screen.getByTestId('scoreboard-name-rechts')).toHaveTextContent('DJK West');
    const linksTaste = screen.getByTestId('card-button-home');
    const rechtsTaste = screen.getByTestId('card-button-away');
    expect(linksTaste.compareDocumentPosition(rechtsTaste) & Node.DOCUMENT_POSITION_FOLLOWING, 'Heim-Taste steht links').toBeTruthy();
    await userEvent.click(linksTaste);
    expect(await screen.findByTestId('card-kind-step')).toHaveAccessibleName(/TSV Ost/);
  });
});

