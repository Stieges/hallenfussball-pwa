/**
 * B-03 (V3) — @OB-001-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentProps } from 'react';
import { SRC_ROOT, makeTournament, renderInRouter, oeffneAlleAbschnitte, expectAbsent, expectRendered, renderSettingsScreen, renderAdminSidebar } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// @OB-001 — Ein Platzhalter ohne Anforderung ist nicht zu sehen (10 Beispielzeilen)
// ---------------------------------------------------------------------------

type PlatzhalterFall = {
  kennung: string;
  zeile: string;
  ort: string;
  platzhalter: string;
  pruefen: () => Promise<void>;
};
const OB001: PlatzhalterFall[] = [
  {
    kennung: '@OB-001',
    zeile: 'Einstellungen/App-Verhalten',
    ort: 'die Einstellungen der App',
    platzhalter: 'die Schalter „Löschen bestätigen“, „Auto-Speichern“, „Timer-Ton“ und „Haptisches Feedback“',
    pruefen: async () => {
      const { container } = await renderSettingsScreen();
      expectRendered(container);
      expectAbsent(
        /behavior\.confirmDelete/,
        /behavior\.autoSave/,
        /behavior\.timerSound/,
        /behavior\.hapticFeedback/,
      );
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'Einstellungen/Daten-und-Recht',
    ort: 'die Einstellungen der App',
    platzhalter: '„Daten exportieren“, „Daten importieren“ und „Nutzungsbedingungen“',
    pruefen: async () => {
      const { container } = await renderSettingsScreen();
      expectRendered(container);
      expectAbsent(/data\.export\./, /data\.import\./, /legal\.terms\./);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'Profil/Schalter',
    ort: 'sein Profil',
    platzhalter: 'die Schalter „Zwei-Faktor-Anmeldung“ und „Benachrichtigungen“',
    pruefen: async () => {
      const { ProfileActions } = await import('../features/auth/components/profile/ProfileActions');
      const { ProfileSettings } = await import('../features/auth/components/profile/ProfileSettings');
      const { container } = render(
        <>
          <ProfileActions
            is2FAEnabled={false}
            on2FAToggle={vi.fn()}
            onChangePassword={vi.fn()}
            passwordResetCooldown={0}
            onLogout={vi.fn()}
          />
          <ProfileSettings
            isDark={false}
            onToggleTheme={vi.fn()}
            onOpenSettings={vi.fn()}
            onShowInfo={vi.fn()}
          />
        </>
      );
      expectRendered(container);
      expectAbsent(/Zwei-Faktor/, /Benachrichtigungen/);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'AdminCenter/Benachrichtigungen-und-Hilfe',
    ort: 'das Admin Center',
    platzhalter: 'den Bereich „Benachrichtigungen“ und die Knöpfe der Hilfe-Seite ohne Inhalt, auch „E-Mail Support“ ohne belegte Adresse',
    pruefen: async () => {
      const sidebar = await renderAdminSidebar();
      expectRendered(sidebar.container);
      expectAbsent(/Benachrichtigungen/, /Hilfe/);
      sidebar.unmount();
      // B-03 Fixrunde 1: Die leere Hilfe-Seite ist als toter Code entfernt (E-02).
      // Der Platzhalter wird damit gar nicht mehr angeboten — die Aussage bleibt,
      // die Prüfung folgt dem Muster aus @OB-011 (Quelltext/Datei statt Gerendertem).
      expect(existsSync(join(SRC_ROOT, 'features', 'tournament-admin', 'categories', 'Help'))).toBe(false);
      expectAbsent(/E-Mail Support|linkCard/);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'Sichtbarkeit/Oeffentlich-gelistet',
    ort: 'das Admin Center, Sichtbarkeit',
    platzhalter: 'die Option „Öffentlich gelistet“',
    pruefen: async () => {
      const { VisibilityCategory } = await import('../features/tournament-admin/categories/Visibility');
      const { ToastProvider } = await import('../components/ui/Toast');
      const { container } = render(
        <ToastProvider>
          <VisibilityCategory
            tournamentId="t1"
            tournament={makeTournament()}
            onTournamentUpdate={vi.fn()}
          />
        </ToastProvider>
      );
      expectRendered(container);
      oeffneAlleAbschnitte(container);
      expectAbsent(/visibility\.publicListed/);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'AdminEinstellungen/Pause-und-AutoTime',
    ort: 'das Admin Center, Einstellungen',
    platzhalter: 'die Abschnitte „Turnier pausieren“ und „Auto-Time-Continuation“',
    pruefen: async () => {
      const { SettingsCategory } = await import('../features/tournament-admin/categories/Settings');
      const { container } = renderInRouter(
        <SettingsCategory
          tournamentId="t1"
          tournament={makeTournament()}
          onTournamentUpdate={vi.fn()}
        />
      );
      expectRendered(container);
      expectAbsent(/settingsSection\.pauseTournament/, /settingsSection\.autoTimeContinuation/);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'AdminStartbereich/Pause-Einstellungen',
    ort: 'den Startbereich des Admin Centers',
    platzhalter: 'die Schnellaktion „Pause-Einstellungen“',
    pruefen: async () => {
      const { DashboardCategory } = await import('../features/tournament-admin/categories/Dashboard');
      const { container } = renderInRouter(
        <DashboardCategory
          tournamentId="t1"
          tournament={makeTournament()}
          onTournamentUpdate={vi.fn()}
        />
      );
      expectRendered(container);
      expectAbsent(/[Pp]ause-[Ee]instellungen|pauseSettings|dashboard\.pause/);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'MatchCockpit/Netto-und-Verzoegerung',
    ort: 'das Admin Center, Match Cockpit',
    platzhalter: 'den Schalter „Netto-Zeit-Warnung“ und die Auswahl „Verzögerung“',
    pruefen: async () => {
      const { MatchCockpitSettingsPanel } = await import('../components/match-cockpit/MatchCockpitSettingsPanel');
      const { container } = render(
        <MatchCockpitSettingsPanel
          settings={{} as ComponentProps<typeof MatchCockpitSettingsPanel>['settings']}
          onChange={vi.fn()}
          tournamentId="t1"
        />
      );
      expectRendered(container);
      expectAbsent(/netTimeWarning|Netto/, /settings\.delay\b|Verzögerung/);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'AnlegenSchritt2/Netto-und-Verzoegerung',
    ort: 'den zweiten Schritt beim Anlegen',
    platzhalter: 'den Schalter „Netto-Zeit-Warnung“ und die Auswahl „Verzögerung“',
    pruefen: async () => {
      const { MatchCockpitSettingsPanel } = await import('../components/match-cockpit/MatchCockpitSettingsPanel');
      const { container } = render(
        <MatchCockpitSettingsPanel
          settings={{} as ComponentProps<typeof MatchCockpitSettingsPanel>['settings']}
          onChange={vi.fn()}
          tournamentId="new"
        />
      );
      expectRendered(container);
      expectAbsent(/netTimeWarning|Netto/, /settings\.delay\b|Verzögerung/);
    },
  },
  {
    kennung: '@OB-001',
    zeile: 'AnlegenSchritt2/Mini-Fussball',
    ort: 'den zweiten Schritt beim Anlegen',
    platzhalter: 'den Spielmodus „Mini-Fußball“',
    pruefen: async () => {
      const { ModeSelection } = await import('../features/tournament-creation/components/ModeSelection');
      const { container } = render(
        <ModeSelection selectedMode="classic" onModeChange={vi.fn()} />
      );
      expectRendered(container);
      expectAbsent(/Mini-Fußball|miniFussball|Funino/);
      const { Step2_ModeAndSystem } = await import('../features/tournament-creation/Step2_ModeAndSystem');
      const step2 = renderInRouter(
        <Step2_ModeAndSystem
          formData={{ mode: 'miniFussball' }}
          onUpdate={vi.fn()}
          onMovePlacementLogic={vi.fn()}
          onTogglePlacementLogic={vi.fn()}
        />
      );
      expectAbsent(/Mini-Fußball|miniFussball|Funino/);
      step2.unmount();
    },
  },
];
describe('@OB-001 Ein Platzhalter ohne Anforderung ist nicht zu sehen', () => {
  it.each(OB001)('$kennung $zeile: $ort zeigt $platzhalter nicht', async ({ pruefen }) => {
    await pruefen();
  }, 30_000);
});
