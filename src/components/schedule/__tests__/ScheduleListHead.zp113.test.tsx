/**
 * @ZP-113 Listenkopf über den Spielen der Turnierleitung: „Spiele · Beginn 09:00 Uhr · Ende etwa 11:30 Uhr“. Die Uhrzeiten sind die Wanduhr des
 * Turniers (nie die Gerätezeit): gleich in jeder Zeitzone des Geräts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../test/realDeI18n';
import { ScheduleListHead, type ScheduleListHeadProps } from '../ScheduleListHead';

await initRealDeI18n();

const schedule = (start: string, end: string, minuten?: number): ScheduleListHeadProps['schedule'] => ({
  phases: minuten === undefined ? [] : [{ name: 'groupStage' as const, matches: [{ duration: minuten }] }],
  startTime: new Date(`2026-12-06T${start}:00`),
  endTime: new Date(`2026-12-06T${end}:00`),
  tournament: { id: 't', title: 'Nikolaus-Turnier', date: '2026-12-06', location: { name: 'Halle' }, ageClass: 'U11' },
} as unknown as ScheduleListHeadProps['schedule']);

describe.each(['UTC', 'Europe/Berlin', 'America/New_York', 'Pacific/Auckland'])('@ZP-113 Listenkopf, Gerät in %s', (zone) => {
  const alt = process.env.TZ;
  beforeEach(() => { process.env.TZ = zone; });
  afterEach(() => { if (alt === undefined) { delete process.env.TZ; } else { process.env.TZ = alt; } });

  it('@ZP-113 „Spiele“ links, „Beginn 09:00 Uhr · Ende etwa 11:30 Uhr“ rechts (Wanduhr des Turniers, nicht der Gerätezeit)', () => {
    render(<ScheduleListHead schedule={schedule('09:00', '11:30')} />);
    expect(screen.getByRole('heading', { name: 'Spiele' })).toBeTruthy();
    expect(screen.getByTestId('schedule-list-times')).toHaveTextContent(/^Beginn 09:00 Uhr · Ende etwa 11:30 Uhr$/);
  });

  it('@ZP-113 Gegenbeispiel: ein anderes Turnier zeigt seine eigenen Zeiten, nie feste', () => {
    render(<ScheduleListHead schedule={schedule('13:52', '18:04')} />);
    expect(screen.getByTestId('schedule-list-times')).toHaveTextContent(/^Beginn 13:52 Uhr · Ende etwa 18:04 Uhr$/);
  });

  it('@ZP-113 die Spielzeit steht in der Kopfzeile: „9 Minuten je Spiel“; Gegenbeispiel: eine Minute in der Einzahl „1 Minute je Spiel“', () => {
    const { unmount } = render(<ScheduleListHead schedule={schedule('09:00', '11:30', 9)} />);
    expect(screen.getByTestId('schedule-list-duration')).toHaveTextContent(/^9 Minuten je Spiel$/);
    expect(screen.getByTestId('schedule-list-times')).toHaveTextContent(/^Beginn 09:00 Uhr · Ende etwa 11:30 Uhr$/);
    unmount();
    render(<ScheduleListHead schedule={schedule('09:00', '11:30', 1)} />);
    expect(screen.getByTestId('schedule-list-duration')).toHaveTextContent(/^1 Minute je Spiel$/);
  });

  it('@ZP-113 Gegenbeispiel: ohne bekannte Spielzeit steht keine Angabe „je Spiel“ (nie „0 Minuten“)', () => {
    render(<ScheduleListHead schedule={schedule('09:00', '11:30')} />);
    expect(screen.queryByTestId('schedule-list-duration')).toBeNull();
  });

  it('@ZP-113 Trenner kommen aus dem Stylesheet: im Text steht kein loser „ · “ zwischen den Angaben, jede Angabe ist ein eigener Block', () => {
    const { container } = render(<ScheduleListHead schedule={schedule('09:00', '11:30', 10)} />);
    const zeiten = screen.getByTestId('schedule-list-times');
    const dauer = screen.getByTestId('schedule-list-duration');
    expect(zeiten.parentElement).toBe(dauer.parentElement);
    const knoten = Array.from(zeiten.parentElement!.childNodes);
    expect(knoten.every((n) => n.nodeType === Node.ELEMENT_NODE)).toBe(true);
    // Das einzige „·“ im Text steht innerhalb der Angabe „Beginn … · Ende etwa …“, nie dazwischen
    expect((container.textContent ?? '').match(/·/g)).toHaveLength(1);
  });
});
