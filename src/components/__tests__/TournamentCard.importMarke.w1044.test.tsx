/**
 * @W1-044 Die Marke „Import“ steht nur an Turnieren, deren Spielplan importiert wurde.
 * Gegenbeispiele: nur Teams importiert (auch bei schon gespeicherten Turnieren) und kein Import tragen keine Marke.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import { importMarkText, IMPORT_SOURCE_COMPLETE, IMPORT_SOURCE_TEAMS_ONLY } from '../../utils/importSource';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'de' } }),
}));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { TournamentCard } from '../TournamentCard';

const turnier = (extra: Partial<Tournament>): Tournament => ({
  id: 'x', title: 'Nikolausturnier – F2-Jugend', status: 'published', teams: [], matches: [{ id: 'm', matchStatus: 'scheduled' }],
  startDate: '2026-11-28', startTime: '08:30', location: { name: 'Halle' }, placementLogic: [], ...extra,
} as unknown as Tournament);

const zeige = (extra: Partial<Tournament>) => {
  render(<TournamentCard tournament={turnier(extra)} categoryLabel="upcoming" onClick={vi.fn()} />);
  return screen.queryByTestId('card-import-mark');
};

describe('@W1-044 Marke „Import“ auf der Turnierkarte', () => {
  it('Datei mit Spielplan: die Karte trägt die Marke', () => {
    const marke = zeige({ isExternal: true, externalSource: IMPORT_SOURCE_COMPLETE });
    expect(marke?.textContent).toBe('Import (komplett)');
  });

  it('Gegenbeispiel: nur Teams importiert, Spielplan im Assistenten erzeugt: keine Marke', () => {
    expect(zeige({ isExternal: true, externalSource: IMPORT_SOURCE_TEAMS_ONLY })).toBeNull();
  });

  it('Gegenbeispiel: auch im Satz für den Screenreader fehlt die Quelle ohne Marke', () => {
    zeige({ isExternal: true, externalSource: IMPORT_SOURCE_TEAMS_ONLY });
    expect(screen.getByTestId('tournament-card-x').querySelector('article')!.getAttribute('aria-label')).not.toContain('Import');
  });

  it('Gegenbeispiel: ohne Import keine Marke', () => {
    expect(zeige({})).toBeNull();
  });

  it('die Regel ändert keine Daten: das Turnier bleibt unverändert', () => {
    const t = turnier({ isExternal: true, externalSource: IMPORT_SOURCE_TEAMS_ONLY });
    const vorher = JSON.stringify(t);
    importMarkText(t);
    expect(JSON.stringify(t)).toBe(vorher);
  });
});
