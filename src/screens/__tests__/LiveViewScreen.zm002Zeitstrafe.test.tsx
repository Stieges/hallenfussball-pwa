/**
 * @ZM-002 Zuschauer-Seite über den echten Übertragungsweg (Antwort in der Form von `public_tournament` -> `createRpcPublicSource` ->
 * `usePublicTournament` -> Spielkarte): Eine Zeitstrafe erscheint wie das Tor als Ereigniszeile „Zeitstrafe <Team> #<Nr>“ mit Spielzeit
 * (Befund C-ZEITSTRAFE-OEFFENTLICH-UNSICHTBAR, Prod-Nachlauf N4). Spiel 9 läuft; Lage aus `payloadFixtures.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PublicRpcArgs, PublicRpcResponse } from '../../features/public-view/rpcPublicSource';

const { rpcCall } = vi.hoisted(() => ({ rpcCall: vi.fn<(args: PublicRpcArgs) => Promise<PublicRpcResponse>>() }));
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createRpcPublicSource } = await import('../../features/public-view/rpcPublicSource');
  return { defaultPublicTournamentSource: createRpcPublicSource({ call: rpcCall }) };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import { fullReply, RUNNING_MATCH_NUMBER } from '../../features/public-view/__tests__/payloadFixtures';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

type Row = Record<string, unknown>;

/** Antwort mit einer Zeitstrafe (Nr. 5, 4. Minute, 2 Minuten) des Auswärtsteams in Spiel 9. */
function mitZeitstrafe(): Row {
  const reply = fullReply();
  reply.matches = (reply.matches as Row[]).map((m) => (Number(m.match_number) === RUNNING_MATCH_NUMBER
    ? {
      ...m,
      events: [...(m.events as Row[]), { id: '11111111-2222-4333-8444-555555555555', type: 'TIME_PENALTY', team_id: m.team_b_id, section: 1, clock_ms: 200_000, number: 5, duration_seconds: 120 }],
    }
    : m));
  return reply;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('@ZM-002 Zuschauer-Seite zeigt Tor und Zeitstrafe als Ereigniszeile (echte Server-Antwort, @ZM-180)', () => {
  it('Wächter: Spiel 9 aufgeklappt zeigt überhaupt eine Zeitstrafe-Zeile mit dem Team (Format siehe unten)', async () => {
    rpcCall.mockImplementation(() => Promise.resolve({ data: mitZeitstrafe(), error: null }));
    render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={['/live/NIK6ST']}><LiveViewScreen shareCode="NIK6ST" /></MemoryRouter>
      </RepositoryProvider>,
    );
    const karte = (await screen.findAllByTestId('match-clock'))[0].closest('[data-match-card]')!;
    await userEvent.click(karte);
    const zeilen = await screen.findAllByText(/Zeitstrafe \S/);
    expect(zeilen.length).toBeGreaterThan(0);
  });

  it('Gegenbeispiel: ohne Zeitstrafe im Ereignisstrom steht keine Zeitstrafe-Zeile da', async () => {
    rpcCall.mockImplementation(() => Promise.resolve({ data: fullReply(), error: null }));
    render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={['/live/NIK6ST']}><LiveViewScreen shareCode="NIK6ST" /></MemoryRouter>
      </RepositoryProvider>,
    );
    const karte = (await screen.findAllByTestId('match-clock'))[0].closest('[data-match-card]')!;
    await userEvent.click(karte);
    expect(screen.queryByText(/Zeitstrafe/)).toBeNull();
  });

  // @ZM-002: Ereigniszeile „Zeitstrafe SV Süd, Nr. 5, 4.“ – Team, Rückennummer als „Nr.“, Minute „4.“ (nicht Uhrzeit 03:20).
  it('@ZM-002 C-ZEITSTRAFE-ZEILE-FORMAT: die Zeile lautet „Zeitstrafe <Team>, Nr. 5, 4.“ (Minute statt Uhrzeit)', async () => {
    rpcCall.mockImplementation(() => Promise.resolve({ data: mitZeitstrafe(), error: null }));
    render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={['/live/NIK6ST']}><LiveViewScreen shareCode="NIK6ST" /></MemoryRouter>
      </RepositoryProvider>,
    );
    const karte = (await screen.findAllByTestId('match-clock'))[0].closest('[data-match-card]')!;
    await userEvent.click(karte);
    const zeilen = await screen.findAllByText(/^Zeitstrafe .+, Nr\. 5, 4\.$/);
    for (const zeile of zeilen) { expect(zeile.textContent).not.toMatch(/#|03:20/); }
    expect(screen.queryByText('03:20')).toBeNull();
  });

  // @ZM-002: „Tor FC Nord, Nr. 9, 3.“ (ohne Rückennummer „Tor FC Nord, 12.“, @ZM-003); Fixture: Tore mit Nr. 3.., Sekunde 40 + 70 n -> Minute 1, 2 ...
  it('@ZM-002 C-ZEITSTRAFE-ZEILE-FORMAT: Torzeilen lauten „Tor <Team>, Nr. <n>, <Minute>.“ (Minute statt Uhrzeit)', async () => {
    rpcCall.mockImplementation(() => Promise.resolve({ data: mitZeitstrafe(), error: null }));
    render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={['/live/NIK6ST']}><LiveViewScreen shareCode="NIK6ST" /></MemoryRouter>
      </RepositoryProvider>,
    );
    const karte = (await screen.findAllByTestId('match-clock'))[0].closest('[data-match-card]')!;
    await userEvent.click(karte);
    const zeilen = await screen.findAllByText(/^Tor .+, Nr\. \d+, \d+\.$/);
    expect(zeilen.length).toBeGreaterThan(0);
    for (const zeile of zeilen) { expect(zeile.textContent).not.toMatch(/#|TOR|\d\d:\d\d/); }
  });
});
