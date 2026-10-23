/**
 * A-36c Fixrunde 2 (C-SPIELPLAN-SCHWEBETASTEN, öffentliche Variante): @OB-021 „kein Element überlappt ein anderes“,
 * @OB-022. Der Teilen-Knopf der öffentlichen Seite `/public/:id` steht im Fluss unter dem Spielplan und schwebt nie über
 * einer Spielkarte (er verdeckte den Stand der letzten Karte). Die Leiste der Verwaltung bleibt wie bei SK.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

import { generateFullSchedule } from '../../core/generators';
import { createMockTournament } from '../../test/factories';
import { ScheduleActionButtons } from '../ScheduleActionButtons';

const tournament = createMockTournament({ id: 'oeffentlich', isPublic: true, shareCode: 'ABC123' });
const schedule = generateFullSchedule(tournament);

function leiste(variant: 'public' | 'organizer') {
  const { container } = render(
    <MemoryRouter><ScheduleActionButtons tournament={tournament} schedule={schedule} standings={[]} variant={variant} /></MemoryRouter>,
  );
  return {
    bar: container.querySelector<HTMLElement>('.schedule-action-buttons')!,
    stile: Array.from(container.querySelectorAll('style')).map((s) => s.textContent).join('\n'),
  };
}

describe('Teilen-Knopf überlappt keine Spielkarte (@OB-021 @OB-022)', () => {
  it('@OB-021 öffentliche Variante: der Knopf steht im Fluss, nicht „fixed“ (weder inline noch per Stilregel)', () => {
    const { bar, stile } = leiste('public');
    expect(bar.textContent).toContain('Teilen');
    expect(bar.style.position).not.toBe('fixed');
    expect(stile).not.toMatch(/position:\s*fixed/);
  });

  it('@OB-021 Gegenbeispiel: die Leiste der Verwaltung bleibt unverändert (Mobil schwebend, Platz reserviert über die Karte)', () => {
    const { stile } = leiste('organizer');
    expect(stile).toMatch(/position:\s*fixed/);
  });
});
