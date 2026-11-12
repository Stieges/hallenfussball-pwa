/**
 * @W3-028 Die Trikotfarbe eines Teams lässt sich auch am Turniertag eintragen (Verwaltung → Teams → „Trikotfarbe“).
 * Gherkin: docs/anforderungen/2026-09-27_wizard-turniertag-vorbereiten.md. Ganzer Weg ohne Server: der echte Teams-Reiter mit dem
 * echten Farbwähler schreibt in das Turnier, die Ansicht (`buildTournamentView`, gespeist aus dem geänderten Turnier) liefert die Kästen
 * für Cockpit, Spielplan, Zuschauer und Monitor.
 *  - Ab dem nächsten Spiel gilt die neue Farbe; laufende und beendete Spiele behalten die Farbe vom Anpfiff (`kit` am Spiel).
 *  - Ein Team ohne Farbe bekommt sie für sein nächstes Spiel (statt Streifenmuster).
 *  - Rechte: nur die Turnierleitung (`teams`) trägt Farben ein; Helfer nicht, ein abgeschlossenes Turnier auch nicht.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Match, Tournament } from '../../../types/tournament';
import { pendingSlot, teamSlot } from '../../../core/models/matchSlot';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'owner' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { setTournamentClosed, resetClosedTournaments } from '../../../core/services/closedTournaments';
import { buildTournamentView } from '../../../core/view/tournamentView';
import { TeamsTab } from '../TeamsTab';

await initRealDeI18n();

const ROT = '#C62828';
const WEISS = '#FFFFFF';
const GRUEN = '#2E7D32';
const GELB = '#FFCC00';
const BLAU = '#0033CC';
const SCHWARZ = '#000000';
const NORD = '00000000-0000-4000-8000-000000000001';
const SUED = '00000000-0000-4000-8000-000000000002';
const OST = '00000000-0000-4000-8000-000000000003';
const MITTE = '00000000-0000-4000-8000-000000000004';
const UFER = '00000000-0000-4000-8000-000000000005';

function spiel(id: string, nr: number, a: string, b: string, extra: Partial<Match> = {}): Match {
  return { id, matchNumber: nr, round: nr, field: 1, slotA: teamSlot(a), slotB: teamSlot(b), matchStatus: 'scheduled', ...extra };
}

/** Hallencup Nord läuft: Spiel 1 beendet, Spiel 2 läuft (beide mit Rot für FC Nord gespielt), Spiel 3 folgt; SG Mitte ohne Farbe, Spiel 4 folgt. */
function laufendesTurnier(): Tournament {
  return {
    id: 'hallencup-nord', title: 'Hallencup Nord', status: 'published', date: '2026-11-14', isPublic: true, shareCode: 'NORD26',
    teams: [
      { id: NORD, name: 'FC Nord', colors: { primary: ROT } }, { id: SUED, name: 'SV Süd', colors: { primary: GRUEN } },
      { id: OST, name: 'TSV Ost', colors: { primary: WEISS } }, { id: MITTE, name: 'SG Mitte' }, { id: UFER, name: 'VfB Ufer', colors: { primary: GELB } },
    ],
    matches: [
      spiel('s1', 1, NORD, SUED, { matchStatus: 'finished', scoreA: 2, scoreB: 1, kit: { a: ROT, b: GRUEN } }),
      spiel('s2', 2, NORD, OST, { matchStatus: 'running', scoreA: 0, scoreB: 0, kit: { a: ROT, b: WEISS } }),
      spiel('s3', 3, NORD, SUED, {}),
      spiel('s4', 4, MITTE, UFER, { field: 2 }),
      { ...spiel('s5', 5, NORD, OST), slotB: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }) },
    ],
  } as unknown as Tournament;
}

/** Der Teams-Reiter mit lebendigem Turnier: was er speichert, steht danach in `tournament`; die Ansicht liest daraus (wie Cockpit, Spielplan, Zuschauer, Monitor). */
let aktuell: Tournament = laufendesTurnier();
const gespeichert = vi.fn<(t: Tournament) => void>();
function Verwaltung({ start }: { start: Tournament }) {
  const [turnier, setzeTurnier] = useState(start);
  return <TeamsTab tournament={turnier} onTournamentUpdate={(t) => { gespeichert(t); aktuell = t; setzeTurnier(t); }} />;
}

const screenView = { audience: 'screen', medium: 'app', locale: 'de' } as const;
const kasten = (spielId: string) => buildTournamentView({
  teams: aktuell.teams, matches: aktuell.matches, date: aktuell.date, hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: true, shareCode: 'NORD26',
}, screenView).byId.get(spielId)?.boxes;

async function farbeEintragen(teamId: string, hex: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByTestId(`team-expand-toggle-${teamId}`));
  const karte = screen.getByTestId(`team-card-${teamId}`);
  await user.click(within(karte).getByRole('button', { name: /^#[0-9A-F]{6}/i })); // Auslöser des Farbwählers (zeigt die aktuelle Farbe)
  await user.click(screen.getByRole('option', { name: `Farbe ${hex}` }));
}

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); role.current = 'owner'; aktuell = laufendesTurnier(); });
afterEach(() => { resetClosedTournaments(); });

