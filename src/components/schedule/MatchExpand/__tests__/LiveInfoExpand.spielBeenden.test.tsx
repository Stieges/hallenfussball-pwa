/**
 * Spiel beenden (@FU-112, @FU-113): die Live-Info eines laufenden Gruppenspiels bietet der Turnierleitung „Spiel beenden und
 * Ergebnis eintragen“ an; ohne Handler (Helfer, Zuschauer) fehlt der Knopf. Echte DE-Texte.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { LiveInfoExpand } from '../LiveInfoExpand';

await initRealDeI18n();

const team = (id: string, name: string) => ({ id, name }) as never;

describe('LiveInfoExpand: Spiel beenden', () => {
  it('@FU-112 Turnierleitung: Knopf „Spiel beenden und Ergebnis eintragen“ ruft den Handler', () => {
    const onEnd = vi.fn();
    const view = render(<LiveInfoExpand homeTeam={team('a', 'FC Nord')} awayTeam={team('b', 'SV Süd')} homeScore={1} awayScore={0} onEndAndEnter={onEnd} />);
    fireEvent.click(view.getByRole('button', { name: 'Spiel beenden und Ergebnis eintragen' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('@FU-113 Gegenbeispiel: ohne Handler (Helfer) bietet die Live-Info den Weg nicht an', () => {
    const view = render(<LiveInfoExpand homeTeam={team('a', 'FC Nord')} awayTeam={team('b', 'SV Süd')} homeScore={1} awayScore={0} onNavigateToCockpit={vi.fn()} />);
    expect(view.queryByTestId('end-and-enter-btn')).toBeNull();
  });
});
