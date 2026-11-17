/**
 * @RE-004 Impressum und Datenschutzerklärung mit der ECHTEN Konfiguration (ohne Mock): Reihenfolge der Anschriftzeilen.
 * Geprüft wird gegen die Konfiguration selbst, nicht gegen Abschriften der Anschrift; die E-Mail-Adresse wird hier nicht geprüft.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LEGAL_CONFIG } from '../../config/legal';
import { ImpressumScreen } from '../ImpressumScreen';
import { DatenschutzScreen } from '../DatenschutzScreen';

/** Die Zeilen eines Elements: Text zwischen den Zeilenumbruch-Knoten (<br>), ohne HTML-Auswertung. */
function zeilen(element: HTMLElement): string[] {
  const ergebnis: string[] = [];
  let aktuell = '';
  element.childNodes.forEach((knoten) => {
    if (knoten.nodeName === 'BR') {
      ergebnis.push(aktuell.trim());
      aktuell = '';
    } else {
      aktuell += knoten.textContent ?? '';
    }
  });
  ergebnis.push(aktuell.trim());
  return ergebnis;
}

const { name, careOf, street, city } = LEGAL_CONFIG;
const ANSCHRIFT = [name, careOf, street, city];

describe('@RE-004 Anschrift in der Reihenfolge Name, c/o, Straße, Ort', () => {
  it('Konfiguration: keine Platzhalter in den vier Anschriftzeilen', () => {
    for (const zeile of ANSCHRIFT) {
      expect(zeile).not.toMatch(/\[|\]/);
      expect(zeile.trim()).not.toBe('');
    }
  });

  it('Impressum: vier Zeilen, danach „Deutschland“', () => {
    render(<MemoryRouter><ImpressumScreen onBack={vi.fn()} /></MemoryRouter>);
    expect(zeilen(screen.getByTestId('betreiber-adresse')).slice(0, 5)).toEqual([...ANSCHRIFT, 'Deutschland']);
  });

  it('Datenschutzerklärung, Abschnitt 1: dieselben vier Zeilen, danach die E-Mail-Zeile', () => {
    render(<MemoryRouter><DatenschutzScreen onBack={vi.fn()} /></MemoryRouter>);
    const z = zeilen(within(screen.getByTestId('datenschutz-section-1')).getByTestId('betreiber-adresse'));
    expect(z.slice(0, 4)).toEqual(ANSCHRIFT);
    expect(z[4]).toMatch(/^E-Mail: /);
  });
});
