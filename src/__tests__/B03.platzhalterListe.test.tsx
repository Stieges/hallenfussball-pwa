/**
 * B-03 — Pflichttest: Die Platzhalter-Liste des Records 2026-10-02_oberflaeche.md
 * als Testtabelle.
 *
 * Aufbau laut Regel „Tests aus Szenarien":
 * - Szenario-Grundriss (mit Beispieltabelle) = ein parametrisierter Test, jede
 *   Beispielzeile ein Fall (Fallname = Kennung + Zeilenschlüssel).
 * - Szenario ohne Beispieltabelle = Einzelfall mit der Kennung im Testnamen.
 *
 * Gegenbeispiel (Pflicht): kein Ankündigungs-Text „Bald"/„Coming Soon"/… im
 * Textkorpus der App (@OB-003) und im dist-Bundle (Aufruf im Report).
 *
 * Da react-i18next in Tests die Schlüssel durchreicht, prüfen die Fälle die
 * Inhalte über die i18n-Schlüssel bzw. die hartkodierten Beschriftungen (Regel:
 * „prüft den Inhalt, nicht den Wortlaut").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentProps, ReactElement } from 'react';
import type { Tournament } from '../types/tournament';

// ---------------------------------------------------------------------------
// Mocks (Umgebung der betroffenen Seiten)
// ---------------------------------------------------------------------------

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock('../lib/sentry', () => ({ reinitializeSentry: vi.fn() }));

vi.mock('../hooks/useRepository', () => ({
  useRepository: () => ({
    makeTournamentPublic: vi.fn(() => Promise.resolve(null)),
    makeTournamentPrivate: vi.fn(() => Promise.resolve()),
    regenerateShareCode: vi.fn(() => Promise.resolve(null)),
  }),
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' }),
}));

vi.mock('../features/settings/hooks/useSettings', () => ({
  useSettings: () => ({
    fontSize: 16,
    setFontSize: vi.fn(),
    confirmDelete: true,
    autoSave: true,
    timerSound: true,
    hapticFeedback: true,
    toggleConfirmDelete: vi.fn(),
    toggleAutoSave: vi.fn(),
    toggleTimerSound: vi.fn(),
    toggleHapticFeedback: vi.fn(),
  }),
}));

vi.mock('../hooks', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()) }),
  };
});

vi.mock('../hooks/useTournaments', () => ({
  useTournaments: () => ({
    saveTournament: vi.fn(() => Promise.resolve()),
    deleteTournament: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

vi.mock('../hooks/useTournamentWizard', () => ({
  useTournamentWizard: () => ({
    step: 1,
    formData: { title: 'Hallencup Ost', location: { name: 'Halle Ost' }, teams: [] },
    visitedSteps: new Set([1]),
    stepErrors: {},
    scheduleError: null,
    hasResults: false,
    lastSavedDataRef: { current: '' },
    setStep: vi.fn(),
    setFormData: vi.fn(),
    setScheduleError: vi.fn(),
    updateForm: vi.fn(),
    handleStepChange: vi.fn(),
    handleNavigateToStep: vi.fn(),
    canGoNext: () => true,
    canNavigateToStep: () => true,
    validateStep: () => [],
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    updateTeam: vi.fn(),
    movePlacementLogic: vi.fn(),
    togglePlacementLogic: vi.fn(),
    reorderPlacementLogic: vi.fn(),
    handleTournamentTypeChange: vi.fn(),
    handleResetTournament: vi.fn(),
    createDraftTournament: vi.fn(),
    saveDraft: vi.fn(() => Promise.resolve({})),
    publishTournament: vi.fn(() => Promise.resolve({})),
  }),
}));

vi.mock('../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1', email: 'olli@example.org', name: 'Olli Turnierleitung' },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../features/auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'm1', userId: 'user-1', tournamentId: 't1', role: 'owner',
      teamIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    },
    members: [],
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Textkorpus-Prüfung (@OB-003): Ankündigungen „für später" sind wörtlich verboten
// ---------------------------------------------------------------------------

const VERBOTENE_ANKUENDIGUNG =
  /\bComing Soon\b|\bkommt bald\b|\bBald\b|folgt später|in einer späteren Version|in Kürze|\bsoon\b|later version/i;

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALE_MARKER = join('i18n', 'locales');

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') { continue; }
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walkFiles(full, out);
    } else if (/\.(ts|tsx|json)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function findeAnkuendigungen(language: 'de' | 'en'): string[] {
  const treffer: string[] = [];
  const localeDir = join(SRC_ROOT, 'i18n', 'locales', language);
  for (const file of walkFiles(localeDir)) {
    const text = readFileSync(file, 'utf8');
    const match = VERBOTENE_ANKUENDIGUNG.exec(text);
    if (match) {
      treffer.push(`${file}: ${match[0]}`);
    }
  }
  for (const file of walkFiles(SRC_ROOT)) {
    if (file.includes(LOCALE_MARKER)) { continue; }
    if (!/\.(ts|tsx)$/.test(file)) { continue; }
    const text = readFileSync(file, 'utf8');
    const match = VERBOTENE_ANKUENDIGUNG.exec(text);
    if (match) {
      treffer.push(`${file}: ${match[0]}`);
    }
  }
  return treffer;
}

// ---------------------------------------------------------------------------
// Render-Helfer
// ---------------------------------------------------------------------------

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    title: 'Hallencup Ost',
    status: 'published',
    publishedAt: '2026-02-01T10:00:00.000Z',
    location: { name: 'Halle Ost', city: 'Oststadt', street: 'Sportweg 1' },
    teams: [
      { id: 'vfb', name: 'VfB Ufer' },
      { id: 'fc', name: 'FC Nord' },
    ],
    matches: [],
    numberOfFields: 2,
    groupPhaseGameDuration: 12,
    groupPhaseBreakDuration: 2,
    ...overrides,
  } as unknown as Tournament;
}

function renderInRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

/** Kollabierte Abschnitte rendern ihre Kinder nicht – vor der Prüfung öffnen. */
function oeffneAlleAbschnitte(container: HTMLElement) {
  const toggles = container.querySelectorAll('[role="button"][aria-expanded="false"]');
  for (const toggle of toggles) {
    fireEvent.click(toggle);
  }
}

