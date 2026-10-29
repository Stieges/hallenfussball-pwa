/**
 * @ME-071 Verwaltungsbildschirm → Monitor-Editor: ein Speicherfehler des Turniers erreicht den Editor
 * („Fehler beim Speichern“, kein „Gespeichert“, Dialog und Eingabe bleiben). Bildschirm-Hülle wie Abschluss.sperre.verwaltung.test.tsx,
 * aber mit dem echten Editor und einem Turnier-Speichern, das sich wie die App verhält: `handleTournamentUpdate` schluckt den Fehler,
 * `saveTournamentOrThrow` reicht ihn weiter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CockpitFrameProvider } from '../../components/live-cockpit/frame/CockpitFrameContext';
import { useAnnounceCockpitFrame } from '../../components/live-cockpit/frame/cockpitFrame';
import { TournamentManagementScreen } from '../TournamentManagementScreen';
import userEvent from '@testing-library/user-event';

const mobil = vi.hoisted(() => ({ wert: false }));
const verwaltung = vi.hoisted(() => ({
  tournament: { id: 't-1', title: 'Hallencup Süd', ageClass: '', date: '2026-11-28', numberOfFields: 1, teams: [], matches: [], sponsors: [],
    monitors: [{ id: 'feld-1', name: 'Halle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark', performanceMode: 'auto', slides: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }] },
  speichernWirft: vi.fn(),
  speichernSchluckt: vi.fn(),
  erfolg: vi.fn(),
  schedule: { allMatches: [], phases: [], teams: [] },
}));
// GA4 A-13c: Spielplan und Tabellen liegen unter den Anbietern für „Gruppe abschließen“ (Rechte, Repositories); hier nur die Hülle des Bildschirms
// A-15b: der Auslöser „erneut abschließen“ braucht Rechte (AuthProvider) und ist hier nicht Gegenstand
vi.mock('../../hooks/useAutoRecompletion', () => ({ useAutoRecompletion: () => undefined }));
vi.mock('../../features/tournament-management/standings/StandingTieProvider', () => ({ StandingTieProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../features/tournament-management/group-completion/GroupCompletionProvider', () => ({ GroupCompletionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mobil.wert }));
vi.mock('../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: verwaltung.tournament,
    schedule: verwaltung.schedule,
    currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: verwaltung.speichernSchluckt, saveTournamentOrThrow: verwaltung.speichernWirft, applyRemote: vi.fn(), scheduleService: {},
  }),
}));
vi.mock('../../features/tournament-management/ManagementTab', () => {
  function Stub() {
    useAnnounceCockpitFrame(true);
    return <div data-testid="live-stub" />;
  }
  return { ManagementTab: Stub };
});
vi.mock('../../features/tournament-management/MonitorsConfigTab', () => ({
  MonitorsConfigTab: (props: { onEditMonitor?: (id: string) => void }) => (
    <button type="button" onClick={() => props.onEditMonitor?.('feld-1')}>monitor-bearbeiten</button>
  ),
}));
vi.mock('../../features/tournament-management/ScheduleTab', () => ({ ScheduleTab: () => <div data-testid="schedule-stub" /> }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => <div data-testid="auth-stub" /> }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../features/klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null })); // B-50: braucht AuthProvider, hier nicht Gegenstand
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ showError: vi.fn() }), useOptionalToast: () => ({ showSuccess: verwaltung.erfolg }) }));

function zeige(pfad: string) {
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <CockpitFrameProvider>
        <TournamentManagementScreen tournamentId="t-1" onBack={vi.fn()} onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
      </CockpitFrameProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  verwaltung.speichernSchluckt.mockResolvedValue(undefined);
});

async function editorOeffnenUndAendern() {
  const user = userEvent.setup();
  zeige('/tournament/t-1/monitors');
  await user.click(await screen.findByText('monitor-bearbeiten'));
  await user.selectOptions(await screen.findByTestId('monitor-duration-select'), '30');
  return user;
}

describe('@ME-071 Speicherfehler erreicht den Monitor-Editor', () => {
  it('Speichern scheitert: „Fehler beim Speichern“, kein „Gespeichert“, Dialog offen, Folienzeit 30 bleibt', async () => {
    verwaltung.speichernWirft.mockRejectedValue(new Error('Server weg'));
    const user = await editorOeffnenUndAendern();
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(await screen.findByText('tournament:monitorEditor.errors.saveFailed')).toBeInTheDocument();
    expect(verwaltung.erfolg).not.toHaveBeenCalled();
    expect(screen.getByTestId('monitor-editor-save')).toBeInTheDocument();
    expect(screen.getByTestId<HTMLSelectElement>('monitor-duration-select').value).toBe('30');
  });

  it('Gegenbeispiel: gelingt das Speichern, kommt „Gespeichert“ und der Dialog schließt', async () => {
    verwaltung.speichernWirft.mockResolvedValue(undefined);
    const user = await editorOeffnenUndAendern();
    await user.click(screen.getByTestId('monitor-editor-save'));
    await waitFor(() => expect(verwaltung.erfolg).toHaveBeenCalledWith('tournament:monitorEditor.saved'));
    expect(screen.queryByTestId('monitor-editor-save')).toBeNull();
    expect(verwaltung.speichernSchluckt).not.toHaveBeenCalled();
  });
});
