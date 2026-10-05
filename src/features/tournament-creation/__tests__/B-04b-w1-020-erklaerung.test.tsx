/**
 * B-04 Paket b — @W1-020: Vor dem Festlegen wird erklärt, was passiert.
 *
 * Gegeben ein vollständiges Turnier vor dem Festlegen
 * Wenn die Turnierleitung die Taste „Festlegen“ sieht
 * Dann steht darüber in einem Satz, dass der Spielplan fest wird
 *     und wer das Turnier danach sehen kann
 *
 * Echter Bedienweg: Übersicht vor dem Festlegen rendern (TournamentPreview,
 * Schritt 6 des Wizards — die Taste „Festlegen“ (`publish.button`) steht dort).
 * UI-Ort: src/features/tournament-creation/TournamentPreview.tsx —
 * `publish-explanation` unmittelbar über `preview-publish` im selben Container.
 *
 * Sichtbarkeit aus der vorhandenen Einstellung `isPublic` (admin › Sichtbarkeit:
 * „Privat“ vs. „Mit Link teilbar“) — keine erfundenen Werte.
 * Mutation: Satz entfernen oder Sichtbarkeit fest verdrahten → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import deWizard from '../../../i18n/locales/de/wizard.json';
import enWizard from '../../../i18n/locales/en/wizard.json';

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: vi.fn(),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: () => <div data-testid="schedule-display-stub" />,
}));

vi.mock('../../../components/RefereeAssignmentEditor', () => ({
  RefereeAssignmentEditor: () => <div data-testid="referee-editor-stub" />,
}));

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

import { TournamentPreview } from '../TournamentPreview';

const baseTournament = (isPublic: boolean): Tournament =>
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
    isPublic,
    teams: [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ],
    matches: [],
    status: 'draft',
    location: { name: 'Halle' },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }) as unknown as Tournament;

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

const renderPreview = (isPublic: boolean) =>
  render(
    <TournamentPreview
      tournament={baseTournament(isPublic)}
      schedule={schedule}
      onEdit={() => undefined}
      onPublish={() => undefined}
    />
  );

describe('B-04b @W1-020 – Vor dem Festlegen wird erklärt, was passiert', () => {
  it('Erklärung „privat“ steht unmittelbar vor dem Festlegen-Knopf im selben Container', () => {
    renderPreview(false);

    const hint = screen.getByTestId('publish-explanation');
    const publishButton = screen.getByTestId('preview-publish');
    expect(hint.parentElement).toBe(publishButton.parentElement);
    expect(
      hint.compareDocumentPosition(publishButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(hint).toHaveTextContent('wizard:publish.explanationPrivate');
  });

  it('Sichtbarkeit „Mit Link teilbar“: anderer Satz, sonst gleiche Stelle', () => {
    renderPreview(true);

    const hint = screen.getByTestId('publish-explanation');
    const publishButton = screen.getByTestId('preview-publish');
    expect(hint.parentElement).toBe(publishButton.parentElement);
    expect(
      hint.compareDocumentPosition(publishButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(hint).toHaveTextContent('wizard:publish.explanationPublic');
  });

  it('DE/EN: der Satz nennt den festen Spielplan und die Sichtbarkeit nach dem Festlegen', () => {
    for (const wizard of [deWizard, enWizard]) {
      expect(wizard.publish.explanationPrivate).not.toBe(wizard.publish.explanationPublic);
    }
    expect(deWizard.publish.explanationPrivate).toMatch(/Spielplan/);
    expect(deWizard.publish.explanationPrivate).toMatch(/Turnierleitung/);
    expect(deWizard.publish.explanationPublic).toMatch(/Spielplan/);
    expect(deWizard.publish.explanationPublic).toMatch(/Link/);
    expect(enWizard.publish.explanationPrivate).toMatch(/schedule/);
    expect(enWizard.publish.explanationPrivate).toMatch(/director/i);
    expect(enWizard.publish.explanationPublic).toMatch(/schedule/);
    expect(enWizard.publish.explanationPublic).toMatch(/link/);
  });
});
