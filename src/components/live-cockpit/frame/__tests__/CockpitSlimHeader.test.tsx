/**
 * Schmaler Kopf (Plan LT-2, @SL-140, visuelle Prüfung): „← Zurück“ bleibt Text, der Turniername wird nie mit Auslassungspunkten abgeschnitten.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { CockpitSlimHeader } from '../CockpitSlimHeader';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const zeige = () => render(
  <MemoryRouter>
    <CockpitSlimHeader tournamentId="t-1" turnierName="Hallencup Messlauf" felder={1} feld={1} onFeld={vi.fn()} verbindung={null} />
  </MemoryRouter>,
);

describe('CockpitSlimHeader am Handy (visuelle Prüfung)', () => {
  it('@SL-140 „← Zurück“ bleibt sichtbarer Text und schrumpft nicht (Mockup handy-b)', () => {
    zeige();
    const knopf = screen.getByTestId('cockpit-zurueck');
    expect(knopf.textContent).toBe('← Zurück');
    expect(knopf.style.flexShrink).toBe('0');
  });

  it('@SL-140 der Turniername bricht bei Platzmangel in eine eigene Zeile um, nie mit Auslassungspunkten und nie mitten im Wort', () => {
    zeige();
    expect(screen.getByTestId('cockpit-slim-header').style.flexWrap).toBe('wrap');
    const name = screen.getByTestId('cockpit-turniername');
    expect(name.style.textOverflow).toBe('');
    expect(name.style.overflowWrap).toBe('break-word');
  });

  it('@SL-061 N1 Name und Feldwahl bilden eine Gruppe, die den Rest der Zeile nimmt; der Name bricht in Zeilen der Fließtext-Höhe um, damit zwei Zeilen in die Tippfläche passen und der Kopf nicht wächst', () => {
    render(
      <MemoryRouter>
        <CockpitSlimHeader tournamentId="t-1" turnierName="Hallencup Messlauf" felder={2} feld={1} onFeld={vi.fn()} verbindung={<span data-testid="v" />} />
      </MemoryRouter>,
    );
    const name = screen.getByTestId('cockpit-turniername');
    const gruppe = name.parentElement;
    if (!gruppe) { throw new Error('Gruppe fehlt'); }
    expect(gruppe).toContainElement(screen.getByTestId('cockpit-feldwahl'));
    expect(gruppe.style.flex).toBe('1 1 0px');
    expect(gruppe.style.minWidth).toBe('min-content');
    expect(name.style.minWidth).toBe('min-content');
    expect(name.style.lineHeight).toBe('var(--line-height-body-md)');
    // die Anzeige rechts steht in der Kopfzeile, nicht in der Gruppe
    expect(gruppe).not.toContainElement(screen.getByTestId('v'));
  });

  it('@SL-061 N1 Handy (360 px): engere Abstände und schmaler seitlicher Rand; Gegenbeispiel breiter Bildschirm mit den normalen', () => {
    const vorher = window.innerWidth;
    try {
      window.innerWidth = 360;
      const { unmount } = zeige();
      const kopf = screen.getByTestId('cockpit-slim-header');
      expect(kopf.style.gap).toBe('var(--spacing-xs)');
      expect(kopf.style.padding).toBe('var(--spacing-xs) var(--spacing-sm)');
      unmount();
      window.innerWidth = 1280;
      zeige();
      expect(screen.getByTestId('cockpit-slim-header').style.gap).toBe('var(--spacing-sm)');
      expect(screen.getByTestId('cockpit-slim-header').style.padding).toBe('var(--spacing-xs) var(--spacing-md)');
    } finally {
      window.innerWidth = vorher;
    }
  });
});
