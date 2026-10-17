/**
 * @OB-062 Kopf und Tasten-Fuß eines Dialogs bleiben beim Scrollen sichtbar, @OB-063 ein kurzer Dialog bleibt so hoch wie sein
 * Inhalt (Zusammenspiel @OB-061, @OB-021). jsdom hat kein Layout: Hier steht der Vertrag, aus dem der Browser das Verhalten ableitet
 * (Fläche = Spalte ohne eigenen Scroll, Inhalt allein scrollt und darf schrumpfen, Kopf/Fuß schrumpfen nie, Fuß außerhalb des
 * Inhalts). Die echte Messung bei 1440×900, 1280×720 und 360×640 macht tests/e2e/dialog-fuss-fest.spec.ts am PDF-Dialog.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DialogSurface } from '../DialogSurface';
import { cssVars } from '../../../../design-tokens';

const originalWidth = window.innerWidth;
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});
const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });

function mount(props: Partial<Parameters<typeof DialogSurface>[0]> = {}) {
  render(
    <DialogSurface isOpen onClose={vi.fn()} labelledBy="t" header={<h2 id="t">Als PDF</h2>} footer={<button>Als PDF speichern</button>} {...props}>
      <p>Inhalt</p>
    </DialogSurface>,
  );
  return {
    panel: screen.getByRole('dialog'),
    header: screen.queryByTestId('dialog-surface-header'),
    body: screen.queryByTestId('dialog-surface-body'),
    footer: screen.queryByTestId('dialog-surface-footer'),
  };
}

describe('@OB-062 DialogSurface – Kopf und Fuß stehen, nur der Inhalt scrollt', () => {
  it('Fläche ist eine Spalte; Reihenfolge Kopf, Inhalt, Fuß', () => {
    const { panel, header, body, footer } = mount();
    expect(panel.style.display).toBe('flex');
    expect(panel.style.flexDirection).toBe('column');
    expect([...panel.children]).toEqual([header, body, footer]);
  });

  it('der Inhalt scrollt allein und schrumpft nur bis zur Mindesthöhe (Token), Kopf und Fuß schrumpfen nie', () => {
    const { header, body, footer } = mount();
    expect(body!.style.overflowY).toBe('auto');
    expect(body!.style.minHeight).toBe(cssVars.touchTargets.primary);
    expect(body!.style.flexShrink).toBe('1');
    expect(header!.style.flexShrink).toBe('0');
    expect(footer!.style.flexShrink).toBe('0');
    expect(header!.style.overflowY).toBe('');
    expect(footer!.style.overflowY).toBe('');
  });

  it('Titel und Haupttaste liegen außerhalb des scrollenden Inhalts, der Inhalt darin', () => {
    const { body, header, footer } = mount();
    expect(within(body!).getByText('Inhalt')).toBeTruthy();
    expect(within(body!).queryByText('Als PDF')).toBeNull();
    expect(within(body!).queryByRole('button', { name: 'Als PDF speichern' })).toBeNull();
    expect(within(header!).getByRole('heading', { name: 'Als PDF' })).toBeTruthy();
    expect(within(footer!).getByRole('button', { name: 'Als PDF speichern' })).toBeTruthy();
  });

  it('Fuß hat eine Trennlinie und Polster aus Tokens (keine festen Maße)', () => {
    const { footer } = mount();
    expect(footer!.style.borderTop).toContain('var(--color-border)');
    expect(footer!.style.paddingTop).toBe('var(--spacing-md)');
    expect(footer!.style.paddingLeft).toBe('var(--spacing-xl)');
    expect(footer!.style.paddingRight).toBe('var(--spacing-xl)');
  });

  it('nur Kopf oder nur Fuß ist möglich: der fehlende Slot erzeugt keine leere Zeile', () => {
    const a = mount({ footer: undefined });
    expect(a.footer).toBeNull();
    expect(a.header).not.toBeNull();
  });

  it('Gegenbeispiel: ohne Slots scrollt die Fläche wie bisher als Ganzes (kein Inhalts-Wrapper)', () => {
    const { panel, header, body, footer } = mount({ header: undefined, footer: undefined });
    expect(header).toBeNull();
    expect(body).toBeNull();
    expect(footer).toBeNull();
    expect(panel.style.overflowY).toBe('auto');
    expect(panel.style.display).toBe('');
  });

  it('Gegenbeispiel: Vollbild mit Slots bleibt Vollbild – der Aufrufer ordnet selbst, kein zweiter Scrollbereich', () => {
    const { panel, body } = mount({ size: 'fullscreen' });
    expect(body).toBeNull();
    expect(panel.getAttribute('data-layout')).toBe('fullscreen');
    expect(panel.style.overflowY).toBe('hidden');
    expect(screen.getByRole('heading', { name: 'Als PDF' }).parentElement).toBe(panel);
  });
});

describe('@OB-060/WCAG 1.4.10 DialogSurface – bei sehr wenig Höhe bleibt alles erreichbar', () => {
  it('der Inhalt hat eine Mindesthöhe und die Fläche scrollt als Ganzes, wenn nicht einmal die passt (kein overflow hidden)', () => {
    const { panel, body } = mount();
    expect(body!.style.minHeight).toBe(cssVars.touchTargets.primary);
    expect(panel.style.overflowY).toBe('auto');
  });
});

describe('@OB-063 DialogSurface – ein kurzer Dialog wird nicht gestreckt', () => {
  it('die Fläche hat keine feste oder Mindesthöhe, nur eine Obergrenze', () => {
    const { panel, body } = mount();
    expect(panel.style.height).toBe('');
    expect(panel.style.minHeight).toBe('');
    expect(panel.style.maxHeight).toBe('90vh');
    expect(body!.style.height).toBe('');
  });
});

describe('@OB-021/@OB-062 DialogSurface – Safe-Area am Fuß des Blatts', () => {
  it('360 px, nur Kopf (kein Fuß): die Fläche trägt den Safe-Area-Abstand, Tasten im Inhalt liegen nicht im Bereich des Home-Indikators', () => {
    setWidth(360);
    const { panel } = mount({ footer: undefined });
    expect(panel.getAttribute('data-layout')).toBe('sheet');
    expect(panel.style.paddingBottom).toContain('safe-area-inset-bottom');
  });

  it('Gegenbeispiel 360 px mit Fuß: Safe-Area am Fuß, nicht doppelt an der Fläche', () => {
    setWidth(360);
    const { panel, footer } = mount();
    expect(footer!.style.paddingBottom).toContain('safe-area-inset-bottom');
    expect(panel.style.paddingBottom).toBe('');
  });

  it('360 px (Blatt): der Fuß trägt den Safe-Area-Abstand, die Fläche selbst nicht mehr', () => {
    setWidth(360);
    const { panel, footer } = mount();
    expect(panel.getAttribute('data-layout')).toBe('sheet');
    expect(footer!.style.paddingBottom).toContain('safe-area-inset-bottom');
    expect(panel.style.paddingBottom).toBe('');
  });

  it('Gegenbeispiel: 1024 px (zentriert) hat keinen Safe-Area-Abstand am Fuß', () => {
    setWidth(1024);
    const { panel, footer } = mount();
    expect(panel.getAttribute('data-layout')).toBe('center');
    expect(footer!.style.paddingBottom).toBe('var(--spacing-md)');
  });
});
