/**
 * @OB-021 / @OB-055 (B-43b3) — Handy-Blatt: zentrierte Dialoge erscheinen unter dem Token
 * breakpoints.sheet (600 px) als Blatt von unten (unten verankert, volle Breite, Safe-Area);
 * ab dort zentriert; size="fullscreen" bleibt Vollbild. Esc und Abdunkelung wie bisher.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DialogSurface } from '../DialogSurface';
import { breakpointValues } from '../../../../design-tokens';

const originalWidth = window.innerWidth;
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

function mount(props: Partial<Parameters<typeof DialogSurface>[0]> = {}) {
  const onClose = vi.fn();
  const { unmount } = render(
    <DialogSurface isOpen onClose={onClose} labelledBy="t" {...props}>
      <h2 id="t">Titel</h2>
    </DialogSurface>,
  );
  const panel = screen.getByRole('dialog');
  return { onClose, panel, scrim: panel.parentElement!, unmount };
}

describe('@OB-021 DialogSurface – Handy-Blatt', () => {
  it('Token: das Blatt beginnt unter 600 Bildpunkten', () => {
    expect(breakpointValues.sheet).toBe(600);
  });

  it('390 px: zentrierter Dialog ist ein Blatt – unten verankert, volle Breite, Rundung nur oben, Safe-Area unten', () => {
    setWidth(390);
    const { panel, scrim } = mount();
    expect(panel.getAttribute('data-layout')).toBe('sheet');
    expect(panel.style.marginTop).toBe('auto');
    expect(scrim.style.justifyContent).toBe('flex-start');
    expect(scrim.style.alignItems).toBe('stretch');
    expect(scrim.style.padding).toBe('0px');
    expect(panel.style.width).toBe('100%');
    expect(panel.style.maxWidth).toBe('100%');
    expect(panel.style.borderRadius).toMatch(/0 0$/);
    expect(panel.style.paddingBottom).toContain('safe-area-inset-bottom');
  });

  it('599 px ist noch Blatt, 600 px zentriert (Grenze)', () => {
    setWidth(599);
    const a = mount();
    expect(a.panel.getAttribute('data-layout')).toBe('sheet');
    a.unmount();
    setWidth(600);
    const b = mount();
    expect(b.panel.getAttribute('data-layout')).toBe('center');
  });

  it('768 px: zentriert, mit der Lesebreite und allseitiger Rundung', () => {
    setWidth(768);
    const { panel, scrim } = mount({ maxWidth: '480px' });
    expect(panel.getAttribute('data-layout')).toBe('center');
    expect(scrim.style.justifyContent).toBe('center');
    expect(scrim.style.alignItems).toBe('center');
    expect(panel.style.maxWidth).toBe('480px');
    expect(panel.style.borderRadius).not.toMatch(/0 0$/);
    expect(panel.style.paddingBottom).toBe('');
  });

  it('Gegenbeispiel: Vollbild bleibt bei 390 px Vollbild (kein Blatt)', () => {
    setWidth(390);
    const { panel, scrim } = mount({ size: 'fullscreen' });
    expect(panel.getAttribute('data-layout')).toBe('fullscreen');
    expect(panel.style.height).toBe('100%');
    expect(panel.style.borderRadius).toBe('0px');
    expect(scrim.style.justifyContent).toBe('center');
  });

  it('Größenänderung: von 1024 auf 390 px wird aus dem Dialog ein Blatt', () => {
    setWidth(1024);
    const { panel } = mount();
    expect(panel.getAttribute('data-layout')).toBe('center');
    act(() => {
      setWidth(390);
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('dialog').getAttribute('data-layout')).toBe('sheet');
  });

  it('als Blatt: Esc schließt genau einmal, die Abdunkelung schließt, ein Klick in die Fläche nicht', () => {
    setWidth(390);
    const { onClose, panel, scrim } = mount();
    fireEvent.click(panel);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Blatt: Höhe in dvh mit vh-Rückfall, Überlauf scrollt in der Fläche', () => {
    setWidth(390);
    const { panel } = mount();
    const css = document.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/\[data-layout="sheet"\]\s*\{\s*max-height: 90vh;\s*max-height: 90dvh;/);
    expect(panel.style.overflowY).toBe('auto');
    expect(panel.style.maxHeight).toBe('');
  });

  it('Blatt hat weiter die deckende Fläche und die Abdunkelung', () => {
    setWidth(390);
    const { panel, scrim } = mount();
    expect(panel.style.background).toBe('var(--color-surface-elevated)');
    expect(scrim.style.backgroundColor).toBe('var(--color-overlay-strong)');
  });

  it('explizites placement="sheet" bleibt auch bei 1024 px ein Blatt', () => {
    setWidth(1024);
    const { panel } = mount({ placement: 'sheet' });
    expect(panel.getAttribute('data-layout')).toBe('sheet');
  });

  it('die Regeln für 600–767 px (oben ausgerichtet) gelten nur für die zentrierte Form', () => {
    setWidth(700);
    mount();
    const css = document.querySelector('style')?.textContent ?? '';
    expect(css).toContain('[data-layout="center"]');
    expect(css).not.toContain('[data-placement="center"]');
  });
});
