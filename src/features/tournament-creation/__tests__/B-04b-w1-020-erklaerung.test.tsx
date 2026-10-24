/**
 * B-04b Fixrunde 1 — @W1-020: Der Satz sagt, was publish() tatsächlich tut.
 *
 * Gegeben ein vollständiges Turnier vor dem Festlegen
 * Wenn die Turnierleitung die Taste „Festlegen“ sieht
 * Dann steht darüber in einem Satz, wer das Turnier NACH dem Festlegen sehen
 *     kann, und dieser Satz stimmt mit dem überein, was publish() tut
 *
 * Echter Bedienweg: TournamentPreview (Schritt 6 — `publish-explanation`
 * unmittelbar über `preview-publish`) + echtes TournamentCreationService.publish()
 * mit Repository-Mock. Die Fallunterscheidung gibt es nur einmal:
 * visibilityAfterPublish(data) = !data.publishedAt || data.isPublic.
 * Beim ersten Festlegen (Entwurf ohne publishedAt, immer isPublic: false) zeigt
 * die Vorschau den Link-Satz — und publish() macht das Turnier per Link teilbar
 * (isPublic true + shareCode). Ein bereits festgelegtes privates Turnier zeigt
 * den Privat-Satz — und publish() lässt isPublic === false.
 *
 * Gegenbeispiel: publishedAt gesetzt + isPublic: false → Privat-Satz und
 * publish() lässt isPublic === false.
 * Mutation: Verzweigung zurück auf currentTournament.isPublic → Pflichttest rot.
 * In publish() `isPublic = true` beim ersten Festlegen entfernen → Pflichttest rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import {
  TournamentCreationService,
  visibilityAfterPublish,
} from '../../../core/services/TournamentCreationService';
import { AuthContext } from '../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../auth/context/authContextValue';
import deWizard from '../../../i18n/locales/de/wizard.json';
import enWizard from '../../../i18n/locales/en/wizard.json';

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: vi.fn(() => ({
    allMatches: [],
    initialStandings: [],
    endTime: new Date('2030-01-01T09:10:00Z'),
    numberOfFields: 1,
  })),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: () => <div data-testid="schedule-display-stub" />,
}));

vi.mock('../../../components/RefereeAssignmentEditor', () => ({
  RefereeAssignmentEditor: () => <div data-testid="referee-editor-stub" />,
}));

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

/** @W1-037: Olli ist angemeldet (Konto) und Supabase ist eingerichtet – nur dann kündigt der Satz den Link an. */
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true }));

import { TournamentPreview } from '../TournamentPreview';

const baseTournament = (overrides: Partial<Tournament> = {}): Tournament =>
  ({
    id: 't1',
    title: 'Test Cup',
    ageClass: 'U13',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'roundRobin',
    groupSystem: 'roundRobin',
    date: '2030-01-01',
    timeSlot: '09:00',
    startDate: '2030-01-01',
    startTime: '09:00',
    numberOfTeams: 2,
    numberOfFields: 1,
    numberOfGroups: 1,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10,
    finalRoundBreakDuration: 2,
    breakBetweenPhases: 0,
    isPublic: false,
    teams: [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ],
    matches: [],
    status: 'draft',
    location: { name: 'Halle' },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }) as unknown as Tournament;

/** Erster Festlegen: Entwurf ohne publishedAt (privat, wie jeder Entwurf). */
const ersterFestlegen = (): Tournament => baseTournament({ isPublic: false });

/** Bereits festgelegt und bewusst privat. */
const bereitsPrivat = (): Tournament =>
  baseTournament({ isPublic: false, publishedAt: '2025-06-01T10:00:00Z' });

const schedule = {
  allMatches: [
    {
      id: 'm1',
      field: 1,
      slot: 0,
      startTime: new Date('2030-01-01T09:00:00Z'),
      endTime: new Date('2030-01-01T09:10:00Z'),
      originalTeamA: '1',
      originalTeamB: '2',
      phase: 'groupStage',
    },
  ],
  initialStandings: [],
  endTime: new Date('2030-01-01T09:10:00Z'),
  numberOfFields: 1,
} as unknown as GeneratedSchedule;

