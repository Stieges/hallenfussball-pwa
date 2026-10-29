/**
 * Paket TB, Task TB-4: Zuschauer-Seite „Tabellen“ je Gruppe nach BFV privat, Platzziffer aus der Rechnung, nur mit
 * der kurzen Markierung aus R5 (@W2A-059, siehe w2a059.zuschauerMarkierung.test.tsx; Szenarien @W2A-049 Zuschauer, @W2A-059, @W2A-047, @ET-055). Ganze Kette Turnier -> usePublicTournament ->
 * PublicStandingsTab -> GroupTables. Daten: Plan v2 Abschnitt 6.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { usePublicTournament } from '../usePublicTournament';
import { createLegacyPublicSource } from '../legacyPublicSource';
import { PublicStandingsTab } from '../components/PublicStandingsTab';
import { SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import { DATA, GD_FIRST_ORDER, NAME } from '../../../core/standings/__tests__/fixtures';
import { teamNameIn, zweiGruppenWaging } from '../../../core/standings/__tests__/tb4Kit';

async function zuschauerTabelle(tournament: Tournament) {
  const oeffentlich: Tournament = { ...tournament, shareCode: SHARE_CODE, isPublic: true, hideRankingsForPublic: false };
  const source = createLegacyPublicSource({ getByShareCode: vi.fn().mockResolvedValue(oeffentlich) });
  const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source));
  await waitFor(() => expect(result.current.loadingState).toBe('success'));
  return render(<PublicStandingsTab tournament={result.current.tournament!} standings={result.current.standings} />);
}

/** Zeilen der Desktop-Tabelle (9 Zellen): Platzziffer und Teamname. */
function zeilen(): Array<[string, string]> {
  return screen.getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('cell').length === 9)
    .map((row) => {
      const cells = within(row).getAllByRole('cell');
      return [cells[0].textContent?.trim() ?? '', teamNameIn(cells[1].textContent?.trim() ?? '')] as [string, string];
    });
}
const ziffer = (name: string): string[] => zeilen().filter(([, n]) => n === name).map(([z]) => z);

describe('TB-4 Zuschauer-Tabelle', () => {
  it('@W2A-049 Zuschauer: Gruppe A zeigt DJK Kammer vor TSV Waging rot; bei umgestellter Reihenfolge Waging rot zuerst', async () => {
    await zuschauerTabelle(zweiGruppenWaging(DATA.ET_056));
    expect(zeilen().slice(0, 2).map(([, name]) => name)).toEqual([NAME.K, NAME.R]);
  });

  it('@W2A-049 Gegenbeispiel Zuschauer: bei „Punkte, Tordifferenz, Tore, direkter Vergleich“ steht Waging rot vor Kammer', async () => {
    await zuschauerTabelle(zweiGruppenWaging(DATA.ET_056, { placementLogic: GD_FIRST_ORDER }));
    expect(zeilen().slice(0, 2).map(([, name]) => name)).toEqual([NAME.R, NAME.K]);
  });

  it('@W2A-059 @ET-055 Zuschauer: offener Gleichstand zeigt dieselbe Platzziffer 3, 3, 5 und keinen Erklärtext der Leitung', async () => {
    const { container } = await zuschauerTabelle(zweiGruppenWaging(DATA.ET_055));
    expect([ziffer(NAME.R), ziffer(NAME.K), ziffer(NAME.N)]).toEqual([['3'], ['3'], ['5']]);
    expect(container.textContent ?? '').not.toMatch(/gleichauf|Entscheidung nötig|Strafstoßschießen/i);
    expect(container.querySelector('[data-testid="tie-marker"]')).toBeNull();
  });

  it('@W2A-059 @ET-055 Zuschauer auf dem Handy (schmale Tabelle): dieselbe Platzziffer 3, 3, 5; mitten in der Gruppe 2, 2, 4', async () => {
    /** Platzziffer in der schmalen Tabelle der ersten Gruppe; Teamnamen sind dort abgekürzt, daher nach dem Namensende gesucht. */
    const handyZiffer = (container: Element, ende: string): string[] => {
      const ansicht = container.querySelector<HTMLElement>('.mobile-view');
      if (ansicht === null) { throw new Error('schmale Tabelle fehlt'); }
      return within(ansicht).getAllByRole('row', { hidden: true })
        .map((row) => within(row).queryAllByRole('cell', { hidden: true }))
        .filter((cells) => cells.length > 1 && (cells[1].textContent ?? '').includes(ende))
        .map((cells) => (cells[0].textContent ?? '').trim());
    };
    const fertig = await zuschauerTabelle(zweiGruppenWaging(DATA.ET_055));
    expect([handyZiffer(fertig.container, 'Waging rot'), handyZiffer(fertig.container, 'Kammer'), handyZiffer(fertig.container, 'Nord')]).toEqual([['3'], ['3'], ['5']]);
    fertig.unmount();
    const offen = await zuschauerTabelle(zweiGruppenWaging(DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] }));
    expect([handyZiffer(offen.container, 'Waging rot'), handyZiffer(offen.container, 'Kammer'), handyZiffer(offen.container, 'Ufer')]).toEqual([['2'], ['2'], ['4']]);
  });

  it('@W2A-047 Gegenbeispiel Zuschauer: mitten in der Gruppe 2, 2, 4', async () => {
    await zuschauerTabelle(zweiGruppenWaging(DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] }));
    expect([ziffer(NAME.R), ziffer(NAME.K), ziffer(NAME.U)]).toEqual([['2'], ['2'], ['4']]);
  });
});