describe('@W3-028 Trikotfarbe am Turniertag eintragen', () => {
  it('@W3-028 FC Nord (Rot) spielt gerade, Olli trägt Blau ein: Spiel 2 (läuft) und Spiel 1 (beendet) bleiben Rot, Spiel 3 und das Spiel mit offener Seite zeigen Blau', async () => {
    render(<Verwaltung start={laufendesTurnier()} />);
    expect(kasten('s3')?.home.fill).toEqual({ kind: 'solid', color: ROT }); // vorher
    await farbeEintragen(NORD, BLAU);
    expect(gespeichert).toHaveBeenCalledTimes(1);
    expect(aktuell.teams.find((t) => t.id === NORD)?.colors?.primary).toBe(BLAU);
    expect(kasten('s2')?.home.fill).toEqual({ kind: 'solid', color: ROT }); // läuft: Farbe vom Anpfiff
    expect(kasten('s2')?.away.fill).toEqual({ kind: 'solid', color: WEISS });
    expect(kasten('s1')?.home.fill).toEqual({ kind: 'solid', color: ROT }); // beendet: bleibt
    expect(kasten('s3')?.home.fill).toEqual({ kind: 'solid', color: BLAU }); // nächstes Spiel: neu
    expect(kasten('s5')?.home.fill).toEqual({ kind: 'solid', color: BLAU }); // spätere Spiele auch
  });

  it('@W3-028 die Änderung rührt Stand, Ergebnis und Farbe der laufenden und beendeten Spiele nicht an', async () => {
    const vorher = laufendesTurnier();
    render(<Verwaltung start={vorher} />);
    await farbeEintragen(NORD, BLAU);
    const nachher = gespeichert.mock.calls[0][0];
    expect(nachher.matches).toEqual(vorher.matches); // nur colors des Teams ist anders
    expect(nachher.teams.filter((t) => t.id !== NORD)).toEqual(vorher.teams.filter((t) => t.id !== NORD));
  });

  it('@W3-028 SG Mitte hat keine Farbe und spielt nicht: Olli trägt Schwarz ein, Spiel 4 zeigt Schwarz statt Streifenmuster', async () => {
    render(<Verwaltung start={laufendesTurnier()} />);
    expect(kasten('s4')?.home.fill.kind).toBe('striped');
    await farbeEintragen(MITTE, SCHWARZ);
    expect(kasten('s4')?.home.fill).toEqual({ kind: 'solid', color: SCHWARZ });
    expect(kasten('s4')?.away.fill).toEqual({ kind: 'solid', color: GELB });
  });

  it('@W3-028 Gegenbeispiel: eine zweite Änderung (Blau → Weiß) bei laufendem Spiel verändert das laufende Spiel weiterhin nicht', async () => {
    render(<Verwaltung start={laufendesTurnier()} />);
    await farbeEintragen(NORD, BLAU);
    const user = userEvent.setup();
    await user.click(within(screen.getByTestId(`team-card-${NORD}`)).getByRole('button', { name: /^#0033CC/i }));
    await user.click(screen.getByRole('option', { name: `Farbe ${WEISS}` }));
    expect(kasten('s2')?.home.fill).toEqual({ kind: 'solid', color: ROT });
    expect(kasten('s3')?.home.fill).toEqual({ kind: 'solid', color: WEISS });
  });
});

describe('@W3-028 Rechte: wer Farben eintragen darf', () => {
  const farbwaehler = (teamId: string) => within(screen.getByTestId(`team-card-${teamId}`)).queryByRole('button', { name: /^#[0-9A-F]{6}/i });

  it('Turnierleitung (Besitzer) sieht den Farbwähler, auch wenn das Turnier läuft', async () => {
    render(<Verwaltung start={laufendesTurnier()} />);
    await userEvent.setup().click(screen.getByTestId(`team-expand-toggle-${NORD}`));
    expect(farbwaehler(NORD)).toBeInTheDocument();
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
  });

  it('Helfer (Tom) sieht keinen Farbwähler: „Ändern nur durch die Turnierleitung“', async () => {
    role.current = 'collaborator';
    render(<Verwaltung start={laufendesTurnier()} />);
    expect(screen.getByTestId('lead-only-hint')).toHaveTextContent('Ändern nur durch die Turnierleitung');
    await userEvent.setup().click(screen.getByTestId(`team-expand-toggle-${NORD}`));
    expect(farbwaehler(NORD)).not.toBeInTheDocument();
  });

  it('abgeschlossenes Turnier: kein Farbwähler, Hinweis „abgeschlossen“', async () => {
    setTournamentClosed('hallencup-nord', true);
    render(<Verwaltung start={laufendesTurnier()} />);
    expect(screen.getByTestId('tournament-closed-hint')).toHaveTextContent('Das Turnier ist abgeschlossen');
    await userEvent.setup().click(screen.getByTestId(`team-expand-toggle-${NORD}`));
    expect(farbwaehler(NORD)).not.toBeInTheDocument();
  });
});
