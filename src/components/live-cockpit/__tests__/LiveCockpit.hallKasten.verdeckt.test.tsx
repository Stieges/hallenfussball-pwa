/**
 * @HT-059 (Fixrunde 1, R1): der Kasten „Hallen-Lautsprecher aus“ im ECHTEN `LiveCockpit` meldet sich nur, solange er im Bild steht. Öffnet Olli am Handy
 * die Leibchen-Wahl, blendet die Hülle den Bereich mit Tafel und Hinweisen aus (`display: none`; jsdom kennt kein CSS, darum zählt hier die Bedingung):
 * der Kasten bleibt im Baum, meldet sich aber ab – der Kopf zeigt dann die Pille. Auf dem Laptop gibt es die Wahl-Fläche nicht, der Kasten bleibt gemeldet.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';
import { useKitChoiceOverlay } from '../../../hooks/useKitChoices';
import { kitChoiceQueueFor } from '../../../features/match-engine/kitChoiceRegistry';
import { teamSlot } from '../../../core/models/matchSlot';
import { useCockpitKaesten } from '../../../features/hallenton/ui/CockpitKastenOrt';
import type { Team, Tournament } from '../../../types/tournament';
import type { LiveCockpitProps } from '../types';
import type { HallStatus } from '../../../features/hallenton/useHallStatus';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
const hall = vi.hoisted(() => ({ status: null as unknown as HallStatus }));
vi.mock('../../../features/hallenton/useHallStatus', () => ({ useHallStatus: () => hall.status }));
vi.mock('../../../features/hallenton/useHallLautsprecher', () => ({
  useHallLautsprecher: () => ({ rolle: 'keiner', felder: [], name: null, laufzeit: null, tonAktivieren: vi.fn(), abgeloest: null }),
}));
vi.mock('../../../features/hallenton/useUhrAbgeglichen', () => ({ useUhrAbgeglichen: () => true }));
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const BLAU = '#1565C0';
const WAGING = '00000000-0000-4000-8000-0000000000a1';
const PETTING = '00000000-0000-4000-8000-0000000000a2';
const team = (id: string, name: string): Team => ({ id, name, colors: { primary: BLAU } });
const basis = { id: 'tour-1', teams: [team(WAGING, 'TSV Waging 1'), team(PETTING, 'TSV Petting')], matches: [{ id: 'spiel-2', round: 1, field: 1, matchNumber: 2, slotA: teamSlot(WAGING), slotB: teamSlot(PETTING), matchStatus: 'scheduled', scheduledTime: new Date(2026, 10, 28, 10, 20) }] } as unknown as Tournament;
const live = () => makeLiveMatch({ id: 'spiel-2', number: 2, status: 'NOT_STARTED', elapsedSeconds: 0, homeTeam: { id: WAGING, name: 'TSV Waging 1' }, awayTeam: { id: PETTING, name: 'TSV Petting' } });

function Rahmen({ props }: { props: LiveCockpitProps }) {
  const gezeigt = useKitChoiceOverlay(basis);
  return <LiveCockpit {...props} leibchenTurnier={gezeigt === null ? undefined : { tournament: gezeigt, epoche: 3 }} />;
}
/** Was der Kopf aus dem Speicher liest (als Text), wie `HallStatusZeile` im Cockpit. */
function Leser() {
  return <span data-testid="gemeldet">{[...useCockpitKaesten('tour-1').felder].join(',')}</span>;
}
const breite = (w: number): void => { window.innerWidth = w; window.dispatchEvent(new Event('resize')); };

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  kitChoiceQueueFor('guest').reset();
  hall.status = { stand: 'aktuell', antwort: null, felder: { 1: { art: 'nichtBereit', grund: 'background', pruefen: false } }, lautsprecherBekannt: true, letzteSprecher: [], testtonAnfordern: vi.fn(), gehoert: vi.fn() };
});

describe('@HT-059 R1 Leibchen-Wahl verdeckt den Kasten (echtes LiveCockpit)', () => {
  it('Handy: Kasten im Bild → gemeldet; offene Wahl (verdeckt) → nicht gemeldet, der Kopf zeigt die Pille; Kasten bleibt im Baum', async () => {
    breite(360);
    const user = userEvent.setup();
    render(<><Leser /><Rahmen props={makeProps(live())} /></>);
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
    expect(screen.getByTestId('gemeldet')).toHaveTextContent('1');
    await user.click(screen.getByTestId('leibchen-vorschlag'));
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-leibchen-offen', 'true');
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
    expect(screen.getByTestId('gemeldet')).toBeEmptyDOMElement();
    breite(1024);
  });
  it('Laptop: es gibt die Wahl-Fläche nicht, der Kasten bleibt gemeldet', async () => {
    breite(1280);
    const user = userEvent.setup();
    render(<><Leser /><Rahmen props={makeProps(live())} /></>);
    const vorschlag = screen.queryByTestId('leibchen-vorschlag');
    if (vorschlag) { await user.click(vorschlag); }
    expect(screen.getByTestId('live-cockpit')).not.toHaveAttribute('data-leibchen-offen');
    expect(screen.getByTestId('gemeldet')).toHaveTextContent('1');
    breite(1024);
  });
});
