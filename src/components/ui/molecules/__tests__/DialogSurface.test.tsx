/**
 * @OB-055 — Baustein DialogSurface: deckende Fläche, Kontrast, Schließen optional,
 * Portal, Scroll-Sperre, Blatt von unten.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogSurface } from '../DialogSurface';
import { contrastRatio, isOpaque, resolveToken, MIN_TEXT_CONTRAST, type ThemeName } from '../../../../test/contrast';

const THEMES: ThemeName[] = ['dark', 'light'];

function renderSurface(props: Partial<Parameters<typeof DialogSurface>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <DialogSurface isOpen onClose={onClose} labelledBy="t" {...props}>
      <h2 id="t">Titel</h2>
      <p>Text</p>
    </DialogSurface>,
  );
  return { onClose, panel: screen.getByRole('dialog') };
}

describe('DialogSurface – Fläche und Kontrast (@OB-055)', () => {
  it('nutzt die deckende Fläche surfaceElevated, nie gradients.card oder backdropFilter', () => {
    const { panel } = renderSurface();
    expect(panel.style.background).toBe('var(--color-surface-elevated)');
    expect(panel.style.backdropFilter).toBe('');
    expect(panel.getAttribute('data-testid')).toBe('dialog-surface');
  });

  it.each(THEMES)('Fläche ist im Theme %s deckend (Alpha 1)', (theme) => {
    const surface = resolveToken(theme, 'var(--color-surface-elevated)');
    expect(isOpaque(surface)).toBe(true);
  });

  it.each(THEMES)('Text hat im Theme %s mindestens 4,5 : 1 zur Fläche', (theme) => {
    const surface = resolveToken(theme, 'var(--color-surface-elevated)');
    for (const token of ['var(--color-text-primary)', 'var(--color-text-secondary)']) {
      expect(contrastRatio(resolveToken(theme, token), surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it('Abdunkelung liegt hinter der Fläche (overlayStrong), Scrim ist ein Portal in document.body', () => {
    const { panel } = renderSurface();
    const scrim = panel.parentElement!;
    expect(scrim.style.backgroundColor).toBe('var(--color-overlay-strong)');
    expect(scrim.parentElement).toBe(document.body);
  });

  it('sperrt das Scrollen des Hintergrunds, solange offen', () => {
    const { unmount } = render(
      <DialogSurface isOpen labelledBy="x" onClose={vi.fn()}>
        <p id="x">x</p>
      </DialogSurface>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('DialogSurface – Schließen optional (Einwilligung, @OB-055-Baustein)', () => {
  it('Esc schließt, wenn dismissible (Standard)', () => {
    const { onClose, panel } = renderSurface();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc schließt NICHT, wenn dismissible=false', () => {
    const { onClose, panel } = renderSurface({ dismissible: false });
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Klick auf die Abdunkelung schließt nicht, wenn closeOnBackdropClick=false', () => {
    const { onClose, panel } = renderSurface({ closeOnBackdropClick: false });
    fireEvent.click(panel.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DialogSurface – Form am Handy und Lesebreite', () => {
  it('Blatt (placement=sheet) sitzt unten am Bildschirm', () => {
    const { panel } = renderSurface({ placement: 'sheet' });
    expect(panel.parentElement!.style.justifyContent).toBe('flex-end');
  });

  it('übernimmt die Lesebreite über maxWidth', () => {
    const { panel } = renderSurface({ maxWidth: '360px' });
    expect(panel.style.maxWidth).toBe('360px');
  });
});