const repositoryMock = (): ITournamentRepository => ({
  get: vi.fn(() => Promise.resolve(null)),
  getByShareCode: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve()),
  updateMatch: vi.fn(() => Promise.resolve()),
  updateMatches: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve()),
  listForCurrentUser: vi.fn(() => Promise.resolve([])),
  makeTournamentPublic: vi.fn(() => Promise.resolve(null)),
  makeTournamentPrivate: vi.fn(() => Promise.resolve()),
  regenerateShareCode: vi.fn(() => Promise.resolve(null)),
});

const renderPreview = (tournament: Tournament) =>
  render(
    <AuthContext.Provider value={{ user: { id: 'u1', email: 'o@example.org', name: 'Olli', globalRole: 'user' } } as unknown as AuthContextValue}>
      <TournamentPreview
        tournament={tournament}
        schedule={schedule}
        onEdit={() => undefined}
        onPublish={() => undefined}
      />
    </AuthContext.Provider>
  );

describe('B-04b @W1-020 – Der Satz sagt, was publish() tatsächlich tut', () => {
  it('Pflichttest: erster Festlegen kündigt den Link an und publish() macht das Turnier teilbar', async () => {
    const data = ersterFestlegen();
    renderPreview(data);

    const hint = screen.getByTestId('publish-explanation');
    const publishButton = screen.getByTestId('preview-publish');
    expect(hint.parentElement).toBe(publishButton.parentElement);
    expect(
      hint.compareDocumentPosition(publishButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const service = new TournamentCreationService(repositoryMock());
    const result = await service.publish(data);

    // Verknüpfung von angekündigtem Satz und Ergebnis über dieselbe Fallunterscheidung:
    // 'shareable' ↔ isPublic && shareCode
    const visibility = visibilityAfterPublish(data);
    expect(visibility).toBe('shareable');
    const announcedShareable = hint.textContent?.startsWith('wizard:publish.explanationPublic');
    const actuallyShareable = result.isPublic === true && Boolean(result.shareCode);
    expect(announcedShareable).toBe(visibility === 'shareable');
    expect(actuallyShareable).toBe(visibility === 'shareable');
    expect(result.isPublic).toBe(true);
    expect(result.shareCode).toBeTruthy();
  });

  it('Gegenbeispiel: bereits festgelegt und privat → Privat-Satz, publish() lässt isPublic === false', async () => {
    const data = bereitsPrivat();
    renderPreview(data);

    const hint = screen.getByTestId('publish-explanation');
    expect(hint.textContent).toContain('wizard:publish.explanationPrivate');

    const service = new TournamentCreationService(repositoryMock());
    const result = await service.publish(data);

    const visibility = visibilityAfterPublish(data);
    expect(visibility).toBe('private');
    const announcedShareable = hint.textContent?.startsWith('wizard:publish.explanationPublic');
    const actuallyShareable = result.isPublic === true && Boolean(result.shareCode);
    expect(announcedShareable).toBe(visibility === 'shareable');
    expect(actuallyShareable).toBe(visibility === 'shareable');
    expect(result.isPublic).toBe(false);
  });

  it('DE/EN: der Satz nennt den festen Spielplan und die Sichtbarkeit nach dem Festlegen', () => {
    for (const wizard of [deWizard, enWizard]) {
      expect(wizard.publish.explanationPrivate).not.toBe(wizard.publish.explanationPublic);
    }
    expect(deWizard.publish.explanationPrivate).toMatch(/Spielplan/);
    expect(deWizard.publish.explanationPrivate).toMatch(/Turnierleitung/);
    expect(deWizard.publish.explanationPrivate).not.toMatch(/eingeloggt/);
    expect(deWizard.publish.explanationPublic).toMatch(/Spielplan/);
    expect(deWizard.publish.explanationPublic).toMatch(/Link/);
    expect(enWizard.publish.explanationPrivate).toMatch(/schedule/);
    expect(enWizard.publish.explanationPrivate).toMatch(/director/i);
    expect(enWizard.publish.explanationPublic).toMatch(/schedule/);
    expect(enWizard.publish.explanationPublic).toMatch(/link/);
  });
});
