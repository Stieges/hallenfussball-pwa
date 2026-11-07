/**
 * @DR-048 Z. 3 „Als PDF“ in der Endstand-Ansicht (Reiter „Tabellen“): über dem gespeicherten Endstand steht der Knopf für
 * Turnierleitung, Co-Admin und Helfer (@DR-048 Z. 5 seit Daniel 07.11.; Recht writeMatchData aus rolePermissions.json, nach dem Abschluss
 * offen); wer im Turnier keine solche Rolle hat (Trainer, Zuschauer-Konto), bekommt ihn nicht. Ein Tipp öffnet den PDF-Dialog mit vorgewähltem „Endstand“. Das Recht kommt aus der echten Rechte-Datei
 * (`hasPermission`), nur die Rolle ist vorgegeben.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import deTournament from '../../../i18n/locales/de/tournament.json';
import { hallencupSchedule, hallencupTournament, HALLENCUP_TEAMS } from '../../../lib/pdf/__tests__/pdfFixture';
import type { TournamentRole } from '../../auth/types/auth.types';

vi.unmock('i18next');
vi.unmock('react-i18next');
let role: TournamentRole = 'owner';
vi.mock('../../auth/hooks/useCan', async () => {
  const { hasPermission } = await import('../../auth/utils/permissions');
  return { useCan: (permission: Parameters<typeof hasPermission>[1]) => hasPermission(role, permission) };
});
const finishedAt = new Date(2026, 10, 14, 17, 40).toISOString();
const snapshot = {
  format: 1 as const,
  ranking: HALLENCUP_TEAMS.map((team, i) => ({ place: i + 1, teamId: team.id, teamName: team.name, origin: { kind: 'groupPlace' as const, group: team.group ?? '', place: 1 } })),
  scorers: [], appVersion: 'test', computedAt: finishedAt,
};
vi.mock('../../../core/repositories/storedFinalStandingsRead', () => ({ readStoredFinalStandings: () => Promise.resolve({ status: 'ok', snapshot, finishedAt }) }));
vi.mock('../hooks/useProvisionalScorers', () => ({ useProvisionalScorers: () => ({ scorers: [], incomplete: false }) }));

const i18next = (await import('i18next')).default;
const { initReactI18next } = await import('react-i18next');
const { FinalStandingsPanel } = await import('../components/FinalStandingsPanel');

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'de', fallbackLng: 'de', defaultNS: 'tournament', ns: ['tournament'],
    resources: { de: { tournament: deTournament } }, interpolation: { escapeValue: false },
  });
});
beforeEach(() => { role = 'owner'; });

const tournament = hallencupTournament({ lifecycleStatus: 'finished', finishedAt });
const panel = () => render(<MemoryRouter><FinalStandingsPanel tournament={tournament} schedule={hallencupSchedule(tournament)} standings={[]} /></MemoryRouter>);

describe('@DR-048 Z. 3 „Als PDF“ in der Endstand-Ansicht', () => {
  for (const [who, name] of [['owner', 'Olli (Turnierleitung)'], ['co-admin', 'Maria (Co-Admin)'], ['helper', 'Tom (Helfer-Zugang)'], ['collaborator', 'Tom (Helfer mit Konto)']] as const) {
    it(`${name}: „Als PDF“ steht über dem gespeicherten Endstand; ein Tipp öffnet den Dialog mit „Endstand“ vorgewählt`, async () => {
      role = who;
      panel();
      fireEvent.click(await screen.findByTestId('final-standings-pdf'));
      await waitFor(() => expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-checked', 'true'));
      expect(screen.getByTestId('pdf-save')).not.toBeDisabled();
    });
  }

  for (const who of ['trainer', 'viewer'] as const) {
    it(`Gegenbeispiel ohne Rolle im Spielbetrieb (${who}): kein „Als PDF“ in der Endstand-Ansicht`, async () => {
      role = who;
      panel();
      await screen.findByTestId('final-standings-list');
      expect(screen.queryByTestId('final-standings-pdf')).toBeNull();
    });
  }
});
