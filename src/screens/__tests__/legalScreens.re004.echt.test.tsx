/**
 * @RE-004 Impressum und Datenschutzerklärung mit der ECHTEN Konfiguration (ohne Mock): Reihenfolge der Anschriftzeilen.
 * Die E-Mail-Adresse wird hier nicht geprüft (kommt später); Impressum und Datenschutz zeigen dieselbe Anschrift.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ImpressumScreen } from '../ImpressumScreen';
import { DatenschutzScreen } from '../DatenschutzScreen';

const ZEILEN = ['Daniel Stiegler', 'c/o MDC#2444', 'Welserstraße 3', '87463 Dietmannsried'];

function zeilen(element: HTMLElement): string[] {
  return (element.innerHTML.split(/<br\s*\/?>/)).map((teil) => teil.replace(/<[^>]*>/g, '').trim());
}

describe('@RE-004 Anschrift in der Reihenfolge Name, c/o, Straße, Ort', () => {
  it('Impressum: vier Zeilen, danach „Deutschland“', () => {
    render(<MemoryRouter><ImpressumScreen onBack={vi.fn()} /></MemoryRouter>);
    expect(zeilen(screen.getByTestId('betreiber-adresse')).slice(0, 5)).toEqual([...ZEILEN, 'Deutschland']);
  });

  it('Datenschutzerklärung, Abschnitt 1: dieselben vier Zeilen, danach die E-Mail-Zeile', () => {
    render(<MemoryRouter><DatenschutzScreen onBack={vi.fn()} /></MemoryRouter>);
    const adresse = within(screen.getByTestId('datenschutz-section-1')).getByTestId('betreiber-adresse');
    const z = zeilen(adresse);
    expect(z.slice(0, 4)).toEqual(ZEILEN);
    expect(z[4]).toMatch(/^E-Mail: /);
  });
});
