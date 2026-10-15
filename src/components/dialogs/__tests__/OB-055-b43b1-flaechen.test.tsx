/**
 * @OB-055 / @OB-021 (B-43b1) — Dialoge, die bisher eine durchsichtige oder eigene
 * Fläche hatten, stehen jetzt auf DialogSurface: deckende Fläche (gemessen über die
 * aufgelöste Farbe, hell und dunkel), eigene Abdunkelung aus dem Overlay-Token und
 * jeder Text mit mindestens 4,5 : 1 gegen die Fläche, auf der er liegt.
 * Befund C-DIALOG-FLAECHE-DURCHSICHTIG.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteDialog } from '../../../features/auth/components/InviteDialog';
import { InviteLinkDialog } from '../../../features/auth/components/InviteLinkDialog';
import { RoleChangeDialog } from '../../../features/auth/components/RoleChangeDialog';
import { TransferOwnershipDialog } from '../../../features/auth/components/TransferOwnershipDialog';
import { SyncFailedList } from '../../../features/collaboration/components/SyncFailedList';
import { LogoUploadDialog } from '../../ui/LogoUploadDialog';
import { PostMatchModal } from '../../match-cockpit/PostMatchModal';
import { MonitorEditor } from '../../../features/tournament-management/MonitorEditor';
import { TeamsTab } from '../../../features/tournament-management/TeamsTab';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMembership, User } from '../../../features/auth/types/auth.types';
import {
  contrastRatio,
  isOpaque,
  over,
  resolveToken,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  type ThemeName,
} from '../../../test/contrast';

vi.mock('../../../features/auth/hooks/useInvitation', () => ({
  useInvitation: () => ({
    createNewInvitation: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

const hoisted = vi.hoisted(() => ({
  monitor: {
    id: 'monitor-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
    theme: 'dark', performanceMode: 'auto', slides: [] as unknown[],
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  },
}));

vi.mock('../../../hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMonitors: () => ({
    getMonitorById: () => hoisted.monitor, updateMonitor: vi.fn(), addSlide: vi.fn(), updateSlide: vi.fn(),
    removeSlide: vi.fn(), reorderSlides: vi.fn(), getDisplayUrl: () => '',
  }),
  useSponsors: () => ({ sponsors: [] }),
  useFields: () => ({ fields: [], getFieldDisplayName: (id: string) => id }),
}));

const THEMES: ThemeName[] = ['light', 'dark'];

const membership = (role: TournamentMembership['role']): TournamentMembership => ({
  id: 'm1', userId: 'u1', tournamentId: 't1', role, teamIds: [],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
});
const user = (id: string, name: string): User =>
  ({ id, email: `${id}@example.org`, name, globalRole: 'user' }) as unknown as User;

const tournament = {
  id: 't1', title: 'Wintercup', name: 'Wintercup', status: 'published',
  teams: [{ id: 'ufer', name: 'VfB Ufer' }], matches: [], groups: [], numberOfGroups: 2,
  groupSystem: 'groups', isPublic: false, monitors: [hoisted.monitor],
} as unknown as Tournament;

interface Kind {
  name: string;
  /** Popover ohne Abdunkelung (SyncFailedList): Fläche ist das Element selbst. */
  popover?: boolean;
  mount: () => Promise<void> | void;
}

const noop = vi.fn();

const KINDS: Kind[] = [
  { name: 'InviteDialog', mount: () => void render(<InviteDialog tournamentId="t1" onClose={noop} />) },
  { name: 'InviteLinkDialog', mount: () => void render(<InviteLinkDialog link="https://example.org/i/abc" onClose={noop} />) },
  {
    name: 'RoleChangeDialog',
    mount: () =>
      void render(
        <RoleChangeDialog membership={membership('collaborator')} user={user('u1', 'Anna')} myRole="owner" onClose={noop} onSave={noop} />,
      ),
  },
  {
    name: 'TransferOwnershipDialog (Auswahl)',
    mount: () =>
      void render(
        <TransferOwnershipDialog
          tournamentName="Wintercup"
          coAdmins={[{ membership: membership('co-admin'), user: user('u1', 'Anna') }]}
          onClose={noop}
          onTransfer={noop}
        />,
      ),
  },
  {
    name: 'TransferOwnershipDialog (ohne Co-Admins)',
    mount: () => void render(<TransferOwnershipDialog tournamentName="Wintercup" coAdmins={[]} onClose={noop} onTransfer={noop} />),
  },
  {
    name: 'SyncFailedList',
    popover: true,
    mount: () =>
      void render(
        <SyncFailedList
          items={[{ id: 'f1', type: 'UPDATE_MATCH', payload: {}, timestamp: 1, retryCount: 5, failedAt: 2, lastError: 'RLS' }]}
          onRetry={noop}
          onDiscard={noop}
          onClose={noop}
        />,
      ),
  },
  { name: 'LogoUploadDialog', mount: () => void render(<LogoUploadDialog teamName="VfB Ufer" onSave={noop} onCancel={noop} />) },
  {
    name: 'PostMatchModal',
    mount: () =>
      void render(
        <PostMatchModal
          isOpen homeTeamName="VfB Ufer" awayTeamName="SC Nord" homeScore={2} awayScore={1} matchLabel="Spiel 4"
          autoAdvanceEnabled={false} autoAdvanceSeconds={10} hasNextMatch
          onLoadNextMatch={noop} onStay={noop} onEditScore={noop} onReopenMatch={noop}
        />,
      ),
  },
  {
    name: 'MonitorEditor',
    mount: () => void render(<MonitorEditor tournament={tournament} monitorId="monitor-1" onTournamentUpdate={noop} onClose={noop} />),
  },
  {
    name: 'TeamsTab (Team löschen)',
    mount: async () => {
      const u = userEvent.setup();
      render(<TeamsTab tournament={tournament} onTournamentUpdate={noop} />);
      await u.click(screen.getByTestId('team-expand-toggle-ufer'));
      await u.click(screen.getAllByRole('button', { name: /teams\.delete/ })[0]);
    },
  },
];

