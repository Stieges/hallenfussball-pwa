/**
 * @OB-055 / @OB-021 (B-43b2) — Cockpit- und Match-Cockpit-Dialoge stehen auf DialogSurface:
 * deckende Fläche (gemessen über die aufgelöste Farbe, hell und dunkel), Abdunkelung aus dem
 * Overlay-Token, jeder Text mit mindestens 4,5 : 1 (große Schrift und Symbole 3 : 1) gegen
 * die Fläche, auf der er liegt. Dazu das Verhalten wie vor der Umstellung (Esc genau einmal,
 * Fokus-Ziel, Klick auf die Abdunkelung) für CardDialog, GoalScorerDialog, TimePenaltyDialog
 * und EditScoreDialog. Befund C-DIALOG-FLAECHE-DURCHSICHTIG.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardDialog } from '../components/Dialogs/CardDialog';
import { EventEditDialog } from '../components/Dialogs/EventEditDialog';
import { GoalScorerDialog } from '../components/Dialogs/GoalScorerDialog';
import { NumberPicker } from '../../ui/molecules/NumberPicker';
import { SettingsDialog } from '../components/Dialogs/SettingsDialog';
import { SubstitutionDialog } from '../components/Dialogs/SubstitutionDialog';
import { TimeAdjustDialog } from '../components/Dialogs/TimeAdjustDialog';
import { TimePenaltyDialog } from '../components/Dialogs/TimePenaltyDialog';
import { PenaltyShootoutDialog as LivePenaltyShootoutDialog } from '../components/Tiebreaker/PenaltyShootoutDialog';
import { TiebreakerBanner } from '../components/Tiebreaker/TiebreakerBanner';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type EditableMatchEvent } from '../../../types/tournament';
import { measurePanelContrast } from '../../../test/dialogContrast';
import { isOpaque, resolveToken, type ThemeName } from '../../../test/contrast';

const THEMES: ThemeName[] = ['light', 'dark'];
const noop = vi.fn();
const home = { id: 'h', name: 'VfB Ufer' };
const away = { id: 'a', name: 'SC Nord' };

const editableEvent: EditableMatchEvent = { id: 'e1', type: 'GOAL', matchMinute: 3.5, teamId: 'h', incomplete: true };
interface Kind {
  name: string;
  mount: () => Promise<void> | void;
}

const KINDS: Kind[] = [
  { name: 'CardDialog', mount: () => void render(<CardDialog isOpen onClose={noop} onConfirm={noop} homeTeam={home} awayTeam={away} />) },
  { name: 'EventEditDialog', mount: () => void render(<EventEditDialog isOpen onClose={noop} event={editableEvent} homeTeam={home} awayTeam={away} onUpdate={noop} onDelete={noop} />) },
  { name: 'GoalScorerDialog', mount: () => void render(<GoalScorerDialog isOpen onClose={noop} onConfirm={noop} teamName="VfB Ufer" />) },
  { name: 'SettingsDialog', mount: () => void render(<SettingsDialog isOpen onClose={noop} settings={DEFAULT_MATCH_COCKPIT_SETTINGS} onChange={noop} tournamentId="t1" />) },
  { name: 'SubstitutionDialog', mount: () => void render(<SubstitutionDialog isOpen onClose={noop} onConfirm={noop} homeTeam={home} awayTeam={away} />) },
  { name: 'SubstitutionDialog (Team gewählt)', mount: () => void render(<SubstitutionDialog isOpen onClose={noop} onConfirm={noop} homeTeam={home} awayTeam={away} preselectedTeamSide="home" />) },
  { name: 'TimeAdjustDialog', mount: () => void render(<TimeAdjustDialog isOpen onClose={noop} onConfirm={noop} currentSeconds={125} minSeconds={0} maxSeconds={600} minIsGoal={false} />) },
  { name: 'TimePenaltyDialog', mount: () => void render(<TimePenaltyDialog isOpen onClose={noop} onConfirm={noop} homeTeam={home} awayTeam={away} />) },
  { name: 'Tiebreaker/PenaltyShootoutDialog', mount: () => void render(<LivePenaltyShootoutDialog homeTeamName="VfB Ufer" awayTeamName="SC Nord" onRecordShot={noop} onFinish={noop} onCancel={noop} />) },
  { name: 'Tiebreaker/TiebreakerBanner', mount: () => void render(<TiebreakerBanner homeTeamName="VfB Ufer" awayTeamName="SC Nord" score={2} onStartPenaltyShootout={noop} onEndAsDraw={noop} />) },
];

function panelOf(): HTMLElement {
  const panel = document.querySelector<HTMLElement>('.dialog-surface-panel');
  expect(panel, 'nutzt DialogSurface (Panel .dialog-surface-panel)').not.toBeNull();
  return panel!;
}

describe('@OB-055 B-43b2 – Cockpit-Dialoge: deckende Fläche und Kontrast', () => {
  it.each(THEMES.flatMap((theme) => KINDS.map((kind) => [theme, kind.name, kind] as const)))(
    '%s – %s: deckende Fläche, Abdunkelung aus dem Overlay-Token, Text ≥ 4,5 : 1',
    async (theme, _name, kind) => {
      await kind.mount();
      const panel = panelOf();

      const surface = panel.style.background || panel.style.backgroundColor;
      expect(isOpaque(resolveToken(theme, surface)), `Fläche „${surface}“ deckend`).toBe(true);
      expect(panel.style.background).toBe('var(--color-surface-elevated)');
      expect(panel.style.backdropFilter).toBe('');
      expect(panel.parentElement!.style.backgroundColor).toMatch(/^var\(--color-overlay/);
      expect(panel.getAttribute('aria-modal')).toBe('true');

      const { geprueft, zuSchwach } = measurePanelContrast(theme, panel);
      expect(zuSchwach, 'Text unter der Mindeststärke').toEqual([]);
      expect(geprueft, 'es wurde Text geprüft').toBeGreaterThan(0);
    },
  );

  it('Gegenbeispiel: eine durchsichtige Fläche wird als nicht deckend erkannt', () => {
    expect(isOpaque(resolveToken('dark', 'rgba(255, 255, 255, 0.08)'))).toBe(false);
  });

  it('TiebreakerBanner bleibt ein alertdialog und ist nicht wegklickbar (Entscheidung ist Pflicht)', () => {
    const onEndAsDraw = vi.fn();
    render(<TiebreakerBanner homeTeamName="A" awayTeamName="B" score={1} onEndAsDraw={onEndAsDraw} onCancel={noop} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.getAttribute('data-testid')).toBe('tiebreaker-banner');
    fireEvent.click(dialog.parentElement!);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(onEndAsDraw).not.toHaveBeenCalled();
  });

  it('TiebreakerBanner: kein History-Eintrag, Fokus im Banner, Hintergrund gesperrt (inert), danach wieder frei', async () => {
    // Aufgeschobene Rückbau-Timer früherer Dialoge ablaufen lassen (sonst übernähme der Banner deren Eintrag).
    await new Promise((resolve) => setTimeout(resolve, 20));
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    const lengthBefore = window.history.length;
    const { unmount } = render(<TiebreakerBanner homeTeamName="A" awayTeamName="B" score={1} onEndAsDraw={noop} onStartPenaltyShootout={noop} />);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.history.length).toBe(lengthBefore);
    expect((window.history.state as { dialogId?: string } | null)?.dialogId).toBeUndefined();
    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
    expect(outside.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(outside.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    push.mockRestore();
    replace.mockRestore();
    outside.remove();
  });
});

describe('@SL-104 @OB-055 B-43b2-F – Strafstoßschießen im Live-Cockpit füllt die ganze Fläche', () => {
  it('Vollbild-Form, Fußleiste klebt unten, Knöpfe mindestens 44 px, Beenden und TOR/DANEBEN mindestens 56 px', async () => {
    const user = userEvent.setup();
    render(<LivePenaltyShootoutDialog homeTeamName="VfB Ufer" awayTeamName="SC Nord" onRecordShot={noop} onFinish={noop} onCancel={noop} />);
    const panel = screen.getByTestId('penalty-shootout-dialog');
    expect(panel.getAttribute('data-size')).toBe('fullscreen');
    expect(panel.style.height).toBe('100%');
    expect(panel.style.borderRadius).toMatch(/^0/);
    expect(panel.parentElement!.style.padding).toMatch(/^0/);
    const footer = panel.querySelector('footer')!;
    expect(footer.style.position).toBe('sticky');
    for (const b of footer.querySelectorAll('button')) {
      expect(b.style.minHeight).toBe('var(--touch-target-minimum)');
    }
    for (const name of ['TOR', 'DANEBEN']) {
      expect(screen.getByRole('button', { name: new RegExp(name) }).style.minHeight).toBe('var(--touch-target-primary)');
    }
    // Entscheidung herbeiführen: Heim trifft immer, Gast verschießt immer -> nach wenigen Runden entschieden.
    for (let i = 0; i < 10 && screen.queryByRole('button', { name: /TOR/ }); i += 1) {
      await user.click(screen.getByRole('button', { name: /TOR/ }));
      if (!screen.queryByRole('button', { name: /DANEBEN/ })) {break;}
      await user.click(screen.getByRole('button', { name: /DANEBEN/ }));
    }
    const finish = Array.from(footer.querySelectorAll('button')).find((b) => /beenden/i.test(b.textContent ?? ''));
    expect(finish, '„beenden“ nach entschiedenem Schießen').toBeDefined();
    expect(finish!.style.minHeight).toBe('var(--touch-target-primary)');
  });
});

describe('@OB-055 B-43b2 – Verhalten wie vor der Umstellung', () => {
  it('CardDialog: Esc ruft onClose genau einmal auf', () => {
    const onClose = vi.fn();
    render(<CardDialog isOpen onClose={onClose} onConfirm={noop} homeTeam={home} awayTeam={away} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('CardDialog: Fokus startet auf dem Schließen-Knopf, Klick auf die Abdunkelung schließt', () => {
    const onClose = vi.fn();
    render(<CardDialog isOpen onClose={onClose} onConfirm={noop} homeTeam={home} awayTeam={away} />);
    expect(document.activeElement).toBe(screen.getByTestId('dialog-close-button'));
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('CardDialog: Klick in die Fläche schließt nicht; geschlossen rendert nichts', () => {
    const onClose = vi.fn();
    const { rerender } = render(<CardDialog isOpen onClose={onClose} onConfirm={noop} homeTeam={home} awayTeam={away} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    rerender(<CardDialog isOpen={false} onClose={onClose} onConfirm={noop} homeTeam={home} awayTeam={away} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Aufgabe 3.4: Der Tor-Ablauf läuft über den Nummern-Baustein statt über den GoalScorerDialog. Esc schließt ihn genau einmal und
  // wählt keine Nummer; das Tor zählt dabei ohne Nummer (@SL-083, End-zu-Ende in LiveCockpit.torAblauf.engine.test.tsx).
  it('Tor-Ablauf (NumberPicker): Esc ruft onSchliesse genau einmal auf, wählt aber keine Nummer', () => {
    const onSchliesse = vi.fn();
    const onWaehle = vi.fn();
    const texte = { titel: 'Rückennummer – Tor VfB Ufer', ohneNummer: 'ohne Nummer', andereNummer: 'Andere Nr.', uebernehmen: 'Übernehmen', eingabeLabel: 'Rückennummer', ungueltig: 'Rückennummer: ganze Zahl von 1 bis 99.' };
    render(<NumberPicker isOpen texte={texte} ausloeserSeite="links" onWaehle={onWaehle} onSchliesse={onSchliesse} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSchliesse).toHaveBeenCalledTimes(1);
    expect(onSchliesse).toHaveBeenCalledWith('schliessen');
    expect(onWaehle).not.toHaveBeenCalled();
  });

  it('GoalScorerDialog: Fokus liegt auf dem Trikotnummer-Feld', async () => {
    render(<GoalScorerDialog isOpen onClose={noop} onConfirm={noop} teamName="VfB Ufer" />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('cockpit:goalScorer.jerseyAria')));
  });

  it('GoalScorerDialog: Klick auf die Abdunkelung speichert das Tor unvollständig und schließt', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<GoalScorerDialog isOpen onClose={onClose} onConfirm={onConfirm} teamName="VfB Ufer" />);
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onConfirm).toHaveBeenCalledWith(null, [], true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('TimePenaltyDialog: Esc einmal, Fokus im Dialog, Abdunkelung schließt', () => {
    const onClose = vi.fn();
    render(<TimePenaltyDialog isOpen onClose={onClose} onConfirm={noop} homeTeam={home} awayTeam={away} />);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel: nach dem Schließen sperrt kein Dialog mehr den Hintergrund', () => {
    const { unmount } = render(<TimePenaltyDialog isOpen onClose={noop} onConfirm={noop} homeTeam={home} awayTeam={away} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('verschachtelt: ein Cockpit-Dialog über einem zweiten lässt den Hintergrund gesperrt, bis der letzte schließt', () => {
    const a = render(<TimePenaltyDialog isOpen onClose={noop} onConfirm={noop} homeTeam={home} awayTeam={away} />);
    const b = render(<TimeAdjustDialog isOpen onClose={noop} onConfirm={noop} currentSeconds={5} minSeconds={0} maxSeconds={600} minIsGoal={false} />);
    b.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    a.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
