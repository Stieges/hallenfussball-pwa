/**
 * B-03 (V3) — @OB-002-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { makeTournament, renderInRouter, oeffneAlleAbschnitte, expectAbsent, expectRendered, renderAdminSidebar } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// @OB-002 — Eine Funktion mit Anforderung erscheint erst, wenn sie wirkt (8 Beispielzeilen)
// ---------------------------------------------------------------------------

type FunktionFall = {
  kennung: string;
  zeile: string;
  funktion: string;
  ort: string;
  pruefen: () => Promise<void>;
};
const OB002: FunktionFall[] = [
  {
    kennung: '@OB-002',
    zeile: 'Cockpit/Halbzeit',
    funktion: 'der Knopf „Halbzeit“',
    ort: 'das Cockpit von Spiel 9',
    pruefen: async () => {
      const { GameControls } = await import('../components/live-cockpit/components/GameControls');
      // Ruling B-03 Fixrunde 1 (Platzhalter-Liste Nr. 3, @OB-002; B-08 baut Halbzeit):
      // der Knopf verschwindet bei JEDEM Status — der Zeile NOT_STARTED sind die Fälle
      // RUNNING und PAUSED hinzugefügt (sonst versteckt ein Status-Gate den Fehler).
      for (const status of ['NOT_STARTED', 'RUNNING', 'PAUSED'] as const) {
        const { container, unmount } = render(
          <GameControls
            status={status}
            onStart={vi.fn()}
            onPauseResume={vi.fn()}
            onEditTime={vi.fn()}
            onSwitchSides={vi.fn()}
            onFinish={vi.fn()}
          />
        );
        expectRendered(container);
        expectAbsent(/Halbzeit/);
        unmount();
      }
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'Cockpit/Spielzeit-anpassen',
    funktion: '„Spielzeit anpassen“',
    ort: 'das Cockpit von Spiel 9',
    pruefen: async () => {
      // F-06 (Fixrunde 1): geprüft wird am ECHTEN Ort — GameControls mit Status NOT_STARTED
      // (ohne „Zeit bearbeiten“) und das Antippen der Uhr in LiveCockpit (öffnet den
      // Zeit-Dialog bei einem neuen Spiel nicht). Vorher renderte der Fall das ungenutzte
      // OverflowMenu, das nirgends eingebunden ist.
      const { GameControls } = await import('../components/live-cockpit/components/GameControls');
      const controls = render(
        <GameControls
          status="NOT_STARTED"
          onStart={vi.fn()}
          onPauseResume={vi.fn()}
          onEditTime={vi.fn()}
          onSwitchSides={vi.fn()}
          onFinish={vi.fn()}
        />
      );
      expectRendered(controls.container);
      expect(screen.queryByRole('button', { name: 'Zeit bearbeiten' })).not.toBeInTheDocument();
      expectAbsent(/Zeit bearbeiten|Spielzeit anpassen|adjustTime/);
      controls.unmount();

      const { LiveCockpit } = await import('../components/live-cockpit/LiveCockpit');
      const match = {
        id: 'match-1', number: 9, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
        scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
        homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
        homeScore: 0, awayScore: 0, status: 'NOT_STARTED', elapsedSeconds: 0, playPhase: 'regular',
        events: [],
      };
      render(
        <LiveCockpit
          fieldName="Feld 1"
          tournamentName="Test-Turnier"
          tournamentId="t1"
          currentMatch={match as never}
          upcomingMatches={[]}
          onStart={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onFinish={vi.fn()}
          onGoal={vi.fn()}
          onUndoLastEvent={vi.fn()}
          onManualEditResult={vi.fn()}
          onAdjustTime={vi.fn()}
          onLoadNextMatch={vi.fn()}
          onReopenLastMatch={vi.fn()}
        />
      );
      fireEvent.click(screen.getByTestId('match-timer-display'));
      expect(screen.queryByRole('dialog', { name: 'cockpit:timeAdjust.title' })).not.toBeInTheDocument();
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'AdminMatchCockpit/Bildschirm-an-lassen',
    funktion: 'der Schalter „Bildschirm an lassen“',
    ort: 'das Admin Center, Match Cockpit',
    pruefen: async () => {
      const { MatchCockpitSettingsPanel } = await import('../components/match-settings/MatchCockpitSettingsPanel');
      const { container } = render(
        <MatchCockpitSettingsPanel
          settings={{} as ComponentProps<typeof MatchCockpitSettingsPanel>['settings']}
          onChange={vi.fn()}
          tournamentId="t1"
        />
      );
      expectRendered(container);
      expectAbsent(/keepScreenOn|Bildschirm/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'AnlegenSchritt2/Bildschirm-an-lassen',
    funktion: 'der Schalter „Bildschirm an lassen“',
    ort: 'den zweiten Schritt beim Anlegen',
    pruefen: async () => {
      const { MatchCockpitSettingsPanel } = await import('../components/match-settings/MatchCockpitSettingsPanel');
      const { container } = render(
        <MatchCockpitSettingsPanel
          settings={{} as ComponentProps<typeof MatchCockpitSettingsPanel>['settings']}
          onChange={vi.fn()}
          tournamentId="new"
        />
      );
      expectRendered(container);
      expectAbsent(/keepScreenOn|Bildschirm/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'Sichtbarkeit/QR-drucken-und-herunterladen',
    funktion: '„QR drucken“ und „QR herunterladen“',
    ort: 'das Admin Center, Sichtbarkeit',
    pruefen: async () => {
      const { VisibilityCategory } = await import('../features/tournament-admin/categories/Visibility');
      const { ToastProvider } = await import('../components/ui/Toast');
      const { container } = render(
        <ToastProvider>
          <VisibilityCategory
            tournamentId="t1"
            tournament={makeTournament({ isPublic: true, shareCode: 'ABC123' })}
            onTournamentUpdate={vi.fn()}
          />
        </ToastProvider>
      );
      expectRendered(container);
      oeffneAlleAbschnitte(container);
      expectAbsent(/visibility\.printQr/, /visibility\.downloadQr/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'AdminMenue/Team-und-Helfer',
    funktion: 'der Bereich „Team & Helfer“',
    ort: 'das Menü des Admin Centers',
    pruefen: async () => {
      const sidebar = await renderAdminSidebar();
      expectRendered(sidebar.container);
      expectAbsent(/Team & Helfer/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'TeamHelfer/Schiedsrichter-Zuweisung',
    funktion: 'die „Schiedsrichter-Zuweisung“',
    ort: 'das Admin Center, Team & Helfer',
    pruefen: async () => {
      const { TeamHelpersCategory } = await import('../features/tournament-admin/categories/TeamHelpers');
      const { container } = renderInRouter(
        <TeamHelpersCategory
          tournamentId="t1"
          tournament={makeTournament()}
          onTournamentUpdate={vi.fn()}
        />
      );
      expectRendered(container);
      expectAbsent(/referee|Schiedsrichter/i);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'Fuss/Cookie-Einstellungen',
    funktion: 'der Link „Cookie-Einstellungen“',
    ort: 'den Fuß der Startseite',
    pruefen: async () => {
      const { Footer } = await import('../components/layout/Footer');
      const { container } = renderInRouter(<Footer />);
      expectRendered(container);
      expectAbsent(/[Cc]ookie/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'Datenschutz/Cookie-Einstellungen',
    funktion: 'der Link „Cookie-Einstellungen“',
    ort: 'der Datenschutzerklärung',
    pruefen: async () => {
      const { DatenschutzScreen } = await import('../screens/DatenschutzScreen');
      const { container } = renderInRouter(
        <DatenschutzScreen onBack={vi.fn()} onOpenCookieSettings={vi.fn()} />
      );
      expectRendered(container);
      oeffneAlleAbschnitte(container);
      expectAbsent(/im Footer/);
      for (const bedienelement of container.querySelectorAll('button, a')) {
        expect(bedienelement.textContent ?? '').not.toMatch(/Cookie-Einstellungen/);
      }
    },
  },
];
describe('@OB-002 Eine Funktion mit Anforderung erscheint erst, wenn sie wirkt', () => {
  it.each(OB002)('$kennung $zeile: $funktion wird an $ort nicht angeboten', async ({ pruefen }) => {
    await pruefen();
  }, 30_000);
});
