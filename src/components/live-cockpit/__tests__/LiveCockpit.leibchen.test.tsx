/**
 * Anpfiff-Ansicht mit Leibchen (Cockpit-Paket K1–K3): @SL-137, @SL-138, @SL-139, @SL-148, @SL-149, @SL-151, @SL-196, @SL-197.
 * Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md. Teams und Farben wie in den Szenarien (SV Süd, FC Nord, TSV Ost).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';
import type { CockpitLeibchen } from '../typesFarben';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const ROT = '#C62828';
const WEISS = '#FFFFFF';
const GELB_SV_SUED = '#FFEB3B';
const TURNIER_GELB = '#FFCC00';
const BLAU = '#1565C0';

const spiel12 = () => makeLiveMatch({ id: 'spiel-12', number: 12, status: 'NOT_STARTED', elapsedSeconds: 0, homeTeam: { id: 'sv-sued', name: 'SV Süd' }, awayTeam: { id: 'fc-nord', name: 'FC Nord' } });
const spiel14 = () => makeLiveMatch({ id: 'spiel-14', number: 14, status: 'NOT_STARTED', elapsedSeconds: 0, homeTeam: { id: 'sv-sued', name: 'SV Süd' }, awayTeam: { id: 'tsv-ost', name: 'TSV Ost' } });
const leibchen = (a: string, b: string): CockpitLeibchen => ({ farben: { a, b }, turnierFarbe: TURNIER_GELB });

describe('@SL-137 gleiche Farbe: Hinweis, „Leibchen für …“ je Seite, Heim vorbelegt, nur für dieses Spiel', () => {
  it('@SL-137 beide Rot → Tafel weist darauf hin, Leibchen für SV Süd (Heim) vorbelegt, beide Seiten wählbar', () => {
    render(<LiveCockpit {...makeProps(spiel12(), { leibchen: leibchen(ROT, ROT) })} />);
    expect(screen.getByTestId('scoreboard-farb-hinweis')).toHaveTextContent('Gleiche Trikotfarbe');
    expect(screen.getByRole('button', { name: 'Leibchen für SV Süd' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Leibchen für FC Nord' })).toHaveAttribute('aria-pressed', 'false');
    // mit Gelb vorbelegt und änderbar
    expect(screen.getByRole('button', { name: 'Gelb' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('@SL-137 Tom wählt „Leibchen für FC Nord“ → der Anpfiff trägt Leibchen für den Gast (Gelb)', async () => {
    const u = userEvent.setup();
    const props = makeProps(spiel12(), { leibchen: leibchen(ROT, ROT) });
    render(<LiveCockpit {...props} />);
    await u.click(screen.getByRole('button', { name: 'Leibchen für FC Nord' }));
    expect(screen.getByRole('button', { name: 'Leibchen für SV Süd' })).toHaveAttribute('aria-pressed', 'false');
    await u.click(screen.getByTestId('match-start-button'));
    expect(props.onStart).toHaveBeenCalledWith('spiel-12', { bibSide: 'b', bibColor: TURNIER_GELB });
  });

  it('@SL-137 im nächsten Spiel gilt wieder die Vorbelegung (die Wahl gilt nur für Spiel 12)', async () => {
    const u = userEvent.setup();
    const props = makeProps(spiel12(), { leibchen: leibchen(ROT, ROT) });
    const { rerender } = render(<LiveCockpit {...props} />);
    await u.click(screen.getByRole('button', { name: 'Leibchen für FC Nord' }));
    rerender(<LiveCockpit {...makeProps(makeLiveMatch({ id: 'spiel-13', number: 13, status: 'NOT_STARTED', elapsedSeconds: 0, homeTeam: { id: 'sv-sued', name: 'SV Süd' }, awayTeam: { id: 'fc-nord', name: 'FC Nord' } }), { leibchen: leibchen(ROT, WEISS) })} />);
    expect(screen.queryByRole('button', { name: 'Leibchen für FC Nord' })).toBeNull();
    expect(screen.getByTestId('anpfiff-leibchen-festlegen')).toBeInTheDocument();
  });
});

describe('@SL-196 vor dem Anpfiff die echten Trikotfarben', () => {
  it('@SL-196 Blau gegen Blau: beide Kästen und Köpfe Blau (Heim mit Leibchen-Zeichen), keine Ausweichfarbe für den Gast', () => {
    // Die Kästen des Spiels (Hallenmonitor) hätten für den Gast die Ausweichfarbe Rot
    const kasten = { home: { fill: { kind: 'solid' as const, color: BLAU }, bib: false }, away: { fill: { kind: 'solid' as const, color: ROT }, bib: false } };
    render(<LiveCockpit {...makeProps(spiel12(), { leibchen: leibchen(BLAU, BLAU), kasten })} />);
    expect(screen.getByTestId('scoreboard-farb-hinweis')).toBeInTheDocument();
    expect(screen.getByTestId('team-head-away')).toHaveAttribute('data-color', BLAU);
    expect(screen.getByTestId('scoreboard-box-rechts')).toHaveAttribute('data-color', BLAU);
    expect(screen.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', BLAU);
    expect(screen.getByTestId('scoreboard-box-links-bib')).toBeInTheDocument();
    expect(screen.getByTestId('team-head-home')).toHaveAttribute('data-color', BLAU);
  });
});

describe('@SL-149 bei Konflikt ohne Leibchen anpfeifen', () => {
  it('@SL-149 „Ohne Leibchen anpfeifen“ pfeift an, keine Seite trägt Leibchen', async () => {
    const u = userEvent.setup();
    const props = makeProps(spiel12(), { leibchen: leibchen(ROT, ROT) });
    render(<LiveCockpit {...props} />);
    await u.click(screen.getByRole('button', { name: 'Ohne Leibchen anpfeifen' }));
    expect(props.onStart).toHaveBeenCalledTimes(1);
    expect(props.onStart).toHaveBeenCalledWith('spiel-12', { bibSide: null, bibColor: TURNIER_GELB });
  });
});

describe('@SL-138/@SL-148 ohne Konflikt: kein Hinweis, Leibchen freiwillig', () => {
  it('@SL-138 Rot gegen Weiß: kein Hinweis, kein „Ohne Leibchen anpfeifen“, Anpfiff ohne weiteren Schritt, „Leibchen festlegen“ steht zur Wahl', async () => {
    const u = userEvent.setup();
    const props = makeProps(spiel14(), { leibchen: leibchen(ROT, WEISS) });
    render(<LiveCockpit {...props} />);
    expect(screen.queryByTestId('scoreboard-farb-hinweis')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ohne Leibchen anpfeifen' })).toBeNull();
    expect(screen.getByTestId('anpfiff-leibchen-festlegen')).toHaveTextContent('Leibchen festlegen');
    await u.click(screen.getByTestId('match-start-button'));
    expect(props.onStart).toHaveBeenCalledWith('spiel-14', { bibSide: null, bibColor: TURNIER_GELB });
  });

  it('@SL-148 über „Leibchen festlegen“ Leibchen für TSV Ost, mit Gelb vorbelegt → Anpfiff mit Leibchen für den Gast', async () => {
    const u = userEvent.setup();
    const props = makeProps(spiel14(), { leibchen: leibchen(ROT, WEISS) });
    render(<LiveCockpit {...props} />);
    await u.click(screen.getByTestId('anpfiff-leibchen-festlegen'));
    await u.click(screen.getByRole('button', { name: 'Leibchen für TSV Ost' }));
    expect(screen.getByRole('button', { name: 'Gelb' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('scoreboard-farb-hinweis')).toBeNull();
    await u.click(screen.getByTestId('match-start-button'));
    expect(props.onStart).toHaveBeenCalledWith('spiel-14', { bibSide: 'b', bibColor: TURNIER_GELB });
  });
});

describe('@SL-151 Leibchenfarbe der Farbe des Gegners zu ähnlich', () => {
  it('@SL-151 Vorbelegung: Weiß (Heim) gegen Gelb, Turnier-Leibchen Gelb → Heim bekommt eine Farbe ohne Konflikt, Gelb ist gekennzeichnet', () => {
    render(<LiveCockpit {...makeProps(spiel14(), { leibchen: { farben: { a: WEISS, b: GELB_SV_SUED }, turnierFarbe: TURNIER_GELB } })} />);
    const gewaehlt = screen.getAllByRole('button', { pressed: true }).find((k) => k.getAttribute('data-testid')?.startsWith('anpfiff-leibchen-farbe-'));
    expect(gewaehlt?.getAttribute('data-testid')).not.toBe('anpfiff-leibchen-farbe-gelb');
    expect(gewaehlt).not.toHaveAttribute('data-zu-aehnlich');
    expect(screen.getByTestId('anpfiff-leibchen-farbe-gelb')).toHaveAttribute('data-zu-aehnlich', 'true');
    expect(screen.getByTestId('anpfiff-leibchen-farbe-gelb')).toHaveAccessibleName('Gelb – zu ähnlich wie das Trikot von TSV Ost');
    // kein Hinweis auf Leibchen gegen Gegner, die Tafel nennt die ähnlichen Trikots
    expect(screen.getByTestId('scoreboard-farb-hinweis')).toHaveTextContent('Sehr ähnliche Trikotfarben');
  });

  it('@SL-151 SV Süd Gelb, TSV Ost Weiß: Tom wählt für TSV Ost Gelb → die Tafel sagt „Leibchen zu ähnlich wie der Gegner“; Blau → kein Hinweis, Anpfiff mit Blau', async () => {
    const u = userEvent.setup();
    const props = makeProps(spiel14(), { leibchen: { farben: { a: GELB_SV_SUED, b: WEISS }, turnierFarbe: GELB_SV_SUED } });
    render(<LiveCockpit {...props} />);
    await u.click(screen.getByRole('button', { name: 'Leibchen für TSV Ost' }));
    expect(screen.getByTestId('scoreboard-farb-hinweis')).not.toHaveTextContent('Leibchen zu ähnlich');
    await u.click(screen.getByTestId('anpfiff-leibchen-farbe-turnier'));
    expect(screen.getByTestId('scoreboard-farb-hinweis')).toHaveTextContent('Leibchen zu ähnlich wie der Gegner');
    await u.click(screen.getByTestId('anpfiff-leibchen-farbe-blau'));
    expect(screen.getByTestId('scoreboard-farb-hinweis')).not.toHaveTextContent('Leibchen zu ähnlich');
    await u.click(screen.getByTestId('match-start-button'));
    expect(props.onStart).toHaveBeenCalledWith('spiel-14', { bibSide: 'b', bibColor: BLAU });
  });
});

describe('Gegenbeispiele', () => {
  it('ohne Steuerrecht keine Leibchen-Wahl (nur Lesen)', () => {
    render(<LiveCockpit {...makeProps(spiel12(), { leibchen: leibchen(ROT, ROT), kannSteuern: false })} />);
    expect(screen.queryByRole('button', { name: /Leibchen für/ })).toBeNull();
  });

  it('im laufenden Spiel keine Leibchen-Wahl und kein Hinweis in der Tafel', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch({ id: 'spiel-12', homeTeam: { id: 'sv-sued', name: 'SV Süd' }, awayTeam: { id: 'fc-nord', name: 'FC Nord' } }), { leibchen: leibchen(ROT, ROT) })} />);
    expect(screen.queryByRole('button', { name: /Leibchen für/ })).toBeNull();
    expect(screen.queryByTestId('scoreboard-farb-hinweis')).toBeNull();
  });
});

describe('@SL-197 vor dem Anpfiff die Spielzeit aus den Regeln', () => {
  it('@SL-197 9 Minuten → groß „9:00“, darunter „Anstoß hh:mm · Spiel 12 · Feld 1“', () => {
    render(<LiveCockpit {...makeProps(spiel12(), { spielzeit: { abschnitte: 1, abschnittSekunden: 540 } })} />);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('9:00');
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('Spielzeit');
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent(/^Anstoß \d{2}:\d{2} · Spiel 12 · Feld 1$/);
  });

  it('@SL-197 zwei Abschnitte zu 4 Minuten → „2 ד vor „4:00“', () => {
    render(<LiveCockpit {...makeProps(spiel12(), { spielzeit: { abschnitte: 2, abschnittSekunden: 240 } })} />);
    expect(screen.getByTestId('scoreboard-clock-vorsatz')).toHaveTextContent('2 ×');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('4:00');
  });
});