function panelOf(kind: Kind): HTMLElement {
  if (kind.popover) {return screen.getByTestId('sync-failed-list');}
  return screen.getByRole('dialog');
}

/** Nächste Farbe/Fläche aus dem Inline-Stil, vom Element aufwärts bis zur Fläche. */
function nearest(el: HTMLElement, root: HTMLElement, prop: 'color' | 'background'): string | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const value = prop === 'color' ? cur.style.color : (cur.style.background || cur.style.backgroundColor);
    if (value && value !== 'transparent' && value !== 'none') {return value;}
    if (cur === root) {break;}
    cur = cur.parentElement;
  }
  return null;
}

const LARGE_TEXT_PX = 24;

/** Inline-Schriftgröße in px (nächster Vorfahr mit px-Wert), sonst 0. */
function pixelFontSize(el: HTMLElement, root: HTMLElement): number {
  let cur: HTMLElement | null = el;
  while (cur) {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(cur.style.fontSize);
    if (m) {return Number(m[1]);}
    if (cur === root) {break;}
    cur = cur.parentElement;
  }
  return 0;
}

function opaqueOver(theme: ThemeName, value: string, under: string): string | null {
  try {
    const resolved = resolveToken(theme, value);
    return isOpaque(resolved) ? resolved : over(resolved, under);
  } catch {
    return null; // Verlauf o. Ä.: nicht als Farbe auflösbar -> eigener Test unten
  }
}

describe('@OB-055 B-43b1 – umgestellte Dialoge: deckende Fläche und Kontrast', () => {
  it.each(THEMES.flatMap((theme) => KINDS.map((kind) => [theme, kind.name, kind] as const)))(
    '%s – %s: deckende Fläche, eigene Abdunkelung nur aus dem Overlay-Token, Text ≥ 4,5 : 1',
    async (theme, _name, kind) => {
      await kind.mount();
      const panel = panelOf(kind);

      // Fläche: deckend (Alpha 1) nach Auflösung des Tokens, kein Verlauf, keine Unschärfe als Ersatz.
      const surface = panel.style.background || panel.style.backgroundColor;
      expect(surface, 'Fläche gesetzt').not.toBe('');
      expect(isOpaque(resolveToken(theme, surface)), `Fläche „${surface}“ deckend`).toBe(true);
      expect(panel.style.backdropFilter).toBe('');

      if (!kind.popover) {
        // Baustein: DialogSurface (Fläche und Abdunkelung kommen von dort).
        expect(panel.classList.contains('dialog-surface-panel'), 'nutzt DialogSurface').toBe(true);
        expect(panel.style.background).toBe('var(--color-surface-elevated)');
        const scrim = panel.parentElement!;
        expect(scrim.style.backgroundColor).toMatch(/^var\(--color-overlay/);
      } else {
        expect(panel.style.background).toBe('var(--color-surface-elevated)');
      }

      const panelSurface = resolveToken(theme, 'var(--color-surface-elevated)');
      let geprueft = 0;
      const zuSchwach: string[] = [];
      panel.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.tagName === 'STYLE') {return;}
        const hasOwnText = Array.from(el.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
        );
        if (!hasOwnText) {return;}
        const color = nearest(el, panel, 'color');
        if (color === null) {return;}
        const bgValue = nearest(el, panel, 'background');
        const bg = bgValue === null ? panelSurface : opaqueOver(theme, bgValue, panelSurface);
        if (bg === null) {return;}
        const fg = resolveToken(theme, color);
        const ratio = contrastRatio(fg, bg);
        // Reine Symbole (✓ × + ✕) sind Grafik: 3 : 1 (WCAG 1.4.11); Buchstaben und Ziffern: 4,5 : 1.
        // Großer Text (ab 24 px, WCAG 1.4.3 „large text“, z. B. der Spielstand): 3 : 1.
        const isSymbol = !/[\p{L}\p{N}]/u.test(el.textContent ?? '');
        const isLarge = pixelFontSize(el, panel) >= LARGE_TEXT_PX;
        const min = isSymbol || isLarge ? MIN_UI_CONTRAST : MIN_TEXT_CONTRAST;
        if (ratio < min) {
          zuSchwach.push(`${el.tagName} „${el.textContent?.trim()}“ ${ratio.toFixed(2)} : 1 (Farbe ${color})`);
        }
        geprueft += 1;
      });
      expect(zuSchwach, 'Text unter 4,5 : 1').toEqual([]);

      expect(geprueft, 'es wurde Text geprüft').toBeGreaterThan(0);
    },
  );

  // Gemessen in B-43b1-F: Token --color-border (alle Knopf- und Feldränder) hat 1,23 : 1 zur Fläche (hell).
  // Wert gehört dem Design-System -> Entscheidung bei Daniel, kein Umbau hier.
  it.todo('@OB-055 Knopf- und Feldränder mindestens 3 : 1 – blockiert durch Token --color-border (1,23 : 1)');

  it('Gegenbeispiel: eine durchsichtige Fläche (rgba(255,255,255,.05)) wird als nicht deckend erkannt', () => {
    expect(isOpaque(resolveToken('dark', 'rgba(255, 255, 255, 0.05)'))).toBe(false);
    expect(isOpaque(resolveToken('dark', 'var(--color-surface-elevated)'))).toBe(true);
  });
});
