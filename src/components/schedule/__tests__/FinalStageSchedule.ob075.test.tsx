/**
 * @OB-075 Kurzform „SR“/„Ref“ im Kopf einer Tabellenspalte, mit ausgeschriebenem Begriff als Hinweis (title) und für Screenreader -- auch in der
 * Tabelle der Finalrunde (vorher stand dort „Schiedsrichter“ ausgeschrieben, anders als in den übrigen Tabellen).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { createRealI18n, type RealLanguage } from '../../../test/realI18n';
import { FinalStageSchedule } from '../FinalStageSchedule';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const MITTE = testUuid(2);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: MITTE, name: 'SG Mitte' }];
const start = new Date('2026-11-14T14:20:00');
const halbfinale: ScheduledMatch = {
  id: testUuid(101), matchNumber: 11, time: '14:20', field: 1, homeTeam: 'ALT', awayTeam: 'ALT', originalTeamA: NORD, originalTeamB: MITTE,
  slotA: teamSlot(NORD), slotB: teamSlot(MITTE), label: '1. Halbfinale', phase: 'semifinal', isFinal: true, startTime: start, endTime: start, duration: 10,
};

async function kopf(lng: RealLanguage, mitSchiedsrichtern: boolean) {
  const i18n = await createRealI18n(lng);
  const { container } = render(
    <I18nextProvider i18n={i18n}>
      <FinalStageSchedule
        matches={[halbfinale]} tournament={{ teams }}
        refereeConfig={mitSchiedsrichtern ? { mode: 'organizer', numberOfReferees: 2 } : undefined}
      />
    </I18nextProvider>,
  );
  const zellen = Array.from(container.querySelectorAll('.desktop-view table thead th'));
  const zelle = zellen.find((th) => th.querySelector('[data-short-term="referee"]') !== null) ?? null;
  return { zelle, kopfText: zellen.map((th) => th.textContent).join('|') };
}

describe('@OB-075 Spaltenkopf Schiedsrichter in der Finalrunde', () => {
  it.each([['de', 'SR', 'Schiedsrichter'], ['en', 'Ref', 'Referee']] as const)('%s: sichtbar „%s“, mit title „%s“ und dem ausgeschriebenen Begriff für Screenreader', async (lng, kurz, lang) => {
    const { zelle } = await kopf(lng, true);
    expect(zelle).not.toBeNull();
    const sichtbar = zelle!.querySelector('[aria-hidden="true"]');
    expect(sichtbar).toHaveTextContent(kurz);
    expect(sichtbar).toHaveAttribute('title', lang);
    expect(zelle!.textContent).toBe(kurz + lang); // Kurzform + Vorlesetext
  });

  it('Gegenbeispiel: ohne Schiedsrichter-Einstellung gibt es die Spalte nicht', async () => {
    const { zelle, kopfText } = await kopf('de', false);
    expect(zelle).toBeNull();
    expect(kopfText).not.toMatch(/SR|Schiedsrichter/);
  });
});
