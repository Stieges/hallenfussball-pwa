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
    expect(screen.getByTestId('schedule-list-start')).toHaveTextContent(/^Beginn \d{2}:\d{2} Uhr$/);
    expect(screen.getByTestId('schedule-list-end')).toHaveTextContent(/^Ende etwa \d{2}:\d{2} Uhr$/);
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

  describe('@ZP-113 Teilnehmer ohne Gruppen (jeder gegen jeden, z. B. Nikolausturnier mit 6 Teams)', () => {
    const ohneGruppen = generateFullSchedule(createMockTournament({
      teams: [1, 2, 3, 4, 5, 6].map((n) => ({ id: testUuid(60 + n), name: `Verein ${String(n)}` })), numberOfTeams: 6, numberOfGroups: 1, numberOfFields: 1, groupSystem: 'roundRobin',
    }));

    it('@ZP-113 eingeklappt „Teilnehmer (6)“, klappt mit einem Tipp auf und zeigt alle sechs Teams ohne Gruppenüberschrift', async () => {
      render(<ScheduleDisplay schedule={ohneGruppen} showTournamentHeader={false} participantsCollapsed showListHead />);
      const toggle = screen.getByTestId('public-participants-toggle');
      expect(toggle).toHaveTextContent('Teilnehmer (6)');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('public-participants-list')).toBeNull();
      await userEvent.click(toggle);
      const liste = screen.getByTestId('public-participants-list');
      for (let n = 1; n <= 6; n++) { expect(liste).toHaveTextContent(`Verein ${String(n)}`); }
      expect(screen.queryByRole('heading', { name: /Gruppe/ })).toBeNull();
    });

    it('@ZP-113 Gegenbeispiel: `showParticipants` aus (Zuschauer-Seite) zeigt auch ohne Gruppen keine Teilnehmerliste', () => {
      render(<ScheduleDisplay schedule={ohneGruppen} showParticipants={false} participantsCollapsed showListHead />);
      expect(screen.queryByTestId('public-participants-toggle')).toBeNull();
    });

    it('@ZP-113 Gegenbeispiel: ohne `participantsCollapsed` (Vorschau im Assistenten, Zuschauer-Seite) bleibt es ohne Gruppen bei keiner Teilnehmerliste wie bisher', () => {
      render(<ScheduleDisplay schedule={ohneGruppen} />);
      expect(screen.queryByTestId('public-participants-toggle')).toBeNull();
      expect(screen.queryByTestId('public-participants')).toBeNull();
    });
  });

  it('@ZP-113 der Innenabstand des Kopfs gilt nur in der Verwaltung: die Klasse `schedule-display--kopf` nur mit Listenkopf, nie !important für den Kopf, der übrige Spielplan behält seinen Abstand', () => {
    const { container, unmount } = render(<ScheduleDisplay schedule={schedule} showListHead />);
    const kopf = container.querySelector('.schedule-display');
    expect(kopf?.classList.contains('schedule-display--kopf')).toBe(true);
    expect((kopf as HTMLElement).style.padding).toBe('');
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const kopfRegeln = css.split('}').filter((r) => /\.schedule-display--kopf\s*\{/.test(r));
    expect(kopfRegeln.length).toBeGreaterThan(0);
    expect(kopfRegeln.every((r) => !r.includes('!important'))).toBe(true);
    expect(css).toContain('.schedule-display:not(.schedule-display--kopf)');
    unmount();
    const { container: andere } = render(<ScheduleDisplay schedule={schedule} />);
    const el = andere.querySelector<HTMLElement>('.schedule-display')!;
    expect(el.classList.contains('schedule-display--kopf')).toBe(false);
    expect(el.style.padding).not.toBe('');
  });
});
