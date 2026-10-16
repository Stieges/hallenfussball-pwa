/**
 * @OB-055 — Beispieltabelle: je Dialog-Art ein Render-Test.
 * Jede Art nutzt DialogSurface (data-testid="dialog-surface"), hat eine deckende
 * Fläche und prüft JEDEN Text gegen die Fläche, auf der er tatsächlich liegt:
 * Innenflächen (Fußzeile, Detailbox, Infobox, Kopf-Tönung) und Knopftext gegen
 * die Knopffläche. Halbdurchsichtige Flächen und Schrift werden vorher über den
 * deckenden Untergrund gemischt (Helfer `over`). Hell und dunkel.
 *
 * Die Zeile „Ergebnis korrigieren“ (CorrectionDialog) steht seit B-43b3 ebenfalls auf
 * DialogSurface und läuft in dieser Tabelle mit.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsentDialog } from '../ConsentDialog';
import { Dialog } from '../Dialog';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { BottomSheet } from '../../ui/BottomSheet';
import { CorrectionDialog } from '../CorrectionDialog';
import { ToastProvider } from '../../ui/Toast';
import {
  contrastRatio,
  over,
  resolveToken,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  type ThemeName,
} from '../../../test/contrast';

const THEMES: ThemeName[] = ['light', 'dark'];

const KINDS: Array<{ name: string; mount: () => void }> = [
  {
    name: 'der Dialog „Datenschutz-Einstellungen“',
    mount: () => render(<ConsentDialog isOpen onConsent={vi.fn()} />),
  },
  {
    name: 'eine Rückfrage „Spiel wirklich beenden?“',
    mount: () =>
      render(
        <ConfirmDialog
          title="Spiel wirklich beenden?"
          message="Das Spiel kann danach nicht mehr geändert werden."
          variant="warning"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      ),
  },
  {
    name: 'eine Rückfrage „Turnier löschen“ (gefährlich)',
    mount: () =>
      render(
        <ConfirmDialog
          title="Turnier löschen?"
          message="Das lässt sich nicht rückgängig machen."
          variant="danger"
          details="Wintercup 2026 · 12 Teams"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      ),
  },
  {
    name: 'eine Rückfrage mit Detailbox (Info)',
    mount: () =>
      render(
        <ConfirmDialog
          title="Ergebnis übernehmen?"
          message="Der Stand wird gespeichert."
          variant="info"
          details="Spiel 4 · 2 : 1"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      ),
  },
  {
    name: 'ein Blatt von unten auf dem Handy',
    mount: () =>
      render(
        <BottomSheet isOpen onClose={vi.fn()} title="Aktion">
          <p>Inhalt</p>
        </BottomSheet>,
      ),
  },
  {
    name: '„Ergebnis korrigieren“ (CorrectionDialog)',
    mount: () =>
      render(
        <ToastProvider>
          <CorrectionDialog
            isOpen
            onClose={vi.fn()}
            onConfirm={vi.fn()}
            matchLabel="Spiel 4"
            teamA="FC Nord"
            teamB="SV Süd"
            originalScoreA={2}
            originalScoreB={1}
          />
        </ToastProvider>,
      ),
  },
  {
    name: 'ein allgemeiner Dialog (Dialog.tsx)',
    mount: () =>
      render(
        <Dialog isOpen onClose={vi.fn()} title="Allgemein">
          <p>Inhalt</p>
        </Dialog>,
      ),
  },
];

/** Nächster Vorfahr (inkl. Element selbst) mit einer Farbe in `prop`, bis zur Fläche. */
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

/** Eigener Text (nicht nur Kinder-Elemente) und Farbe/Fläche, auf der er liegt. */
function textPlacements(root: HTMLElement): Array<{ el: HTMLElement; color: string | null; background: string | null }> {
  const out: Array<{ el: HTMLElement; color: string | null; background: string | null }> = [];
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') {return;}
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
    );
    if (!hasOwnText) {return;}
    out.push({
      el,
      color: nearest(el, root, 'color'),
      background: nearest(el, root, 'background'),
    });
  });
  return out;
}

/** Hintergrund als deckende Farbe: Token auflösen, halbdurchsichtig über die Panel-Fläche mischen. */
function opaqueBackground(theme: ThemeName, background: string | null, panelSurface: string): string {
  if (background === null) {return panelSurface;}
  const resolved = resolveToken(theme, background);
  return resolved.startsWith('rgba') ? over(resolved, panelSurface) : resolved;
}

/** Borderfarbe eines Elements, aufgelöst als Token-Verweis (`1px solid var(--x)`). */
function borderTokenOf(el: HTMLElement): string | null {
  const m = /var\((--[\w-]+)\)/.exec(el.style.border);
  return m ? m[0] : null;
}

describe('@OB-055 Beispieltabelle – je Dialog-Art', () => {
  it.each(THEMES.flatMap((theme) => KINDS.map((kind) => [theme, kind.name, kind.mount] as const)))(
    '%s – %s: deckende Fläche, jeder Text und jedes Bedienelement kontrastreich',
    (theme, _name, mount) => {
      mount();
      const surfaceEl = screen.getByTestId('dialog-surface');
      expect(surfaceEl.style.background).toBe('var(--color-surface-elevated)');
      expect(surfaceEl.style.backdropFilter).toBe('');

      const panelSurface = resolveToken(theme, 'var(--color-surface-elevated)');

      // Jeder Text (auch in Knöpfen, Fußzeilen, Detailboxen): mindestens 4,5 : 1
      // gegen die tatsächlich darunterliegende deckende Fläche.
      const placements = textPlacements(surfaceEl);
      expect(placements.length).toBeGreaterThan(0);
      for (const { el, color, background } of placements) {
        if (color === null) {continue;}
        const fg = resolveToken(theme, color);
        const bg = opaqueBackground(theme, background, panelSurface);
        expect(contrastRatio(fg, bg), `${el.tagName} „${el.textContent?.trim()}“`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }

      // Knopfgrenzen und Eingabefelder: mindestens 3 : 1 zur Fläche.
      for (const btn of Array.from(surfaceEl.querySelectorAll<HTMLElement>('button'))) {
        const token = borderTokenOf(btn);
        if (!token) {continue;}
        expect(contrastRatio(resolveToken(theme, token), panelSurface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      }
    },
  );

  it.each(['warning', 'danger', 'info'] as const)(
    'Kopf-Tönung der Rückfrage (%s) ist ein gültiger Farb-Token, kein Platzhalter',
    (variant) => {
      render(
        <ConfirmDialog title="Titel" message="Text" variant={variant} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      );
      const header = screen.getByRole('dialog').querySelector<HTMLElement>('h2')!.parentElement!;
      expect(header.style.backgroundColor).toMatch(/^var\(--color-(warning|error|primary)-light\)$/);
    },
  );
});
