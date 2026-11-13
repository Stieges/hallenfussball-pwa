/**
 * @ZP-113 Kopf des Spielplans der Turnierleitung: ohne Eckdaten-Karte mit acht Zeilen, mit Listenkopf „Spiele · Beginn … · Ende etwa …“ und eingeklappten
 * Teilnehmern „Teilnehmer (8)“. Gegenbeispiel: ohne die Schalter (Vorschau im Wizard, Zuschauer-Seite nach alter Art) bleibt alles wie bisher.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const teams: Team[] = ['A', 'B'].flatMap((group, g) => [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })));
const schedule = generateFullSchedule(createMockTournament({ teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'roundRobin' }));

describe('@ZP-113 Kopf des Spielplans (ScheduleDisplay)', () => {
  it('@ZP-113 Turnierleitung: keine Eckdaten-Karte, Listenkopf mit Beginn und Ende, Teilnehmer eingeklappt „Teilnehmer (8)“ und mit einem Tipp offen', async () => {
    render(<ScheduleDisplay schedule={schedule} showTournamentHeader={false} participantsCollapsed showListHead />);
    expect(screen.queryByText('Veranstaltungsort:')).toBeNull();
    expect(screen.queryByText(/Ende \(ca\.\)/)).toBeNull();
    expect(screen.getByTestId('schedule-list-head')).toBeTruthy();
    expect(screen.getByTestId('schedule-list-times')).toHaveTextContent(/^Beginn \d{2}:\d{2} Uhr · Ende etwa \d{2}:\d{2} Uhr$/);
    const toggle = screen.getByTestId('public-participants-toggle');
    expect(toggle).toHaveTextContent('Teilnehmer (8)');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('public-participants-list')).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('public-participants-list')).toHaveTextContent('Team A1');
  });

  it('@ZP-113 Gegenbeispiel: ohne die Schalter (Vorschau, alte Art) steht die Eckdaten-Karte mit allen Zeilen, die Teamlisten je Gruppe und kein Listenkopf', () => {
    render(<ScheduleDisplay schedule={schedule} />);
    expect(screen.getByText('Veranstaltungsort:')).toBeTruthy();
    expect(screen.getByText(/Ende \(ca\.\)/)).toBeTruthy();
    expect(screen.queryByTestId('schedule-list-head')).toBeNull();
    expect(screen.queryByTestId('public-participants-toggle')).toBeNull();
  });

  it('@ZP-113 Gegenbeispiel: `showParticipants` aus (Zuschauer-Seite) blendet die Teilnehmer auch mit `participantsCollapsed` aus', () => {
    render(<ScheduleDisplay schedule={schedule} showParticipants={false} participantsCollapsed showListHead />);
    expect(screen.queryByTestId('public-participants-toggle')).toBeNull();
  });

  it('@ZP-113 ohne Gruppen steht über den Spielen nur der Listenkopf „Spiele“, nicht zusätzlich die Überschrift „Spielplan“; Gegenbeispiele: mit Gruppen bleibt „Gruppenphase“, ohne Listenkopf bleibt „Spielplan“', () => {
    const einGruppe = generateFullSchedule(createMockTournament({
      teams: [1, 2, 3, 4].map((n) => ({ id: testUuid(50 + n), name: `Verein ${String(n)}` })), numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1, groupSystem: 'roundRobin',
    }));
    const { unmount } = render(<ScheduleDisplay schedule={einGruppe} showListHead />);
    expect(screen.getByRole('heading', { name: 'Spiele' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Spielplan' })).toBeNull();
    unmount();
    const { unmount: weg } = render(<ScheduleDisplay schedule={einGruppe} />);
    expect(screen.getByRole('heading', { name: 'Spielplan' })).toBeTruthy();
    weg();
    render(<ScheduleDisplay schedule={schedule} showListHead />);
    expect(screen.getByRole('heading', { name: 'Gruppenphase' })).toBeTruthy();
  });
});
