/**
 * Live-Info eines laufenden Spiels: die drei Tasten brechen bei schmaler Breite in die nächste Zeile um, statt aus dem Bild zu
 * laufen (@OB-021, Befund C-LIVEINFO-TASTEN-AUS-DEM-BILD, G3-N N3). jsdom rechnet kein Layout: geprüft wird die Regel, die den
 * Umbruch erzwingt (Umbruch der Zeile, schrumpfende Tasten); die Messung `scrollWidth <= clientWidth` bei 360 px steht in
 * tests/e2e/flows/spielplan-aktionen.spec.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, within } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { LiveInfoExpand } from '../LiveInfoExpand';

await initRealDeI18n();

const team = (id: string, name: string) => ({ id, name }) as never;
const zeige = (mitSchliessen: boolean) => render(
  <LiveInfoExpand
    homeTeam={team('a', 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V.')} awayTeam={team('b', 'SV Süd')} homeScore={1} awayScore={0}
    onClose={mitSchliessen ? vi.fn() : undefined} onEndAndEnter={vi.fn()} onNavigateToCockpit={vi.fn()}
  />,
);

describe('LiveInfoExpand: Tasten im Rahmen', () => {
  it('Umbruch: die Tastenzeile bricht um, jede Taste darf schmaler als ihr Wort werden und ist nie breiter als die Zeile', () => {
    const view = zeige(true);
    expect(view.getByTestId('live-info-actions').style.flexWrap).toBe('wrap');
    for (const id of ['end-and-enter-btn', 'goto-cockpit-btn']) {
      const taste = view.getByTestId(id);
      expect(taste.style.minWidth).toBe('0px');
      expect(taste.style.maxWidth).toBe('100%');
    }
    expect(view.getByRole('button', { name: 'Schließen' }).style.minWidth).toBe('0px');
  });

  it('Gegenbeispiel: die gefüllte Haupttaste „Zum Cockpit“ bleibt die letzte Taste der Zeile', () => {
    const view = zeige(true);
    const tasten = within(view.getByTestId('live-info-actions')).getAllByRole('button');
    expect(tasten.at(-1)).toBe(view.getByTestId('goto-cockpit-btn'));
  });
});
