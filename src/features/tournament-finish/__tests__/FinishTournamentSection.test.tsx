/**
 * R3-4 „Turnier abschließen“ in der Verwaltung und Zustand C „abgeschlossen“. Erwartungen aus dem Gherkin
 * docs/anforderungen/2026-10-01_turnier-lebenszyklus.md und den abgenommenen Mockups Runde 2 (Daniel 25.10.). Die Kette
 * `useCan` → Rolle → Sperre nach dem Abschluss läuft ECHT (gemockt ist nur die Rolle); der Abschluss-Dienst ist ein Stand + Spione.
 *
 * Szenarien: @LZ-002 (Aktion nur im Zustand „Läuft“), @LZ-005 (Hinweis erst nach 7 Tagen), @LZ-007 (Vorschlag), @LZ-008 (kein Vorschlag,
 * „Turnier abschließen“ als zweite Taste), @LZ-009 (Zustand C), @LZ-022 (Helfer: nicht angeboten), @LZ-039/@LZ-040 („Nach dem Ende
 * eingetroffen“), @LZ-091 (kein „Wieder öffnen“-Knopf), E9 (Gast: nicht angeboten), Review #394 H-1 (Zustand C trotz gesperrtem
 * `manageLifecycle`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import type { MatchReview } from '../../../core/match/review/matchReviewTypes';
import type { LateEntriesState } from '../hooks/useLateEntries';
import type { StoredStandingsState } from '../hooks/useStoredFinalStandings';

const roleMock = vi.hoisted((): { current: string } => ({ current: 'owner' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: roleMock.current, isLoading: false }) }));
vi.mock('../../../core/utils/safeStorage', () => ({ safeLocalStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } }));

interface Env { local: boolean; reviews: unknown[]; stored: unknown; late: unknown }
const env = vi.hoisted<Env>(() => ({ local: false, reviews: [], stored: { status: 'loading' }, late: { status: 'loading', entries: [] } }));
vi.mock('../../../core/contexts/RepositoryContext', async () => {
  const { LocalStorageRepository } = await import('../../../core/repositories/LocalStorageRepository');
  const local = Object.create(LocalStorageRepository.prototype) as object;
  const cloud = { get: vi.fn() };
  return { useRepositories: () => ({ tournamentRepository: env.local ? local : cloud }) };
});
vi.mock('../../klaerungsliste/useMatchReviews', () => ({ useMatchReviews: () => ({ enabled: true, reviews: env.reviews as MatchReview[], refresh: vi.fn() }) }));
vi.mock('../hooks/useStoredFinalStandings', () => ({ useStoredFinalStandings: () => env.stored as StoredStandingsState }));
vi.mock('../hooks/useLateEntries', () => ({ useLateEntries: () => env.late as LateEntriesState }));
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'olli', name: 'Olli' } }) }));
vi.mock('../../../hooks/useOnlineStatus', () => ({ useIsOnline: () => true, useOnlineStatus: () => ({ isOnline: true, wasOffline: false }) }));
interface FinishSpy { start: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn>; options: unknown }
const finishSpy = vi.hoisted<FinishSpy>(() => ({ start: vi.fn(), confirm: vi.fn(), retry: vi.fn(), reset: vi.fn(), options: undefined }));
vi.mock('../../../hooks/useFinishTournament', () => ({
  useFinishTournament: (_t: unknown, options: unknown) => {
    finishSpy.options = options;
    return { state: { phase: 'checking' }, start: finishSpy.start, confirm: finishSpy.confirm, retry: finishSpy.retry, reset: finishSpy.reset };
  },
}));
await initRealDeI18n();

import { resetClosedTournaments, setTournamentClosed } from '../../../core/services/closedTournaments';
import { review } from '../../../core/match/review/__tests__/reviewFixtures';
import { NK } from '../../../core/standings/__tests__/groupCompletionKit';
import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
const { FinishTournamentSection } = await import('../components/FinishTournamentSection');

let fertig: Tournament;
const onReload = vi.fn().mockResolvedValue(undefined);

function zeige(t: Tournament) {
  return render(<MemoryRouter><FinishTournamentSection tournament={t} onReload={onReload} /></MemoryRouter>);
}

beforeEach(async () => {
  fertig = await nikolausFertig();
  roleMock.current = 'owner';
  env.local = false; env.reviews = []; env.stored = { status: 'loading' }; env.late = { status: 'loading', entries: [] };
  [finishSpy.start, finishSpy.confirm, finishSpy.retry, finishSpy.reset].forEach((spy) => { spy.mockReset(); });
  finishSpy.start.mockResolvedValue(undefined);
  onReload.mockClear();
  resetClosedTournaments();
});
afterEach(() => { resetClosedTournaments(); vi.useRealTimers(); });

describe('@LZ-007 Ist alles entschieden, schlägt die App den Abschluss vor', () => {
  it('Vorschlag „Alles entschieden – Endstand prüfen und Turnier abschließen“ mit der Haupttaste „Turnier abschließen“', () => {
    zeige(fertig);
    const karte = screen.getByTestId('finish-suggestion');
    expect(karte).toHaveTextContent('Alles entschieden – Endstand prüfen und Turnier abschließen.');
    const taste = within(karte).getByTestId('tournament-finish-open');
    expect(taste).toHaveAttribute('data-primary');
    expect(screen.queryByTestId('finish-status')).toBeNull();
  });

  it('ein Tipp auf „Turnier abschließen“ öffnet den Dialog und beginnt die Prüfung', () => {
    zeige(fertig);
    expect(screen.queryByTestId('finish-dialog')).toBeNull();
    fireEvent.click(screen.getByTestId('tournament-finish-open'));
    expect(screen.getByTestId('finish-dialog')).toBeInTheDocument();
    expect(finishSpy.start).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-008 Solange etwas offen ist, schlägt die App den Abschluss nicht vor', () => {
  it('ein Eintrag der Klärungsliste ist offen → kein Vorschlag, aber „Turnier abschließen“ als zweite Taste (öffnet den Dialog)', () => {
    env.reviews = [review()];
    zeige(fertig);
    expect(screen.queryByTestId('finish-suggestion')).toBeNull();
    const karte = screen.getByTestId('finish-status');
    expect(karte).toHaveTextContent('15 von 15 Spielen beendet.');
    expect(karte).toHaveTextContent('1 Eintrag in der Klärungsliste ist noch offen.');
    const taste = within(karte).getByTestId('tournament-finish-open');
    expect(taste).not.toHaveAttribute('data-primary');
    fireEvent.click(taste);
    expect(screen.getByTestId('finish-dialog')).toBeInTheDocument();
  });

  it('ein Spiel läuft noch → kein Vorschlag, Zahl „14 von 15“', () => {
    const letztes = fertig.matches[fertig.matches.length - 1];
    zeige({ ...fertig, matches: fertig.matches.map((m) => (m.id === letztes.id ? { ...m, matchStatus: 'running' as const } : m)) });
    expect(screen.queryByTestId('finish-suggestion')).toBeNull();
    expect(screen.getByTestId('finish-status')).toHaveTextContent('14 von 15 Spielen beendet.');
  });
});

describe('@LZ-022 @LZ-002 Wer das Turnier abschließen darf – und wann', () => {
  it('Maria (Co-Admin) bekommt die Taste', () => {
    roleMock.current = 'co-admin';
    zeige(fertig);
    expect(screen.getByTestId('tournament-finish-open')).toBeInTheDocument();
  });

  it('Tom (Helfer): bietet die App das nicht an', () => {
    roleMock.current = 'collaborator';
    zeige(fertig);
    expect(screen.queryByTestId('finish-section')).toBeNull();
    expect(screen.queryByTestId('tournament-finish-open')).toBeNull();
  });

  it('E9 Gast-Turnier (nur auf dem Gerät): nicht angeboten', () => {
    env.local = true;
    zeige(fertig);
    expect(screen.queryByTestId('tournament-finish-open')).toBeNull();
  });

  it('@LZ-002 Gegenbeispiel: ein festgelegtes Turnier ohne angepfiffenes Spiel, ein Entwurf – nichts zum Abschließen', () => {
    const frisch = { ...fertig, lifecycleStatus: 'fixed' as const, matches: fertig.matches.map((m) => ({ ...m, matchStatus: 'scheduled' as const })) };
    const { unmount } = zeige(frisch);
    expect(screen.queryByTestId('tournament-finish-open')).toBeNull();
    unmount();
    zeige({ ...frisch, status: 'draft', lifecycleStatus: 'draft' });
    expect(screen.queryByTestId('tournament-finish-open')).toBeNull();
  });
});

describe('Review #393 H-2: der Dienst bekommt den frisch gelesenen rohen Cloud-Stand', () => {
  it('loadRaw liest aus dem Repository mit fresh: true', async () => {
    zeige(fertig);
    const { tournamentRepository } = (await import('../../../core/contexts/RepositoryContext')).useRepositories() as unknown as { tournamentRepository: { get: ReturnType<typeof vi.fn> } };
    const options = finishSpy.options as { loadRaw: () => Promise<unknown> };
    await options.loadRaw();
    expect(tournamentRepository.get).toHaveBeenCalledWith(fertig.id, { fresh: true });
  });
});

describe('@LZ-005 Hinweis erst 7 Tage nach dem letzten Spiel', () => {
  const ende = '2026-10-12T16:00:00.000Z';
  const turnier = (): Tournament => ({ ...fertig, matches: fertig.matches.map((m) => ({ ...m, finishedAt: ende })) });
  it('6 Tage danach kein Hinweis', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T17:00:00.000Z'));
    zeige(turnier());
    expect(screen.queryByTestId('finish-late-hint')).toBeNull();
  });
  it.each(['2026-10-19T17:00:00.000Z', '2026-10-20T17:00:00.000Z'])('%s: Hinweis, dass das Turnier noch läuft', (jetzt) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(jetzt));
    zeige(turnier());
    expect(screen.getByTestId('finish-late-hint')).toHaveTextContent('Das Turnier läuft noch.');
    expect(screen.getByTestId('finish-late-hint')).toHaveTextContent('12.10.2026');
  });
});

describe('@LZ-009 Zustand C „abgeschlossen“ (Review #394 H-1: trotz gesperrtem manageLifecycle)', () => {
  const abgeschlossen = (): Tournament => ({ ...fertig, lifecycleStatus: 'finished', finishedAt: '2026-11-28T12:10:00.000Z', isPublic: true, shareCode: 'ABC123' });

  it('Hinweis mit Zeitpunkt, „Wieder öffnen geht nur über den Betreiber.“, kein Knopf zum Wieder-öffnen, kein „Turnier abschließen“', () => {
    setTournamentClosed(fertig.id, true); // wie in der Verwaltung: useCan('manageLifecycle') ist jetzt false
    zeige(abgeschlossen());
    const hinweis = screen.getByTestId('tournament-ended');
    expect(hinweis).toHaveTextContent(/Turnier abgeschlossen am .+, \d\d:\d\d Uhr/);
    expect(hinweis).toHaveTextContent('Ergebnisse, Spielplan und Teams sind gesperrt. Helfer-Codes sind ungültig. Der Endstand ist gespeichert.');
    expect(hinweis).toHaveTextContent('Wieder öffnen geht nur über den Betreiber.');
    expect(screen.queryByRole('button', { name: /wieder öffnen/i })).toBeNull();
    expect(screen.queryByTestId('tournament-finish-open')).toBeNull();
  });

  it('der gespeicherte Endstand: Plätze 1 bis 3, Haupttaste „Zuschauer-Ansicht öffnen“ öffnet die Seite der Zuschauer', () => {
    setTournamentClosed(fertig.id, true);
    env.stored = { status: 'ok', finishedAt: '2026-11-28T12:10:00.000Z', snapshot: { format: 1, scorers: [], appVersion: 't', computedAt: '2026-11-28T12:10:00.000+00:00', ranking: [
      { place: 1, teamId: NK.kammer, teamName: 'DJK Kammer', origin: { kind: 'groupPlace', group: '', place: 1 } },
      { place: 2, teamId: NK.wagingRot, teamName: 'TSV Waging rot', origin: { kind: 'groupPlace', group: '', place: 2 } },
      { place: 3, teamId: NK.otting, teamName: 'DJK Otting', origin: { kind: 'groupPlace', group: '', place: 3 } },
      { place: 4, teamId: NK.petting, teamName: 'TSV Petting', origin: { kind: 'groupPlace', group: '', place: 4 } },
    ] } };
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    zeige(abgeschlossen());
    expect(within(screen.getByTestId('finished-standings')).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('finished-standings')).toHaveTextContent('DJK Kammer');
    expect(screen.getByTestId('finished-standings')).not.toHaveTextContent('TSV Petting');
    const taste = screen.getByTestId('public-view-open');
    expect(taste).toHaveTextContent('Zuschauer-Ansicht öffnen');
    expect(taste).toHaveAttribute('data-primary');
    fireEvent.click(taste);
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/#\/live\/ABC123$/), '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('ohne öffentliche Ansicht keine Taste, sondern der Hinweis dazu', () => {
    setTournamentClosed(fertig.id, true);
    zeige({ ...abgeschlossen(), shareCode: undefined });
    expect(screen.queryByTestId('public-view-open')).toBeNull();
    expect(screen.getByTestId('public-view-off')).toHaveTextContent('Die öffentliche Ansicht ist nicht eingeschaltet.');
  });

  it('@LZ-039 „Nach dem Ende eingetroffen“: Tor von Tom mit Name, Zeit und „zählt nicht“', () => {
    setTournamentClosed(fertig.id, true);
    const m = fertig.matches[14];
    env.late = { status: 'ready', entries: [{
      id: 1, matchId: m.id, eventId: 'e1', type: 'GOAL', teamId: NK.kammer, playerNumber: 7, recordedAt: Date.parse('2026-11-28T12:04:00.000Z'),
      actor: 'tom', actorName: 'Tom', receivedAt: '2026-11-28T12:21:00.000Z',
    }] };
    zeige(abgeschlossen());
    const liste = screen.getByTestId('late-entries');
    expect(liste).toHaveTextContent('Nach dem Ende eingetroffen');
    expect(screen.getByTestId('late-entries-count')).toHaveTextContent('1');
    const eintrag = within(liste).getByTestId('late-entry');
    expect(eintrag).toHaveTextContent(`Tor für DJK Kammer (#7), Spiel ${String(m.matchNumber)}`);
    expect(eintrag).toHaveTextContent('zählt nicht');
    expect(eintrag).toHaveTextContent(/Erfasst von Tom um \d\d:\d\d/);
    expect(eintrag).toHaveTextContent(/Eingetroffen um \d\d:\d\d/);
  });

  it('E8: ohne Namen in der Mitgliederliste steht „Helfer-Gerät“ – nie eine E-Mail; das eigene Konto trägt den eigenen Namen', () => {
    setTournamentClosed(fertig.id, true);
    const m = fertig.matches[14];
    const base = { matchId: m.id, type: 'YELLOW_CARD', teamId: NK.kammer, playerNumber: null, recordedAt: null, receivedAt: '2026-11-28T12:21:00.000Z' };
    env.late = { status: 'ready', entries: [
      { ...base, id: 1, eventId: 'e1', actor: 'fremd', actorName: null },
      { ...base, id: 2, eventId: 'e2', actor: 'olli', actorName: null },
    ] };
    zeige(abgeschlossen());
    const eintraege = screen.getAllByTestId('late-entry');
    expect(eintraege[0]).toHaveTextContent('Erfasst von Helfer-Gerät');
    expect(eintraege[1]).toHaveTextContent('Erfasst von Olli');
    expect(screen.getByTestId('late-entries').textContent).not.toMatch(/@/);
  });

  it('Gegenbeispiel: Maria (Co-Admin) sieht Zustand C ebenfalls; Tom (Helfer) sieht ihn nicht', () => {
    setTournamentClosed(fertig.id, true);
    roleMock.current = 'co-admin';
    const { unmount } = zeige(abgeschlossen());
    expect(screen.getByTestId('tournament-ended')).toBeInTheDocument();
    unmount();
    roleMock.current = 'collaborator';
    zeige(abgeschlossen());
    expect(screen.queryByTestId('tournament-ended')).toBeNull();
  });

  it('Liste leer: „Bisher ist nach dem Abschluss nichts eingetroffen.“; nicht lesbar: sagt es', () => {
    setTournamentClosed(fertig.id, true);
    env.late = { status: 'ready', entries: [] };
    const { unmount } = zeige(abgeschlossen());
    expect(screen.getByTestId('late-entries-empty')).toBeInTheDocument();
    unmount();
    env.late = { status: 'unavailable', entries: [] };
    zeige(abgeschlossen());
    expect(screen.getByTestId('late-entries-unavailable')).toHaveTextContent('Die Liste konnte gerade nicht gelesen werden.');
  });
});

describe('Review #395 M-1: ohne Inhalt bleibt kein Rahmen und kein Abstand stehen', () => {
  it('Helfer, Gast und Entwurf: der Bereich zeichnet gar nichts', () => {
    roleMock.current = 'collaborator';
    const helfer = zeige(fertig);
    expect(helfer.container).toBeEmptyDOMElement();
    helfer.unmount();
    roleMock.current = 'owner';
    env.local = true;
    const gast = zeige(fertig);
    expect(gast.container).toBeEmptyDOMElement();
    gast.unmount();
    env.local = false;
    const entwurf = zeige({ ...fertig, status: 'draft', lifecycleStatus: 'draft' });
    expect(entwurf.container).toBeEmptyDOMElement();
  });

  it('Gegenbeispiel: zeigt der Bereich etwas, steht der Abstand nach unten dabei (ein Wurzelelement)', () => {
    const { container } = zeige(fertig);
    expect(container.children).toHaveLength(1);
  });
});

describe('Review #395 m-2: nach einem Abschluss und Wiederöffnen öffnet sich der Dialog nicht von selbst', () => {
  it('Dialog offen → abgeschlossen → (Notweg) wieder „Läuft“: kein Dialog, keine neue Prüfung', () => {
    const { rerender } = zeige(fertig);
    fireEvent.click(screen.getByTestId('tournament-finish-open'));
    expect(screen.getByTestId('finish-dialog')).toBeInTheDocument();
    const startVorher = finishSpy.start.mock.calls.length;
    rerender(<MemoryRouter><FinishTournamentSection tournament={{ ...fertig, lifecycleStatus: 'finished', finishedAt: '2026-11-28T12:10:00.000Z' }} onReload={onReload} /></MemoryRouter>);
    rerender(<MemoryRouter><FinishTournamentSection tournament={fertig} onReload={onReload} /></MemoryRouter>);
    expect(screen.queryByTestId('finish-dialog')).toBeNull();
    expect(finishSpy.start.mock.calls.length).toBe(startVorher);
  });
});

describe('Review #395 m-2, Gegenbeispiel: ein kurzes Neuladen schließt den Dialog nicht', () => {
  it('ist die Ansicht beim Neuladen einen Moment „festgelegt“ (noch ohne Spielstände), bleibt der offene Dialog stehen', () => {
    const { rerender } = zeige(fertig);
    fireEvent.click(screen.getByTestId('tournament-finish-open'));
    const flackern = { ...fertig, anyMatchStarted: undefined, matches: fertig.matches.map((m) => ({ ...m, matchStatus: 'scheduled' as const })) };
    rerender(<MemoryRouter><FinishTournamentSection tournament={flackern} onReload={onReload} /></MemoryRouter>);
    rerender(<MemoryRouter><FinishTournamentSection tournament={fertig} onReload={onReload} /></MemoryRouter>);
    expect(screen.getByTestId('finish-dialog')).toBeInTheDocument();
  });
});

describe('Der Dialog schließt, wenn der Abschluss durch ist; die Verwaltung folgt dem Server', () => {
  it('Schließen über den Dialog setzt ihn zurück', () => {
    zeige(fertig);
    fireEvent.click(screen.getByTestId('tournament-finish-open'));
    fireEvent.click(screen.getByTestId('finish-close'));
    expect(screen.queryByTestId('finish-dialog')).toBeNull();
    expect(finishSpy.reset).toHaveBeenCalled();
  });
});
