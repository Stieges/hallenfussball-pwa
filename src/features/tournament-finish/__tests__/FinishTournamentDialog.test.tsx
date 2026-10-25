/**
 * R3-4 Dialog „Turnier abschließen“ (Zustände A, B, B mit Warnung, ohne Netz, Speichern läuft, nicht bestätigt, Fehler). Erwartungen
 * aus dem Gherkin docs/anforderungen/2026-10-01_turnier-lebenszyklus.md und aus den abgenommenen Mockups Runde 2 (Daniel 25.10.),
 * nicht am Code abgelesen; echte deutsche Texte; der Abschluss-Dienst ist als Zustand + Spione ersetzt (er hat eigene Tests).
 *
 * Szenarien: @LZ-009, @LZ-010, @LZ-012, @LZ-013 (Liste mit Sprung), @LZ-018 (Warnung sperrt nie), @LZ-019 (nur mit Netz),
 * @LZ-021 (Speichern läuft: kein zweites Tippen, nicht schließbar), @LZ-024 (Fehler: nichts verändert), @LZ-091 (kein „Wieder
 * öffnen“-Knopf), @FU-068 (Gerät meldet sich nicht), Review #392 M1/H2, #393 H-5.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { FinishState, FinishTournamentApi } from '../../../hooks/useFinishTournament';
import type { FinishReady } from '../../../core/services/finishPreparation';
import type { FinishItem, FinishWarning } from '../../../core/repositories/lifecycleRpc';
import { prepareFinish } from '../../../core/services/finishPreparation';
import { nikolausFertig, preflightFor } from '../../../core/services/__tests__/finishKit';

const env = vi.hoisted(() => ({ online: true }));
vi.mock('../../../hooks/useOnlineStatus', () => ({ useIsOnline: () => env.online, useOnlineStatus: () => ({ isOnline: env.online, wasOffline: false }) }));
await initRealDeI18n();
const { FinishTournamentDialog } = await import('../components/FinishTournamentDialog');

let turnier: Tournament;
let ready: FinishReady;

function bereit(warnings: FinishWarning[] = []): FinishReady {
  const prepared = prepareFinish({
    tournament: turnier, preflight: preflightFor(turnier, { warnings }), reviews: [], ownPending: 0,
    appVersion: 'test', computedAt: '2026-11-28T12:00:00.000+00:00',
  });
  if (!prepared.ok) { throw new Error(`Testlage: ${JSON.stringify(prepared.blocker)}`); }
  return prepared.ready;
}

function api(state: FinishState) {
  const finish = { state, start: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), confirm: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), retry: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), reset: vi.fn<() => void>() };
  return finish satisfies FinishTournamentApi;
}

const onClose = vi.fn();
const onJump = vi.fn();
const onReloadState = vi.fn().mockResolvedValue(undefined);

function zeige(state: FinishState, t: Tournament = turnier, isOpen = true) {
  const finish = api(state);
  const view = render(<FinishTournamentDialog isOpen={isOpen} tournament={t} finish={finish} onClose={onClose} onJump={onJump} onReloadState={onReloadState} />);
  return { finish, view, again: (next: FinishState, open = true) => view.rerender(<FinishTournamentDialog isOpen={open} tournament={t} finish={{ ...finish, state: next }} onClose={onClose} onJump={onJump} onReloadState={onReloadState} />) };
}

beforeEach(async () => {
  turnier = await nikolausFertig();
  ready = bereit();
  env.online = true;
  onClose.mockReset(); onJump.mockReset(); onReloadState.mockClear();
  window.innerWidth = 1024;
});

describe('Beim Öffnen prüft der Dialog und beginnt einen neuen Durchlauf', () => {
  it('start() genau einmal beim Öffnen; beim Schließen reset()', () => {
    const { finish, again } = zeige({ phase: 'checking' });
    expect(finish.start).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('finish-checking')).toBeInTheDocument();
    again({ phase: 'checking' }, false);
    expect(finish.reset).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-010 @LZ-012 @LZ-013 Zustand A „noch nicht möglich“', () => {
  const items: FinishItem[] = [
    { kind: 'match_undecided', matchId: 'm14', matchNumber: 14, field: 1 },
    { kind: 'tie_open', groupId: '', places: [1], teamIds: ['a', 'b'] },
    { kind: 'review_open', eventId: 'e1', matchId: 'm3', matchNumber: 3, field: 1 },
  ];

  it('Hinweis oben („3 Dinge sind noch offen“), je Punkt ein Eintrag, Haupttaste „Zurück zur Verwaltung“ – KEIN gesperrter Abschließen-Knopf', () => {
    zeige({ phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: [...items] } });
    expect(screen.getByTestId('finish-blocked-notice')).toHaveTextContent('Das Turnier kann noch nicht abgeschlossen werden.');
    expect(screen.getByTestId('finish-blocked-notice')).toHaveTextContent('3 Dinge sind noch offen. Tippe auf einen Eintrag, um direkt dorthin zu springen.');
    expect(within(screen.getByTestId('finish-open-list')).getAllByTestId('finish-open-item')).toHaveLength(3);
    expect(screen.getByTestId('finish-back')).toHaveTextContent('Zurück zur Verwaltung');
    expect(screen.getByTestId('finish-back')).toBeEnabled();
    expect(screen.queryByTestId('tournament-finish-confirm')).toBeNull();
    expect(screen.getByText('Sobald alles erledigt ist, kannst du das Turnier abschließen.')).toBeInTheDocument();
  });

  it('ein Tipp auf einen Eintrag springt zur Stelle', () => {
    zeige({ phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: [...items] } });
    fireEvent.click(screen.getAllByTestId('finish-open-item')[2]);
    expect(onJump).toHaveBeenCalledWith(`/tournament/${turnier.id}/schedule?klaerung=1`);
  });

  it('ein einzelner Punkt heißt „1 Ding ist noch offen“ (Einzahl)', () => {
    zeige({ phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: [items[0]] } });
    expect(screen.getByTestId('finish-blocked-notice')).toHaveTextContent('1 Ding ist noch offen.');
  });

  it('„Zurück zur Verwaltung“ schließt den Dialog', () => {
    zeige({ phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: [...items] } });
    fireEvent.click(screen.getByTestId('finish-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-009 Zustand B „bereit“', () => {
  it('Sieger, Plätze 1 bis 3, „Alle 6 Plätze anzeigen“, drei Zahlen und „Das passiert beim Abschließen“', () => {
    zeige({ phase: 'confirming', ready });
    expect(screen.getByTestId('finish-winner')).toHaveTextContent('Sieger');
    expect(screen.getByTestId('finish-winner')).toHaveTextContent('DJK Kammer');
    expect(within(screen.getByTestId('finish-places')).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Endstand: Plätze 1 bis 3')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('finish-places-toggle'));
    expect(within(screen.getByTestId('finish-places')).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByTestId('finish-places-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('finish-facts')).toHaveTextContent('15 von 15 Spielen gespielt');
    expect(screen.getByTestId('finish-facts')).toHaveTextContent('0 ausgefallen');
    expect(screen.getByTestId('finish-facts')).toHaveTextContent('6 Teams');
    const folgen = screen.getByTestId('finish-consequences');
    expect(folgen).toHaveTextContent('Danach kann niemand mehr Ergebnisse ändern.');
    expect(folgen).toHaveTextContent('Helfer-Codes werden ungültig.');
    expect(folgen).toHaveTextContent('Zuschauer und Monitor zeigen den Endstand.');
  });

  it('Daniel 25.10.: kein Bestätigungs-Häkchen, kein Knopf „Wieder öffnen“, aber der Satz „Wieder öffnen geht nur über den Betreiber.“ (@LZ-091)', () => {
    zeige({ phase: 'confirming', ready });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /wieder öffnen/i })).toBeNull();
    expect(screen.getByTestId('finish-consequences')).toHaveTextContent('Wieder öffnen geht nur über den Betreiber.');
  });

  it('@ZM-012: Torschützen-Text nur bei eingeschaltetem Schalter, sonst „Der Endstand wird gespeichert.“', () => {
    const { view } = zeige({ phase: 'confirming', ready });
    expect(screen.getByTestId('finish-consequences')).toHaveTextContent('Der Endstand wird gespeichert.');
    expect(screen.getByTestId('finish-consequences')).not.toHaveTextContent('Torschützen');
    view.unmount();
    zeige({ phase: 'confirming', ready }, { ...turnier, publicScorers: true });
    expect(screen.getByTestId('finish-consequences')).toHaveTextContent('Endstand und Torschützen werden gespeichert.');
  });

  it('die Haupttaste „Turnier abschließen“ bestätigt genau einmal pro Tipp', () => {
    const { finish } = zeige({ phase: 'confirming', ready });
    const knopf = screen.getByTestId('tournament-finish-confirm');
    expect(knopf).toHaveTextContent('Turnier abschließen');
    fireEvent.click(knopf);
    expect(finish.confirm).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-018 Warnungen sperren nie – mit Stand der letzten Meldung', () => {
  const stand = '2026-11-28T11:05:00.000Z';
  it('„Feld 2: 3 Einträge noch nicht übertragen“ mit „Stand hh:mm“; der Abschluss bleibt möglich', () => {
    const warn = bereit([{ kind: 'outbox_pending', field: 2, pending: 3, reportedAt: stand, deviceId: 'd1' }]);
    zeige({ phase: 'confirming', ready: warn });
    const hinweis = screen.getByTestId('finish-warning');
    expect(hinweis).toHaveTextContent('Feld 2: 3 Einträge noch nicht übertragen');
    expect(hinweis).toHaveTextContent(/Stand \d\d:\d\d\./);
    expect(hinweis).toHaveTextContent('Du kannst trotzdem abschließen.');
    expect(screen.getByTestId('tournament-finish-confirm')).toBeEnabled();
  });

  it('ein einzelner Eintrag heißt „1 Eintrag“; ohne Feld steht nur die Zahl', () => {
    const warn = bereit([
      { kind: 'outbox_pending', field: 1, pending: 1, reportedAt: stand, deviceId: 'd1' },
      { kind: 'outbox_pending', pending: 2, reportedAt: stand, deviceId: 'd2' },
    ]);
    zeige({ phase: 'confirming', ready: warn });
    const texte = screen.getAllByTestId('finish-warning').map((node) => node.textContent);
    expect(texte[0]).toContain('Feld 1: 1 Eintrag noch nicht übertragen');
    expect(texte[1]).toContain('2 Einträge noch nicht übertragen');
    expect(texte[1]).not.toContain('Feld');
  });

  it('Review #392 H2: ein Gerät, das sich nicht mehr meldet (gesperrter Bildschirm), heißt „Gerät meldet sich nicht“ mit dem Grund', () => {
    const warn = bereit([{ kind: 'device_silent', field: 2, deviceId: 'd9', since: stand }]);
    zeige({ phase: 'confirming', ready: warn });
    const hinweis = screen.getByTestId('finish-warning');
    expect(hinweis).toHaveTextContent('Feld 2: Gerät meldet sich nicht');
    expect(hinweis).toHaveTextContent('vielleicht ist der Bildschirm gesperrt oder das Netz weg');
    expect(screen.getByTestId('tournament-finish-confirm')).toBeEnabled();
  });

  it('ohne Warnung keine Warnzeile', () => {
    zeige({ phase: 'confirming', ready });
    expect(screen.queryByTestId('finish-warning')).toBeNull();
  });
});

describe('@LZ-019 Ohne Netz geht der Abschluss nicht', () => {
  it('Netz weg im Dialog: Hinweis „Kein Netz“, Haupttaste gesperrt, Zeile „Abschließen geht erst mit Verbindung“', () => {
    env.online = false;
    zeige({ phase: 'confirming', ready });
    expect(screen.getByTestId('finish-offline')).toHaveTextContent('Kein Netz');
    expect(screen.getByTestId('finish-offline')).toHaveTextContent('Das Turnier bleibt so lange geöffnet.');
    expect(screen.getByTestId('tournament-finish-confirm')).toBeDisabled();
    expect(screen.getByTestId('finish-footer-hint')).toHaveTextContent('Abschließen geht erst mit Verbindung');
  });

  it('der Dialog wurde ohne Netz geöffnet: derselbe Hinweis, Taste gesperrt, nichts wird gemerkt; kommt das Netz, prüft er von selbst neu', () => {
    env.online = false;
    const { finish, again } = zeige({ phase: 'rejected', reason: { code: 'OFFLINE' } });
    expect(screen.getByTestId('finish-offline')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-finish-confirm')).toBeDisabled();
    expect(finish.confirm).not.toHaveBeenCalled();
    expect(finish.start).toHaveBeenCalledTimes(1); // nur das Öffnen
    env.online = true;
    act(() => { again({ phase: 'rejected', reason: { code: 'OFFLINE' } }); });
    expect(finish.start).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel: mit Netz kein Netz-Hinweis und die Taste ist frei', () => {
    zeige({ phase: 'confirming', ready });
    expect(screen.queryByTestId('finish-offline')).toBeNull();
    expect(screen.getByTestId('tournament-finish-confirm')).toBeEnabled();
  });
});

describe('@LZ-021 Speichern läuft: kein zweites Tippen, nicht schließbar', () => {
  it('Haupttaste zeigt „Wird gespeichert“ (aria-busy), Abbrechen und X sind gesperrt, Esc schließt nicht', () => {
    const { again } = zeige({ phase: 'confirming', ready });
    act(() => { again({ phase: 'sending' }); });
    const haupt = screen.getByTestId('tournament-finish-confirm');
    expect(haupt).toHaveTextContent('Wird gespeichert');
    expect(haupt).toHaveAttribute('aria-busy', 'true');
    expect(haupt).toBeDisabled();
    expect(screen.getByTestId('finish-cancel')).toBeDisabled();
    expect(screen.getByTestId('finish-close')).toBeDisabled();
    expect(screen.getByTestId('finish-sending')).toHaveTextContent('Der Endstand wird gespeichert.');
    expect(screen.getByTestId('finish-footer-hint')).toHaveTextContent('Bitte warte, bis das Speichern fertig ist.');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('finish-close'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nach dem Abschluss (fertig) schließt der Dialog – die Verwaltung zeigt dann Zustand C', () => {
    const { again } = zeige({ phase: 'confirming', ready });
    act(() => { again({ phase: 'done', finishedAt: '2026-11-28T12:10:00+00:00', alreadyApplied: false }); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-021 Antwort bleibt aus → „nicht bestätigt“, erneutes Tippen mit derselben Anfrage', () => {
  it('Hinweis mit dem Stand des Servers; „Erneut versuchen“ ruft retry() (nicht start())', () => {
    const { finish, again } = zeige({ phase: 'confirming', ready });
    act(() => { again({ phase: 'unconfirmed', serverLifecycle: 'running' }); });
    expect(screen.getByTestId('finish-unconfirmed')).toHaveTextContent('Noch nicht bestätigt');
    expect(screen.getByTestId('finish-unconfirmed')).toHaveTextContent('Der Server meldet: Das Turnier ist noch nicht abgeschlossen.');
    fireEvent.click(screen.getByTestId('tournament-finish-retry'));
    expect(finish.retry).toHaveBeenCalledTimes(1);
    expect(finish.start).toHaveBeenCalledTimes(1); // nur das Öffnen
  });

  it('meldet der Server „abgeschlossen“, steht das da', () => {
    const { again } = zeige({ phase: 'confirming', ready });
    act(() => { again({ phase: 'unconfirmed', serverLifecycle: 'finished' }); });
    expect(screen.getByTestId('finish-unconfirmed')).toHaveTextContent('Der Server meldet: Das Turnier ist abgeschlossen.');
  });
});

describe('@LZ-024 Fehler: nichts verändert, „Erneut versuchen“', () => {
  it('Speichern gescheitert: verständlicher Text; Haupttaste ruft einen neuen Durchlauf (start())', () => {
    const { finish } = zeige({ phase: 'rejected', reason: { code: 'UNEXPECTED' } });
    expect(screen.getByTestId('finish-error')).toHaveTextContent('Das Turnier ist noch nicht abgeschlossen.');
    expect(screen.getByTestId('finish-error')).toHaveTextContent('Es wurde nichts verändert, das Turnier läuft weiter.');
    fireEvent.click(screen.getByTestId('tournament-finish-retry'));
    expect(finish.start).toHaveBeenCalledTimes(2);
  });

  it('„Der Stand hat sich geändert“: Haupttaste „Stand neu laden“ lädt neu und prüft danach erneut', async () => {
    const { finish } = zeige({ phase: 'rejected', reason: { code: 'STALE_STATE' } });
    await act(async () => { fireEvent.click(screen.getByTestId('tournament-finish-retry')); });
    expect(screen.getByTestId('tournament-finish-retry')).toHaveTextContent('Stand neu laden');
    expect(onReloadState).toHaveBeenCalledTimes(1);
    expect(finish.start).toHaveBeenCalledTimes(2);
  });

  it('H-5: „bereits abgeschlossen“ ohne Person behauptet nichts; Haupttaste führt zurück zur Verwaltung', () => {
    zeige({ phase: 'rejected', reason: { code: 'ALREADY_FINISHED', at: null } });
    expect(screen.getByTestId('finish-error')).toHaveTextContent('Das Turnier ist bereits abgeschlossen.');
    expect(screen.getByTestId('finish-error').textContent).not.toMatch(/jemand|anderen/i);
    fireEvent.click(screen.getByTestId('finish-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Handy: Vollbild mit festem Fuß; breiter: zentriert', () => {
  it('360 px breit: Vollbild, der Fuß mit der Haupttaste steht außerhalb des scrollenden Inhalts', () => {
    window.innerWidth = 360;
    zeige({ phase: 'confirming', ready });
    expect(screen.getByTestId('finish-dialog')).toHaveAttribute('data-layout', 'fullscreen');
    const inhalt = screen.getByTestId('finish-dialog-body');
    expect(inhalt).not.toContainElement(screen.getByTestId('tournament-finish-confirm'));
  });

  it('1024 px breit: zentrierter Dialog', () => {
    zeige({ phase: 'confirming', ready });
    expect(screen.getByTestId('finish-dialog')).toHaveAttribute('data-layout', 'center');
  });
});
