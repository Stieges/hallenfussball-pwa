/**
 * @SL-191 Nimmt Tom ein Eigentor zurück, steht im Verlauf genau eine durchgestrichene Zeile (Befund C-RUECKGAENGIG-DOPPELTE-ZEILEN).
 * Die Kette ist die echte: Eigentor-Weg des Cockpits (Tor-Tipp, RETRACT, OWN_GOAL, „Rückgängig“) -> Engine-Zustand -> Anzeige-Adapter
 * (`toRuntimeEvents`/`toRetractedEvents`) -> Protokoll (`Sidebar`). Der Wortlaut „Eigentor SV Süd, Nr. 4, 5:40“ ist offen
 * (Befund C-EIGENTOR-PROTOKOLLZEILE): die Zeile heißt heute „Tor <begünstigtes Team>“; als `it.fails` festgehalten.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { toRetractedEvents, toRuntimeEvents } from '../../../core/match/client/viewAdapters';
import { effectiveScoreFor, reduceMatch, type EngineEvent, type MatchContext } from '../../../core/match';
import { RULES } from '../../../core/match/client/__tests__/fixtures';

vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      de,
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) { text = text.replace(`{{${name}}}`, String(value)); }
    return text;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const CTX: MatchContext = { matchId: 'spiel-11', teamAId: 'fc-nord', teamBId: 'sv-sued' };
const ev = (partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent =>
  ({ actor: 'helper', section: 1, clockMs: null, teamId: null, targetId: null, payload: {}, ...partial });

// Stand 1:0 durch ein Tor von FC Nord, dann das Eigentor von SV Süd (Nr. 4) bei 5:40 -> 2:0; danach „Rückgängig“ -> 1:0
const log = [
  ev({ id: 's', type: 'MATCH_START', at: 1_000, clockMs: 0, payload: { rules: RULES } }),
  ev({ id: 'g0', type: 'GOAL', at: 1_500, clockMs: 100_000, teamId: 'fc-nord' }),
  ev({ id: 'tipp', type: 'GOAL', at: 2_000, clockMs: 340_000, teamId: 'fc-nord' }),
  ev({ id: 'r-tipp', type: 'RETRACT', at: 2_050, targetId: 'tipp' }),
  ev({ id: 'og', type: 'OWN_GOAL', at: 2_100, clockMs: 340_000, teamId: 'sv-sued', payload: { playerNumber: 4 } }),
  ev({ id: 'r-og', type: 'RETRACT', at: 5_000, targetId: 'og' }),
];

function protokoll() {
  const state = reduceMatch(log, CTX).state;
  render(
    <Sidebar
      events={toRuntimeEvents(state, log, CTX)}
      retractedEvents={toRetractedEvents(state, log, CTX)}
      homeTeamName="FC Nord" awayTeamName="SV Süd" homeTeamId="fc-nord" awayTeamId="sv-sued"
    />,
  );
  return state;
}

describe('@SL-191 Rückgängig beim Eigentor: Verlauf', () => {
  it('@SL-191 Spiel steht wieder bei 1:0, im Verlauf genau eine durchgestrichene Zeile und keine weitere „Tor“-Zeile für dieses Eigentor', () => {
    const state = protokoll();
    expect([effectiveScoreFor(state, 'fc-nord'), effectiveScoreFor(state, 'sv-sued')]).toEqual([1, 0]);
    expect(screen.getAllByTestId('event-row-retracted')).toHaveLength(1);
    // wirksam bleibt nur das Tor von FC Nord bei 1:40 – gezählt werden nur Zeilen außerhalb der durchgestrichenen
    expect(screen.getAllByText(/Tor FC Nord/i).filter((el) => !el.closest('[data-testid="event-row-retracted"]'))).toHaveLength(1);
  });

  it.fails('@SL-191 C-EIGENTOR-PROTOKOLLZEILE: die durchgestrichene Zeile heißt „Eigentor SV Süd, Nr. 4“ mit 05:40', () => {
    protokoll();
    const zeile = screen.getByTestId('event-row-retracted');
    expect(zeile.textContent).toMatch(/Eigentor.*SV Süd.*4/);
    expect(zeile.textContent).toContain('05:40');
  });
});
