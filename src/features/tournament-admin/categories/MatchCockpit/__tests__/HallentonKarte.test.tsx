/**
 * H4-8 Match Cockpit im Admin: Karte „Töne → Hallenton“ führt in den Unterpunkt (G10); nur mit `manageScreens` (wie der Menüpunkt, @HT-022).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../../i18n/locales/de/hallenton.json';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de);
      return typeof wert === 'string' ? wert : `FEHLT:${key}`;
    },
  }),
}));
const doppel = vi.hoisted(() => ({ darf: true }));
vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => doppel.darf }));

import { HallentonKarte } from '../HallentonKarte';

function Ort() { return <span data-testid="ort">{useLocation().pathname}</span>; }
const zeige = () => render(<MemoryRouter><HallentonKarte tournamentId="t1" /><Ort /></MemoryRouter>);

beforeEach(() => { doppel.darf = true; });

describe('H4-8 Karte „Töne → Hallenton“', () => {
  it('mit Recht: Karte mit Beschreibung ohne „Sound“; „Hallenton öffnen“ führt auf /tournament/t1/admin/hallenton', () => {
    zeige();
    const karte = screen.getByTestId('karte-toene-hallenton');
    expect(karte).toHaveTextContent('Töne');
    expect(karte).toHaveTextContent('Hallenton');
    expect(karte).not.toHaveTextContent(/Sound/);
    fireEvent.click(screen.getByTestId('toene-hallenton-oeffnen'));
    expect(screen.getByTestId('ort').textContent).toBe('/tournament/t1/admin/hallenton');
  });
  it('Gegenbeispiel: ohne manageScreens keine Karte', () => {
    doppel.darf = false;
    zeige();
    expect(screen.queryByTestId('karte-toene-hallenton')).toBeNull();
  });
});
