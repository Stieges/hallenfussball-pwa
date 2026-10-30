/**
 * @W2A-059 Z. 3 „Die Markierung verschwindet, sobald der Platz entschieden ist“ – Zuschauer-Seite über den ECHTEN Übertragungsweg
 * (@ZM-180 Prüfregel): Antwort in der Form von `public_tournament` → `createRpcPublicSource` (Parser des B-14-Vertrags) →
 * `usePublicTournament` → Reiter „Tabellen“. Befund C-PUBLIC-ENTSCHEIDUNG-BASIS-LEER: der Server lieferte `basis` leer, die Markierung
 * „Strafstoß folgt“ blieb nach dem Strafstoßschießen stehen. Lage und Zahlen: `publicEntscheidungKit.ts` (@ET-055, @ET-044).
 */
import { describe, it, expect } from 'vitest';
import { render, renderHook, waitFor, within, screen } from '@testing-library/react';
import { usePublicTournament } from '../usePublicTournament';
import { createRpcPublicSource } from '../rpcPublicSource';
import { PublicStandingsTab } from '../components/PublicStandingsTab';
import type { StandStorage } from '../publicStandStore';
import {
  mitStrafstossNord, NORD, serverAntwort, SHARE_CODE_ENTSCHEIDUNG, SUED, turnierNordSued, type BasisInAntwort,
} from '../../../core/repositories/__tests__/publicEntscheidungKit';
import { teamNameIn } from '../../../core/standings/__tests__/tb4Kit';

function leererSpeicher(): StandStorage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

async function zuschauerTabelle(basis: BasisInAntwort, entschieden = true) {
  const turnier = entschieden ? mitStrafstossNord(turnierNordSued()) : turnierNordSued();
  const source = createRpcPublicSource({ call: () => Promise.resolve({ data: serverAntwort(turnier, basis), error: null }) });
  const { result } = renderHook(() => usePublicTournament(SHARE_CODE_ENTSCHEIDUNG, source, { storage: leererSpeicher() }));
  await waitFor(() => expect(result.current.loadingState).toBe('success'));
  return render(<PublicStandingsTab tournament={result.current.tournament!} standings={result.current.standings} />);
}

const marken = (container: Element): string[] =>
  [...container.querySelectorAll('[data-testid="public-tie-mark"]')].map((m) => m.getAttribute('data-kind') ?? '');

/** Desktop-Tabelle (9 Zellen je Zeile): Platzziffer und Teamname. */
function zeilen(): Array<[string, string]> {
  return screen.getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('cell').length === 9)
    .map((row) => {
      const cells = within(row).getAllByRole('cell');
      return [cells[0].textContent?.trim() ?? '', teamNameIn(cells[1].textContent?.trim() ?? '')] as [string, string];
    });
}

describe('@W2A-059 @ZM-180 Zuschauer-Tabelle nach dem Strafstoßschießen (Server-Antwort public_tournament)', () => {
  it('@W2A-059 @ET-055 nach Strafstoßschießen 4:3: FC Nord Platz 1, SV Süd Platz 2, keine Markierung', async () => {
    const { container } = await zuschauerTabelle({ art: 'gespeichert' });
    expect(zeilen().slice(0, 2)).toEqual([['1', NORD], ['2', SUED]]);
    expect(marken(container)).toEqual([]);
  });

  it('vor der Entscheidung: beide auf Platz 1 mit „Strafstoß folgt“ (Platz 1 wird ausgespielt)', async () => {
    const { container } = await zuschauerTabelle({ art: 'gespeichert' }, false);
    expect(zeilen().slice(0, 2).map(([platz]) => platz)).toEqual(['1', '1']);
    expect(new Set(marken(container))).toEqual(new Set(['follows']));
  });

  it('Gegenprobe: Grundlage leer (Fassung 20261117_104) – die Markierung bleibt, beide auf Platz 1', async () => {
    const { container } = await zuschauerTabelle({ art: 'leer' });
    expect(zeilen().slice(0, 2).map(([platz]) => platz)).toEqual(['1', '1']);
    expect(new Set(marken(container))).toEqual(new Set(['follows']));
  });

  it('Gegenprobe: veraltete Grundlage (anderer Stand) – die Entscheidung gilt nicht, die Markierung bleibt', async () => {
    const veraltet = JSON.stringify({ points: [3, 1, 0], criteria: ['points'], matches: [] });
    const { container } = await zuschauerTabelle({ art: 'anders', basis: veraltet });
    expect(new Set(marken(container))).toEqual(new Set(['follows']));
  });
});
