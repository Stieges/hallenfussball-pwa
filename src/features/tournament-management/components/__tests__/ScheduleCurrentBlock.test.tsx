/**
 * @ZP-109 Karte „Läuft / Nächstes Spiel“ oben im Spielplan der Turnierleitung (G3-N N1a). Erwartung aus dem Gherkin (Grundriss mit 5 Lagen
 * und den „Und“-Zeilen); Fixture „Hallencup Nord“ (zwei Felder): `fPAUSE` = Spiel 7 (Halbzeit) und Spiel 8 laufen, `fZEIT` = Spiele 1–8 beendet,
 * Spiel 9 um 14:40 ist das nächste. Echte DE-Texte, echte Ansicht (`buildTournamentView`), Rechte als Eingabe.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { buildTournamentView } from '../../../../core/view';
import { generateFullSchedule } from '../../../../core/generators';
import type { Tournament } from '../../../../types/tournament';
import { fPAUSE, fZEIT, GAME } from '../../../../core/view/__fixtures__/hallencupNord';
import { ScheduleCurrentBlock } from '../ScheduleCurrentBlock';

await initRealDeI18n();

const LEITUNG = { lead: true, play: true, schedule: true } as const;
const HELFER = { lead: false, play: true, schedule: false } as const;
const OHNE_RECHT = { lead: false, play: false, schedule: false } as const;

function zeige(tournament: Tournament, rights: { lead: boolean; play: boolean; schedule: boolean } = LEITUNG, handler: ((id: string) => void) | null = vi.fn()) {
  const onNavigateToCockpit = handler ?? undefined;
  const schedule = generateFullSchedule(tournament);
  const view = buildTournamentView(tournament, { audience: 'organizer', medium: 'app', locale: 'de' });
  const utils = render(
    <ScheduleCurrentBlock
      view={view} schedule={schedule} tournament={tournament} currentMatches={tournament.matches}
      elapsedSeconds={() => undefined} locale="de" rights={rights} onNavigateToCockpit={onNavigateToCockpit}
    />,
  );
  return { ...utils, view, onNavigateToCockpit };
}

const idOf = (t: Tournament, index: number): string => t.matches[index].id;
const meta = (id: string) => screen.getByTestId(`schedule-current-meta-${id}`);

describe('@ZP-109 Karte oben im Spielplan der Turnierleitung', () => {
  it('@ZP-109 Lage „Spiel läuft“: „Läuft · Spiel 7 · Feld n“ mit Stand-Kästen, Haupttaste „Zum Cockpit“; zwei laufende Spiele = zwei Karten', async () => {
    const { tournament } = await fPAUSE();
    const { view } = zeige(tournament);
    const live = view.current.live;
    expect(live.map((m) => m.matchNumber)).toEqual([7, 8]);
    expect(screen.getByTestId('schedule-current')).toHaveAttribute('data-current-kind', 'live');
    for (const mv of live) {
      expect(meta(mv.id)).toHaveTextContent(`Läuft · Spiel ${String(mv.matchNumber)} · Feld ${String(mv.field)}`);
      expect(screen.getByTestId(`schedule-current-cockpit-${mv.id}`)).toHaveTextContent(/^Zum Cockpit$/);
      expect(screen.getByTestId(`schedule-current-card-${mv.id}`)).toHaveAttribute('data-current-kind', 'live');
    }
    expect(screen.queryByText(/Nächstes Spiel/)).toBeNull();
  });

  it('@ZP-109 Lage „kein Spiel läuft, Spiel 9 ist das nächste“: „Nächstes Spiel · Spiel 9“ mit Anstoß, Haupttaste „Spiel im Cockpit anpfeifen“, keine Restzeit, kein „Danach“; die Kästen sind leer', async () => {
    const { tournament } = await fZEIT();
    const { view } = zeige(tournament);
    const next = view.current.next;
    expect(next?.matchNumber).toBe(9);
    const id = idOf(tournament, GAME[9]);
    expect(next?.id).toBe(id);
    expect(meta(id)).toHaveTextContent(`Nächstes Spiel · Spiel 9 · Feld ${String(next?.field)}`);
    expect(screen.getByTestId(`schedule-current-time-${id}`)).toHaveTextContent(/^14:40 Uhr$/);
    expect(screen.getByTestId(`schedule-current-cockpit-${id}`)).toHaveTextContent(/^Spiel im Cockpit anpfeifen$/);
    expect(screen.getByText('Öffnet das Cockpit. Die Uhr startest du dort.')).toBeTruthy();
    expect(screen.queryByTestId(`schedule-current-clock-${id}-area`)).toBeNull();
    expect(screen.queryByTestId(`schedule-current-after-${id}`)).toBeNull();
    // Mockup Runde 4: beim nächsten Spiel stehen leere Kästen, kein „0“ (anders als beim Zuschauer, @ZM-195)
    for (const seite of ['home', 'away']) {
      const kasten = screen.getByTestId(`match-box-kopf-${id}-${seite}`);
      expect(kasten.textContent).not.toMatch(/\d/);
    }
  });

  it('@ZP-109 Lage „Spiel 7 ist in der Halbzeit“: die Karte wie bei einem laufenden Spiel, Spiel 7 gilt nie als nächstes (@ZM-041)', async () => {
    const { tournament } = await fPAUSE();
    zeige(tournament);
    const id7 = idOf(tournament, GAME[7]);
    expect(screen.getByTestId(`schedule-current-card-${id7}`)).toHaveAttribute('data-current-kind', 'live');
    expect(meta(id7)).toHaveTextContent(/^Läuft · Spiel 7/);
    expect(screen.getByTestId('schedule-current')).not.toHaveAttribute('data-current-kind', 'next');
  });

  it('@ZP-109 „Danach“ nennt bei zwei Feldern das nächste Spiel DESSELBEN Felds, nie das laufende selbst', async () => {
    const { tournament } = await fPAUSE();
    const { view } = zeige(tournament);
    for (const mv of view.current.live) {
      // Erwartung unabhängig von der Ansicht gerechnet: frühestes noch nicht angepfiffenes Spiel desselben Felds
      const expected = tournament.matches
        .filter((m) => m.field === mv.field && m.matchStatus === 'scheduled' && m.id !== mv.id)
        .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))[0];
      const after = screen.getByTestId(`schedule-current-after-${mv.id}`);
      expect(after).toHaveTextContent(`Danach: Spiel ${String(expected.matchNumber)}`);
      expect(after.textContent).not.toContain(`Spiel ${String(mv.matchNumber)} ·`);
    }
  });

  it('@ZP-109 Gegenbeispiel: läuft das letzte Spiel seines Felds, steht keine „Danach“-Zeile', async () => {
    const { tournament } = await fPAUSE();
    const live = buildTournamentView(tournament, { audience: 'organizer', medium: 'app', locale: 'de' }).current.live[0];
    const matches = tournament.matches.map((m) => (m.field === live.field && m.id !== live.id && m.matchStatus === 'scheduled' ? { ...m, matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 } : m));
    zeige({ ...tournament, matches });
    expect(screen.queryByTestId(`schedule-current-after-${live.id}`)).toBeNull();
  });

  it('@ZP-109 Helfer sieht als Taste nur „Zum Cockpit“ (auch beim geplanten Spiel); ohne Recht steht keine Taste', async () => {
    const { tournament } = await fZEIT();
    const id = idOf(tournament, GAME[9]);
    const { unmount } = zeige(tournament, HELFER);
    expect(screen.getByTestId(`schedule-current-cockpit-${id}`)).toHaveTextContent(/^Zum Cockpit$/);
    expect(screen.queryByText(/anpfeifen/)).toBeNull();
    unmount();
    zeige(tournament, OHNE_RECHT);
    expect(screen.queryByTestId(`schedule-current-cockpit-${id}`)).toBeNull();
    expect(screen.getByTestId(`schedule-current-card-${id}`)).toBeTruthy(); // die Karte bleibt, nur ohne Taste
  });

  it('@ZP-109 Gegenbeispiel: ohne Handler fürs Cockpit steht keine Taste (kein stummer Knopf)', async () => {
    const { tournament } = await fZEIT();
    zeige(tournament, LEITUNG, null);
    expect(screen.queryByTestId(`schedule-current-cockpit-${idOf(tournament, GAME[9])}`)).toBeNull();
  });

  it('@ZP-109 die Haupttaste ruft den Handler mit der Spiel-Kennung', async () => {
    const { tournament } = await fZEIT();
    const { onNavigateToCockpit } = zeige(tournament);
    await userEvent.click(screen.getByTestId(`schedule-current-cockpit-${idOf(tournament, GAME[9])}`));
    expect(onNavigateToCockpit).toHaveBeenCalledWith(idOf(tournament, GAME[9]));
  });

  it('@ZP-109 Lage „alle Spiele beendet“: keine Karte', async () => {
    const { tournament } = await fZEIT();
    const alle = { ...tournament, matches: tournament.matches.map((m) => ({ ...m, matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 })) };
    zeige(alle);
    expect(screen.queryByTestId('schedule-current')).toBeNull();
  });
});
