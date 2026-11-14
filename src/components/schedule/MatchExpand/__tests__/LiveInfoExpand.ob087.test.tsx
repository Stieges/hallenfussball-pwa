/**
 * @OB-087 Zeile 8 („Zum Cockpit“, ohne Hinweistext): Olli klappt im Spielplan ein Spiel auf, das gerade läuft. Am aufgeklappten Spiel steht die Taste
 * „Zum Cockpit“ (≥ 44 px); ein Tipp öffnet das Cockpit dieses Spiels. Gegenbeispiel: wer das Spiel nur ansehen darf (kein Weg ins Cockpit), bekommt
 * die Taste nicht.
 * FESTSCHREIBUNG DES BESTANDS: die Taste war schon da (`onNavigateToCockpit`, Aktionsauswahl und aufgeklapptes Spiel); der Test hält sie fest und
 * ist kein Nachweis einer Änderung. Die Zeile nennt keinen Hinweistext mehr (der frühere Text „Dieses Spiel läuft gerade LIVE“ entfiel), darum
 * erwartet der Test auch keinen.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { touchTargets } from '../../../../design-tokens';
import { LiveInfoExpand } from '../LiveInfoExpand';

await initRealDeI18n();

const team = (id: string, name: string) => ({ id, name });

describe('@OB-087 Zeile 8 – „Zum Cockpit“ am laufenden Spiel im Spielplan', () => {
  it('@OB-087 Zeile 8: am aufgeklappten laufenden Spiel steht „Zum Cockpit“ (≥ 44 px); ein Tipp öffnet das Cockpit dieses Spiels', () => {
    const zumCockpit = vi.fn();
    render(<LiveInfoExpand homeTeam={team('a', 'FC Nord')} awayTeam={team('b', 'SV Süd')} homeScore={2} awayScore={1} onNavigateToCockpit={zumCockpit} />);
    const taste = screen.getByTestId('goto-cockpit-btn');
    expect(taste).toHaveTextContent('Zum Cockpit');
    expect(taste).toHaveStyle({ minHeight: touchTargets.minimum });
    fireEvent.click(taste);
    expect(zumCockpit).toHaveBeenCalledTimes(1);
  });

  it('@OB-087 Zeile 8 Gegenbeispiel: ohne Weg ins Cockpit (nur Ansehen) steht die Taste nicht da', () => {
    render(<LiveInfoExpand homeTeam={team('a', 'FC Nord')} awayTeam={team('b', 'SV Süd')} homeScore={2} awayScore={1} />);
    expect(screen.queryByTestId('goto-cockpit-btn')).toBeNull();
  });
});
