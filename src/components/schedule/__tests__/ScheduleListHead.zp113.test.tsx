/**
 * @ZP-113 Listenkopf über den Spielen der Turnierleitung: „Spiele · Beginn 09:00 Uhr · Ende etwa 11:30 Uhr“. Die Uhrzeiten sind die Wanduhr des
 * Turniers (nie die Gerätezeit): gleich in jeder Zeitzone des Geräts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../test/realDeI18n';
import { ScheduleListHead } from '../ScheduleListHead';

await initRealDeI18n();

const schedule = (start: string, end: string) => ({
  startTime: new Date(`2026-12-06T${start}:00`),
  endTime: new Date(`2026-12-06T${end}:00`),
  tournament: { id: 't', title: 'Nikolaus-Turnier', date: '2026-12-06', location: { name: 'Halle' }, ageClass: 'U11' },
});

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
});
