/**
 * Lage beim Tastendruck (Plan Cockpit v2 K1, A4-1, A4-2): Eingabefeld, offener Dialog jeder Rolle, Tastatur-Fokus auf „Abpfiff halten“.
 * Szenarien @SL-154, @SL-142, @SL-167. Die echte Browser-Prüfung (Tab ja, Mausklick nein) liefert Playwright (`cockpit-tasten.spec.ts`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { lageVon, useCockpitShortcuts } from '../useCockpitShortcuts';
import type { KurzAktion } from '../../model/shortcutKey';
import { DialogSurface } from '../../../ui/molecules/DialogSurface';

const leer: Readonly<Record<KurzAktion, () => void>> = { uhr: () => undefined, torLinks: () => undefined, torRechts: () => undefined, foulLinks: () => undefined, foulRechts: () => undefined, rueckgaengig: () => undefined, uebersicht: () => undefined };

afterEach(() => { document.body.innerHTML = ''; });

describe('lageVon', () => {
  it('@SL-154 Eingabefeld, Textfeld, Auswahl und bearbeitbarer Bereich zählen als Eingabe', () => {
    const feld = document.createElement('input');
    const text = document.createElement('textarea');
    const auswahl = document.createElement('select');
    const frei = document.createElement('div');
    frei.contentEditable = 'true';
    Object.defineProperty(frei, 'isContentEditable', { value: true });
    for (const el of [feld, text, auswahl, frei]) { expect(lageVon(el).istEingabe).toBe(true); }
    expect(lageVon(document.createElement('button')).istEingabe).toBe(false);
    expect(lageVon(null).istEingabe).toBe(false);
  });

  it('A4-1 jeder offene modale Dialog sperrt, auch ein alertdialog (Abpfiff-Rückfrage); ohne Dialog nicht', () => {
    expect(lageVon(document.body).dialogOffen).toBe(false);
    const { unmount } = render(<DialogSurface isOpen onClose={() => undefined} role="alertdialog" ariaLabel="Spiel beenden?"><p>Inhalt</p></DialogSurface>);
    expect(lageVon(document.body).dialogOffen).toBe(true);
    unmount();
    expect(lageVon(document.body).dialogOffen).toBe(false);
  });

  it('A4-2 Halteknopf mit Tab erreicht → halteFokus; nach einem Mausklick nicht, bis wieder Tab gedrückt wird; andere Knöpfe nie', () => {
    const { unmount } = renderHook(() => useCockpitShortcuts({ aktiv: true, darf: () => false, aktionen: leer }));
    const halten = document.createElement('button');
    halten.setAttribute('data-halteknopf', '');
    const anderer = document.createElement('button');
    expect(lageVon(halten).halteFokus).toBe(true);
    window.dispatchEvent(new Event('pointerdown'));
    expect(lageVon(halten).halteFokus).toBe(false); // nach einem Mausklick: die Leertaste steuert die Uhr
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(lageVon(halten).halteFokus).toBe(false); // die Leertaste selbst ändert nichts
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(lageVon(halten).halteFokus).toBe(true);
    expect(lageVon(anderer).halteFokus).toBe(false);
    unmount();
  });
});