function expectAbsent(...patterns: RegExp[]) {
  const body = document.body.textContent ?? '';
  for (const pattern of patterns) {
    expect(body).not.toMatch(pattern);
  }
}

function expectRendered(container: HTMLElement) {
  expect(container.firstChild).not.toBeNull();
}

async function renderSettingsScreen() {
  const { SettingsScreen } = await import('../features/settings/components/SettingsScreen');
  return renderInRouter(<SettingsScreen onBack={vi.fn()} />);
}

async function renderAdminSidebar() {
  const { AdminSidebar } = await import('../features/tournament-admin/components/AdminSidebar');
  return renderInRouter(
    <AdminSidebar
      activeCategory="dashboard"
      onNavigate={vi.fn()}
      onBackToTournament={vi.fn()}
    />
  );
}

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
      const { HelpCategory } = await import('../features/tournament-admin/categories/Help');
      const sidebar = await renderAdminSidebar();
      expectRendered(sidebar.container);
      expectAbsent(/Benachrichtigungen/, /Hilfe/);
      sidebar.unmount();
      const { container } = render(
        <HelpCategory
          tournamentId="t1"
          tournament={makeTournament()}
          onTournamentUpdate={vi.fn()}
        />
      );
      expectAbsent(/E-Mail Support|linkCard/);
      expect(container.querySelector('button')).toBeNull();
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
      const { container } = render(
        <GameControls
          status="NOT_STARTED"
          onStart={vi.fn()}
          onPauseResume={vi.fn()}
          onEditTime={vi.fn()}
          onSwitchSides={vi.fn()}
          onHalfTime={vi.fn()}
          onFinish={vi.fn()}
        />
      );
      expectRendered(container);
      expectAbsent(/Halbzeit/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'Cockpit/Spielzeit-anpassen',
    funktion: '„Spielzeit anpassen“',
    ort: 'das Cockpit von Spiel 9',
    pruefen: async () => {
      const { OverflowMenu } = await import('../components/live-cockpit/components/OverflowMenu');
      const { container } = render(
        <OverflowMenu
          isOpen
          onClose={vi.fn()}
          tournamentId="t1"
          onAdjustTimeClick={vi.fn()}
        />
      );
      expectRendered(container);
      expectAbsent(/adjustTime|Zeit anpassen|Spielzeit anpassen/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'AdminMatchCockpit/Bildschirm-an-lassen',
    funktion: 'der Schalter „Bildschirm an lassen“',
    ort: 'das Admin Center, Match Cockpit',
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
      expectAbsent(/keepScreenOn|Bildschirm/);
    },
  },
  {
    kennung: '@OB-002',
    zeile: 'AnlegenSchritt2/Bildschirm-an-lassen',
    funktion: 'der Schalter „Bildschirm an lassen“',
    ort: 'den zweiten Schritt beim Anlegen',
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
];

// ---------------------------------------------------------------------------
// @OB-003 — Kein Text kündigt eine Funktion für später an (4 Beispielzeilen)
// ---------------------------------------------------------------------------

type AnkuendigungsFall = {
  kennung: string;
  zeile: string;
  person: string;
  sprache: 'de' | 'en';
  seiten: () => Promise<void>;
};

const OB003: AnkuendigungsFall[] = [
  {
    kennung: '@OB-003',
    zeile: 'Olli/Deutsch',
    person: 'Olli',
    sprache: 'de',
    seiten: async () => {
      await renderSettingsScreen();
    },
  },
  {
    kennung: '@OB-003',
    zeile: 'Olli/Englisch',
    person: 'Olli',
    sprache: 'en',
    seiten: async () => {
      await renderSettingsScreen();
    },
  },
  {
    kennung: '@OB-003',
    zeile: 'Tom/Deutsch',
    person: 'Tom',
    sprache: 'de',
    seiten: async () => {
      const { GameControls } = await import('../components/live-cockpit/components/GameControls');
      render(
        <GameControls
          status="RUNNING"
          onStart={vi.fn()}
          onPauseResume={vi.fn()}
          onEditTime={vi.fn()}
          onSwitchSides={vi.fn()}
          onHalfTime={vi.fn()}
          onFinish={vi.fn()}
        />
      );
    },
  },
  {
    kennung: '@OB-003',
    zeile: 'MamaPetra/Deutsch',
    person: 'Mama Petra',
    sprache: 'de',
    seiten: async () => {
      const { Footer } = await import('../components/layout/Footer');
      renderInRouter(<Footer />);
    },
  },
];

// ---------------------------------------------------------------------------
// @OB-012 — Ein Dialog schließt mit Esc, Zurück-Taste und Schließen-Knopf (4 Beispielzeilen)
// ---------------------------------------------------------------------------

type DialogFall = {
  kennung: string;
  zeile: string;
  person: string;
  dialog: string;
  weg: 'esc' | 'zurueck' | 'schliessen';
  oeffnen: (onClose: () => void, onConfirm: () => void) => Promise<void>;
};

const OB012: DialogFall[] = [
  {
    kennung: '@OB-012',
    zeile: 'Olli/Teilen/Esc',
    person: 'Olli',
    dialog: 'am Laptop den Dialog „Teilen“',
    weg: 'esc',
    oeffnen: async (onClose, onConfirm) => {
      const { ShareDialog } = await import('../components/dialogs/ShareDialog');
      render(
        <ShareDialog
          isOpen
          onClose={onClose}
          tournamentId="t1"
          tournamentTitle="Hallencup Ost"
          shareCode="ABC123"
          isPublic
        />
      );
      fireEvent.click(screen.getByLabelText(/share|teilen|copy|kopieren/i));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
  {
    kennung: '@OB-012',
    zeile: 'Tom/Karte/Zurueck',
    person: 'Tom',
    dialog: 'im Cockpit von Spiel 9 den Dialog für eine Karte',
    weg: 'zurueck',
    oeffnen: async (onClose, onConfirm) => {
      const { CardDialog } = await import('../components/live-cockpit/components/Dialogs');
      render(
        <CardDialog
          isOpen
          onClose={onClose}
          onConfirm={() => onConfirm()}
          homeTeam={{ id: 'fc', name: 'FC Nord' }}
          awayTeam={{ id: 'sv', name: 'SV Süd' }}
        />
      );
      fireEvent.popState(window);
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
  {
    kennung: '@OB-012',
    zeile: 'Tom/Tor/Schliessen',
    person: 'Tom',
    dialog: 'im Cockpit von Spiel 9 den Dialog für ein Tor',
    weg: 'schliessen',
    oeffnen: async (onClose, onConfirm) => {
      const { GoalScorerDialog } = await import('../components/live-cockpit/components/Dialogs');
      render(
        <GoalScorerDialog
          isOpen
          onClose={onClose}
          onConfirm={() => onConfirm()}
          teamName="FC Nord"
        />
      );
      const closeButton = screen.getByRole('button', { name: /schließen|close/i });
      fireEvent.click(closeButton);
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
  {
    kennung: '@OB-012',
    zeile: 'Olli/Ergebnis-korrigieren/Zurueck',
    person: 'Olli',
    dialog: 'auf dem Tablet den Dialog „Ergebnis korrigieren“ von Spiel 7',
    weg: 'zurueck',
    oeffnen: async (onClose, onConfirm) => {
      const { CorrectionDialog } = await import('../components/dialogs/CorrectionDialog');
      const { ToastProvider } = await import('../components/ui/Toast');
      render(
        <ToastProvider>
          <CorrectionDialog
            isOpen
            onClose={onClose}
            onConfirm={() => onConfirm()}
            matchLabel="Spiel 7"
            teamA="FC Nord"
            teamB="SV Süd"
            originalScoreA={2}
            originalScoreB={1}
          />
        </ToastProvider>
      );
      fireEvent.popState(window);
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
];

// ---------------------------------------------------------------------------
// @OB-017 — Rückfragen im Dialog der App, nie als Fenster des Browsers (3 Beispielzeilen)
// ---------------------------------------------------------------------------

type RueckfrageFall = {
  kennung: string;
  zeile: string;
  aktion: string;
  pruefen: () => Promise<void>;
};

const OB017: RueckfrageFall[] = [
  {
    kennung: '@OB-017',
    zeile: 'Team-loeschen',
    aktion: '„Team löschen“ für VfB Ufer wählt',
    pruefen: async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { TeamsTab } = await import('../features/tournament-management/TeamsTab');
      const { ToastProvider } = await import('../components/ui/Toast');
      const { container } = render(
        <ToastProvider>
          <TeamsTab tournament={makeTournament()} onTournamentUpdate={vi.fn()} />
        </ToastProvider>
      );
      expectRendered(container);
      fireEvent.click(screen.getByTestId('team-expand-toggle-vfb'));
      const deleteButton = screen.getAllByRole('button').find((button) =>
        (button.textContent ?? '').includes('teams.delete')
      );
      expect(deleteButton).toBeDefined();
      fireEvent.click(deleteButton!);
      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByTestId('team-delete-dialog')).toBeInTheDocument();
      });
    },
  },
  {
    kennung: '@OB-017',
    zeile: 'Spielplan-zuruecksetzen',
    aktion: '„Spielplan zurücksetzen“ wählt',
    pruefen: async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { DangerZoneCategory } = await import('../features/tournament-admin/categories/DangerZone');
      const { container } = render(
        <DangerZoneCategory
          tournamentId="t1"
          tournament={makeTournament()}
          onTournamentUpdate={vi.fn()}
          onLocalTournamentUpdate={vi.fn()}
          onMatchesUpdate={vi.fn()}
        />
      );
      expectRendered(container);
      const resetButton = screen.getAllByRole('button').find((button) =>
        (button.textContent ?? '').includes('Spielplan zurücksetzen')
      );
      expect(resetButton).toBeDefined();
      fireEvent.click(resetButton!);
      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    },
  },
  {
    kennung: '@OB-017',
    zeile: 'Anlegen-Verlassen',
    aktion: 'den Anlege-Vorgang mit ungesicherten Angaben über die Navigation der App verlässt',
    pruefen: async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { TournamentCreationScreen } = await import('../screens/TournamentCreationScreen');
      const { ToastProvider } = await import('../components/ui/Toast');
      const onBack = vi.fn();
      const { container } = renderInRouter(
        <ToastProvider>
          <TournamentCreationScreen
            onBack={onBack}
            onNavigateToLogin={vi.fn()}
            onNavigateToRegister={vi.fn()}
            onNavigateToProfile={vi.fn()}
          />
        </ToastProvider>
      );
      expectRendered(container);
      const backButton = screen.getAllByRole('button').find((button) =>
        /zurück/i.test(button.textContent ?? '')
      );
      expect(backButton).toBeDefined();
      fireEvent.click(backButton!);
      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    },
  },
];

// ---------------------------------------------------------------------------
// Testtabellen
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('@OB-001 Ein Platzhalter ohne Anforderung ist nicht zu sehen', () => {
  it.each(OB001)('$kennung $zeile: $ort zeigt $platzhalter nicht', async ({ pruefen }) => {
    await pruefen();
  });
});

describe('@OB-002 Eine Funktion mit Anforderung erscheint erst, wenn sie wirkt', () => {
  it.each(OB002)('$kennung $zeile: $funktion wird an $ort nicht angeboten', async ({ pruefen }) => {
    await pruefen();
  });
});

describe('@OB-003 Kein Text kündigt eine Funktion für später an', () => {
  it.each(OB003)('$kennung $zeile: $person ($sprache) sieht keine Ankündigung', async ({ sprache, seiten }) => {
    const treffer = findeAnkuendigungen(sprache);
    expect(treffer, `Ankündigungen im Textkorpus (${sprache})`).toEqual([]);
    await seiten();
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(VERBOTENE_ANKUENDIGUNG);
  });
});

describe('@OB-004 Ein ausgeblendeter Platzhalter kommt mit einer neuen App-Version nicht zurück', () => {
  it('@OB-004 Die vier Schalter „App-Verhalten“ fehlen auch nach dem erneuten Öffnen', async () => {
    const first = await renderSettingsScreen();
    expectAbsent(/behavior\.confirmDelete/, /behavior\.autoSave/, /behavior\.timerSound/, /behavior\.hapticFeedback/);
    first.unmount();
    const second = await renderSettingsScreen();
    expectRendered(second.container);
    expectAbsent(/behavior\.confirmDelete/, /behavior\.autoSave/, /behavior\.timerSound/, /behavior\.hapticFeedback/);
  });
});

describe('@OB-005 „Team & Helfer“ erscheint erst mit dem Einstieg per QR-Code und nie als „Bald“', () => {
  it('@OB-005 Solange der QR-Einstieg fehlt, ist „Team & Helfer“ ausgeblendet und trägt nie „Bald“', async () => {
    const { container } = await renderAdminSidebar();
    expectRendered(container);
    expectAbsent(/Team & Helfer/, /\bBald\b|Coming Soon|comingSoon/);
    const { ADMIN_CATEGORIES } = await import('../features/tournament-admin/constants/admin.constants');
    const eintrag = ADMIN_CATEGORIES.find((cat) => cat.id === 'team-helpers');
    expect(eintrag?.isComingSoon === undefined).toBe(true);
  });
});

describe('@OB-011 Eine Folie ohne Darstellung zeigt keinen Entwickler-Hinweis', () => {
  it('@OB-011 Keine Folie zeigt „wird in Phase 2 implementiert“, der Monitor fällt auf die Zuschauer-QR-Folie zurück', async () => {
    const source = readFileSync(
      join(SRC_ROOT, 'features', 'monitor-display', 'MonitorDisplayPage.tsx'),
      'utf8'
    );
    expect(source).not.toMatch(/wird in Phase 2 implementiert/);
    const { selectDisplayableSlides } = await import('../features/monitor-display/slideProgramme');
    const slides = selectDisplayableSlides([
      { id: 'a', type: 'unknown-type', duration: 10 },
      { id: 'b', type: 'sponsor', duration: 10 },
    ]);
    expect(slides.map((slide) => slide.id)).toEqual(['b']);
    const fallback = selectDisplayableSlides([{ id: 'a', type: 'unknown-type', duration: 10 }]);
    expect(fallback.map((slide) => slide.type)).toContain('qr-code');
  });
});

describe('@OB-012 Ein Dialog schließt mit Esc, Zurück-Taste und Schließen-Knopf, ohne etwas zu ändern', () => {
  it.each(OB012)('$kennung $zeile: $dialog schließt per $weg ohne Speichern', async ({ oeffnen }) => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    await oeffnen(onClose, onConfirm);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('@OB-017 Rückfragen und Hinweise kommen im Dialog der App, nie als Fenster des Browsers', () => {
  it.each(OB017)('$kennung $zeile: $aktion fragt im Dialog der App nach', async ({ pruefen }) => {
    await pruefen();
  });
});

describe('@OB-043 Die Pausendauer steht schreibgeschützt da wie die Spielzeit pro Spiel', () => {
  it('@OB-043 Pausendauer im Bereich Spielzeiten nicht änderbar, mit demselben Hinweis wie die Spielzeit', async () => {
    const { SettingsCategory } = await import('../features/tournament-admin/categories/Settings');
    const { container } = renderInRouter(
      <SettingsCategory
        tournamentId="t1"
        tournament={makeTournament()}
        onTournamentUpdate={vi.fn()}
      />
    );
    expectRendered(container);
    oeffneAlleAbschnitte(container);
    const labels = Array.from(container.querySelectorAll('label'));
    const pauseLabel = labels.find((label) => (label.textContent ?? '').includes('settingsSection.breakTime'));
    expect(pauseLabel).toBeDefined();
    const pauseGroup = pauseLabel?.parentElement;
    expect(pauseGroup).toBeTruthy();
    const input = pauseGroup?.querySelector('input');
    expect(input).toBeTruthy();
    expect(input?.disabled ?? false).toBe(true);
    expect(container.textContent ?? '').toMatch(/settingsSection\.gameTimeLockedHint/);
    expectAbsent(/comingSoon|folgt später|später/);
  });
});