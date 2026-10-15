/**
 * @OB-055 — Beispieltabelle: je Dialog-Art ein Render-Test.
 * Jede Art nutzt DialogSurface (data-testid="dialog-surface"), hat eine deckende
 * Fläche, Text mit mindestens 4,5 : 1 und Bedienelemente mit mindestens 3 : 1.
 * Hell und dunkel.
 *
 * Die Zeile „Ergebnis korrigieren“ (CorrectionDialog) ist eine eigene Dialog-
 * Komponente und wird in B-43b umgestellt (it.todo unten).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsentDialog } from '../ConsentDialog';
import { Dialog } from '../Dialog';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { BottomSheet } from '../../ui/BottomSheet';
import {
  contrastRatio,
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
    name: 'ein Blatt von unten auf dem Handy',
    mount: () =>
      render(
        <BottomSheet isOpen onClose={vi.fn()} title="Aktion">
          <p>Inhalt</p>
        </BottomSheet>,
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

/** Borderfarbe eines Elements, aufgelöst als Token-Verweis (`1px solid var(--x)`). */
function borderTokenOf(el: HTMLElement): string | null {
  const m = /var\((--[\w-]+)\)/.exec(el.style.border);
  return m ? m[0] : null;
}

describe('@OB-055 Beispieltabelle – je Dialog-Art', () => {
  it.todo('@OB-055 „Ergebnis korrigieren“ (CorrectionDialog) – Umstellung auf DialogSurface in B-43b');

  it.each(THEMES.flatMap((theme) => KINDS.map((kind) => [theme, kind.name, kind.mount] as const)))(
    '%s – %s: deckende Fläche, Text und Bedienelemente kontrastreich',
    (theme, _name, mount) => {
      mount();
      const surfaceEl = screen.getByTestId('dialog-surface');
      expect(surfaceEl.style.background).toBe('var(--color-surface-elevated)');
      expect(surfaceEl.style.backdropFilter).toBe('');

      const surface = resolveToken(theme, 'var(--color-surface-elevated)');

      // Jeder Text außerhalb von Knöpfen: mindestens 4,5 : 1 zur Fläche.
      const textEls = Array.from(surfaceEl.querySelectorAll<HTMLElement>('[style*="color"]'))
        .filter((el) => !el.closest('button') && el.style.color.includes('var(--color-text-'));
      for (const el of textEls) {
        const fg = resolveToken(theme, el.style.color);
        expect(contrastRatio(fg, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }

      // Knopfgrenzen und Eingabefelder: mindestens 3 : 1 zur Fläche.
      for (const btn of Array.from(surfaceEl.querySelectorAll<HTMLElement>('button'))) {
        const token = borderTokenOf(btn);
        if (!token) {continue;}
        expect(contrastRatio(resolveToken(theme, token), surface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      }
    },
  );
});
