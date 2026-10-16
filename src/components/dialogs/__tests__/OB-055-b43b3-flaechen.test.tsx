/**
 * @OB-055 / @OB-021 (B-43b3) — die restlichen eigenen Dialoge stehen auf DialogSurface:
 * Anmeldung (Login-Formular, Passwort-Mail, Magic-Link, Erfolg), Registrierung (Formular,
 * Bestätigungs-Mail, Erfolg), Ergebnis korrigieren, Spielbericht, Team wählen (Zuschauer)
 * und Konflikte im Spielplan. Je Dialog hell und dunkel: deckende Fläche, Abdunkelung aus dem
 * Overlay-Token, jeder Text mindestens 4,5 : 1 gegen die Fläche, auf der er liegt.
 * Dazu: Hover der Warn-Knöpfe ist ein eigener, sichtbar anderer Ton mit Kontrast >= 4,5 : 1.
 * Befund C-DIALOG-FLAECHE-DURCHSICHTIG.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LoginResetPasswordDialog, LoginMagicLinkDialog, LoginSuccessDialog } from '../../../features/auth/components/LoginDialogs';
import { RegisterEmailConfirmationDialog, RegisterSuccessDialog } from '../../../features/auth/components/RegisterDialogs';
import { LoginScreen } from '../../../features/auth/components/LoginScreen';
import { RegisterScreen } from '../../../features/auth/components/RegisterScreen';
import { CorrectionDialog } from '../CorrectionDialog';
import { MatchSummary } from '../../schedule/MatchSummary';
import { TeamSelectorDialog } from '../../../features/public-view/components/TeamSelectorDialog';
import { ConflictDialog } from '../../../features/schedule-editor/components/ConflictDialog';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ToastProvider } from '../../ui/Toast';
import { buildLiveViewTournament } from '../../../screens/__tests__/liveViewFixture';
import type { ScheduleConflict } from '../../../features/schedule-editor/types';
import { measurePanelContrast } from '../../../test/dialogContrast';
import { contrastRatio, isOpaque, resolveToken, MIN_TEXT_CONTRAST, type ThemeName } from '../../../test/contrast';

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(), register: vi.fn(), sendMagicLink: vi.fn(), loginWithGoogle: vi.fn(), continueAsGuest: vi.fn(),
    resetPassword: vi.fn(), connectionState: 'connected', reconnect: vi.fn(), isGuest: false,
  }),
}));

const THEMES: ThemeName[] = ['light', 'dark'];
const noop = vi.fn();
const teams = buildLiveViewTournament().teams;
const conflicts: ScheduleConflict[] = [
  { id: 'c1', type: 'team_double_booking', severity: 'error', matchIds: [], message: 'FC Nord spielt zweimal gleichzeitig', suggestion: 'Spiel verschieben' },
  { id: 'c2', type: 'break_violation', severity: 'warning', matchIds: [], message: 'Pause zu kurz' },
];

const inToasts = (node: ReactNode) => render(<ToastProvider>{node}</ToastProvider>);

interface Kind { name: string; mount: () => void }

const KINDS: Kind[] = [
  { name: 'Anmeldung: Formular', mount: () => void render(<LoginScreen onBack={noop} />) },
  { name: 'Anmeldung: Passwort-Mail verschickt', mount: () => void render(<LoginResetPasswordDialog email="a@b.de" onClose={noop} onBackdropClick={noop} />) },
  { name: 'Anmeldung: Magic-Link verschickt', mount: () => void render(<LoginMagicLinkDialog email="a@b.de" onClose={noop} onBackdropClick={noop} />) },
  { name: 'Anmeldung: Erfolg', mount: () => void render(<LoginSuccessDialog migratedCount={2} onClose={noop} />) },
  { name: 'Registrierung: Formular', mount: () => void inToasts(<RegisterScreen onBack={noop} />) },
  { name: 'Registrierung: Bestätigungs-Mail', mount: () => void render(<RegisterEmailConfirmationDialog email="a@b.de" migratedCount={1} onClose={noop} />) },
  { name: 'Registrierung: Erfolg', mount: () => void render(<RegisterSuccessDialog migratedCount={0} onClose={noop} />) },
  {
    name: 'Ergebnis korrigieren',
    mount: () => void inToasts(<CorrectionDialog isOpen onClose={noop} onConfirm={noop} matchLabel="Spiel 3" teamA="FC Nord" teamB="SV Süd" originalScoreA={1} originalScoreB={0} />),
  },
  {
    name: 'Spielbericht',
    mount: () => void render(
      <MatchSummary isOpen onClose={noop} homeScore={2} awayScore={1} homeTeamId="h" awayTeamId="a" homeTeamName="FC Nord" awayTeamName="SV Süd" events={[]} />,
    ),
  },
  { name: 'Team wählen (Zuschauer)', mount: () => void render(<TeamSelectorDialog teams={teams} myTeamId="team-nord" onSelectTeam={noop} onClose={noop} />) },
  { name: 'Konflikte im Spielplan', mount: () => void render(<ConflictDialog isOpen onClose={noop} conflicts={conflicts} matches={[]} onSaveAnyway={noop} onAutoResolve={noop} canAutoResolve />) },
  { name: 'Konflikte im Spielplan (keine)', mount: () => void render(<ConflictDialog isOpen onClose={noop} conflicts={[]} matches={[]} />) },
];

describe('@OB-055 B-43b3 – restliche Dialoge: deckende Fläche, Abdunkelung, Kontrast', () => {
  it.each(THEMES.flatMap((theme) => KINDS.map((kind) => [theme, kind.name, kind] as const)))(
    '%s – %s: DialogSurface, deckende Fläche, Abdunkelung aus dem Overlay-Token, Text >= 4,5 : 1',
    (theme, _name, kind) => {
      kind.mount();
      const panel = document.querySelector<HTMLElement>('.dialog-surface-panel');
      expect(panel, 'nutzt DialogSurface').not.toBeNull();
      expect(panel!.style.background).toBe('var(--color-surface-elevated)');
      expect(isOpaque(resolveToken(theme, panel!.style.background))).toBe(true);
      expect(panel!.style.backdropFilter).toBe('');
      expect(panel!.parentElement!.style.backgroundColor).toMatch(/^var\(--color-overlay/);
      const { geprueft, zuSchwach } = measurePanelContrast(theme, panel!);
      expect(zuSchwach, 'Text unter 4,5 : 1').toEqual([]);
      expect(geprueft, 'es wurde Text geprüft').toBeGreaterThan(0);
    },
  );
});

describe('@OB-055 B-43b3 – Hover der Warn-Knöpfe', () => {
  const warnButton = () => {
    render(<ConfirmDialog variant="warning" title="Spiel beenden?" message="Wirklich?" onConfirm={noop} onCancel={noop} />);
    return document.querySelector<HTMLElement>('[data-testid="confirm-dialog-confirm"]')!;
  };

  it.each(THEMES)('%s: Hover-Ton ist ein anderer Wert als die Grundfarbe', (theme) => {
    expect(resolveToken(theme, 'var(--color-warning-hover)')).not.toBe(resolveToken(theme, 'var(--color-warning-solid)'));
  });

  it.each(THEMES)('%s: Schrift auf dem Hover-Ton hat mindestens 4,5 : 1', (theme) => {
    const ratio = contrastRatio(resolveToken(theme, 'var(--color-on-warning)'), resolveToken(theme, 'var(--color-warning-hover)'));
    expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('Rückfrage (warning): beim Überfahren wechselt die Fläche auf den Hover-Ton und danach zurück', () => {
    const button = warnButton();
    expect(button.style.backgroundColor).toBe('var(--color-warning-solid)');
    fireEvent.mouseEnter(button);
    expect(button.style.backgroundColor).toBe('var(--color-warning-hover)');
    fireEvent.mouseLeave(button);
    expect(button.style.backgroundColor).toBe('var(--color-warning-solid)');
  });

  it('Ergebnis korrigieren: der Bestätigen-Knopf hat denselben Hover-Wechsel', () => {
    inToasts(<CorrectionDialog isOpen onClose={noop} onConfirm={noop} matchLabel="Spiel 3" teamA="A" teamB="B" originalScoreA={1} originalScoreB={0} />);
    const button = document.querySelector<HTMLElement>('[data-testid="correction-confirm-button"]')!;
    expect(button.style.backgroundColor).toBe('var(--color-warning-solid)');
    fireEvent.mouseEnter(button);
    expect(button.style.backgroundColor).toBe('var(--color-warning-hover)');
  });
});
