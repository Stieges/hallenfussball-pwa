/**
 * @ZM-002 @ZM-003 Zuschauer-Seite über den echten Übertragungsweg (Antwort in der Form von `public_tournament` -> `createRpcPublicSource` ->
 * `usePublicTournament` -> Spielkarte): Tor und Zeitstrafe erscheinen als Ereigniszeile „Tor <Team>, Nr. 9, 3.“ bzw.
 * „Zeitstrafe <Team>, Nr. 5, 4.“ (angefangene Minute, ohne Uhrzeit), ohne Nummer „Tor <Team>, 12.“; Karten nach @ZM-021 „Gelbe Karte <Team>, Nr. 5“
 * (Befunde C-ZEITSTRAFE-OEFFENTLICH-UNSICHTBAR, C-ZEITSTRAFE-ZEILE-FORMAT). Spiel 9 läuft; Lage aus `payloadFixtures.ts`.
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

/** Zusätzliche Ereignisse in Spiel 9: Tor Heim ohne Nummer in Minute 12, Tor Heim Nr. 7 bei genau 60 s (Minute 2), Gelbe Karte Gast Nr. 5. */
function mitWeiterenEreignissen(): Row {
  const reply = mitZeitstrafe();
  reply.matches = (reply.matches as Row[]).map((m) => (Number(m.match_number) === RUNNING_MATCH_NUMBER
    ? {
      ...m,
      events: [
        ...(m.events as Row[]),
        { id: '11111111-2222-4333-8444-666666666661', type: 'GOAL', team_id: m.team_a_id, section: 1, clock_ms: 680_000 },
        { id: '11111111-2222-4333-8444-666666666662', type: 'GOAL', team_id: m.team_a_id, section: 1, clock_ms: 60_000, number: 7 },
        { id: '11111111-2222-4333-8444-666666666663', type: 'YELLOW_CARD', team_id: m.team_b_id, section: 1, clock_ms: 90_000, number: 5 },
      ],
    }
    : m));
  return reply;
}

async function karteOeffnen(antwort: Row) {
  rpcCall.mockImplementation(() => Promise.resolve({ data: antwort, error: null }));
  render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={['/live/NIK6ST']}><LiveViewScreen shareCode="NIK6ST" /></MemoryRouter>
    </RepositoryProvider>,
  );
  const karte = (await screen.findAllByTestId('match-clock'))[0].closest('[data-match-card]')!;
  await userEvent.click(karte);
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

  // @ZM-003: ohne Rückennummer „Tor <Heim>, 12.“; mit Nummer „Tor <Heim>, Nr. 7, 2.“ (genau 60 s ist schon Minute 2, nicht 1)
  it('@ZM-003 Tor ohne Rückennummer: „Tor <Heim>, 12.“ (nicht „Nr. null“)', async () => {
    await karteOeffnen(mitWeiterenEreignissen());
    const heim = String(((await screen.findAllByText(/^Tor .+, 12\.$/))[0]).textContent).replace(/^Tor /, '').replace(/, 12\.$/, '');
    expect(heim.length).toBeGreaterThan(0);
    expect(heim).not.toMatch(/Nr\./);
  });

  it('@ZM-002 Minute ist die angefangene: 40 s -> „Tor <Heim>, Nr. 3, 1.“, genau 60 s -> „Tor <Heim>, Nr. 7, 2.“', async () => {
    await karteOeffnen(mitWeiterenEreignissen());
    expect((await screen.findAllByText(/^Tor .+, Nr\. 3, 1\.$/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/^Tor .+, Nr\. 7, 2\.$/)).length).toBeGreaterThan(0);
  });

  it('@ZM-021 Karte: „Gelbe Karte <Gast>, Nr. 5“ ohne Uhrzeit und ohne „#“', async () => {
    await karteOeffnen(mitWeiterenEreignissen());
    const zeilen = await screen.findAllByText(/^Gelbe Karte .+, Nr\. 5$/);
    expect(zeilen.length).toBeGreaterThan(0);
    for (const zeile of zeilen) { expect(zeile.parentElement?.textContent).not.toMatch(/\d\d:\d\d|#/); }
  });
});
