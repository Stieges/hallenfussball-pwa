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
});
