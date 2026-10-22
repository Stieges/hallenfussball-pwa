/**
 * B-49 Steuer je Feld im Cockpit (Befund C-HELFER-FELD-OHNE-SPERRE). Echte Texte (DE), echter Dialog, echte Nur-Lesen-Zeile und
 * Feldwahl; der Server ist ein kleines Abbild des Vertrags aus `20261110_003_field_control.sql` (A-34, belegt gegen echtes Postgres
 * in scripts/field-control-check.sh): je Feld Halter = Geräte-ID mit Epoche, `isMine` aus Sicht des fragenden Geräts, Übernahme nur
 * mit passender Epoche. Jedes Gerät ist eine eigene Instanz mit eigener Geräte-ID.
 * Werte aus dem Gherkin: Live-Cup, Feld 2, Tom (Helfer, Handy), Olli (Turnierleitung), Clara (Helferin), Spiel 11.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

vi.unmock('i18next');
vi.unmock('react-i18next');

const geraet = vi.hoisted(() => ({ id: 'tom-handy' }));
vi.mock('../../../../core/device/deviceId', () => ({ getDeviceId: () => geraet.id }));

/**
 * Abbild des Servers (A-34): Feld → Halter (Konto UND Geräte-ID, `holder_user_id`/`holder_device_id`), Bezeichnung, Epoche.
 * Das Konto des Aufrufers (`auth.uid()`) ist das Konto des Geräts (`tom-handy` → `tom`), außer `kontoWechsel` ist gesetzt.
 */
const server = vi.hoisted(() => ({
  felder: new Map<number, { epoch: number; halter: string | null; label: string | null; konto?: string }>(),
  namen: new Map<string, string>([['tom', 'Tom'], ['olli', 'Olli'], ['clara', 'Clara'], ['maria', 'Maria']]),
  kontoWechsel: null as string | null,
  rpc: vi.fn(),
}));
vi.mock('../../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: server.rpc } }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../match-engine/matchEngineContextInstance';
import { NurLesenLeiste } from '../../../../components/live-cockpit/areas/NurLesenLeiste';
import { FeldWahl } from '../../../../components/live-cockpit/frame/FeldWahl';
import type { LiveMatch } from '../../../../components/live-cockpit/types';
import { useCockpitFieldControl } from '../useCockpitFieldControl';

await initRealDeI18n();

const kontoVon = (geraetId: string): string => server.kontoWechsel ?? geraetId.split('-')[0];
const halterKonto = (f: { halter: string | null; konto?: string }): string | null => (f.halter === null ? null : f.konto ?? f.halter.split('-')[0]);

function info(field: number, f: { epoch: number; halter: string | null; label: string | null; konto?: string }, fragt: string) {
  const konto = halterKonto(f);
  return {
    field, epoch: f.epoch, holderName: konto ? server.namen.get(konto) ?? null : null, holderRole: f.halter ? 'helper' : null,
    holderDeviceLabel: f.halter ? f.label : null,
    // field_control_info: holder_user_id = auth.uid() AND holder_device_id = p_device_id
    isMine: konto !== null && konto === kontoVon(fragt) && f.halter === fragt,
    claimedAt: f.halter ? 1_790_000_000_000 : null,
  };
}

function antwort(fn: string, args: Record<string, unknown>): unknown {
  const fragt = String(args.p_device_id);
  if (fn === 'field_control_state') {
    return [...server.felder].map(([field, f]) => info(field, f, fragt));
  }
  const field = Number(args.p_field);
  const f = server.felder.get(field) ?? { epoch: 0, halter: null, label: null };
  if (args.p_expected_epoch !== f.epoch) {
    return { status: 'rejected', code: 'CONTROL_CHANGED', control: info(field, f, fragt), serverTime: 1 };
  }
  if (f.halter === fragt && halterKonto(f) === kontoVon(fragt)) {
    server.felder.set(field, { ...f, label: (args.p_device_label as string | undefined) ?? f.label });
    return { status: 'unchanged', control: info(field, server.felder.get(field) ?? f, fragt), serverTime: 1 };
  }
  const previous = f.halter ? info(field, f, fragt) : null;
  server.felder.set(field, { epoch: f.epoch + 1, halter: fragt, konto: kontoVon(fragt), label: (args.p_device_label as string | undefined) ?? null });
  return { status: 'taken', control: info(field, server.felder.get(field) ?? f, fragt), previous, serverTime: 1 };
}

/** Sende-Läufe des Ausgangs je Gerät (nach jedem Lauf liest das Cockpit die Steuer neu). */
const listeners = new Set<() => void>();
const kick = vi.fn(() => Promise.resolve());
const engine = { sender: { subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; }, kick }, accountId: 'konto' } as unknown as MatchEngineContextValue;
const sendeLauf = () => { act(() => { for (const l of listeners) { l(); } }); };

const spiel = (status: LiveMatch['status']) => ({ id: 'spiel-11', status } as LiveMatch);

function Cockpit({ name, istLeitung, match = spiel('RUNNING'), feld = 2 }: { name: string; istLeitung: boolean; match?: LiveMatch | null; feld?: number }) {
  // Läuft auf dem Feld ein Spiel? Hier nur das Spiel des Cockpits (ManagementTab prüft alle Spiele des Felds, laeuftAufFeld)
  const feldLaeuft = match !== null && (match.status === 'RUNNING' || match.status === 'PAUSED');
  const steuer = useCockpitFieldControl({ tournamentId: 'live-cup', feld, feldName: `Feld ${feld}`, canPlay: true, istLeitung, feldLaeuft, currentMatch: match });
  return (
    <section data-testid={`geraet-${name}`}>
      <span data-testid="kann">{String(steuer.kannSteuern)}</span>
      <span data-testid="uebernahme">{steuer.uebernahmeVon ?? '–'}</span>
      {steuer.steuerung && <NurLesenLeiste fieldName={`Feld ${feld}`} steuerung={steuer.steuerung} mitEreignissen={false} onEreignisse={() => undefined} onMehr={() => undefined} />}
      <FeldWahl felder={2} feld={feld} onFeld={() => undefined} halter={steuer.halter} />
      {steuer.dialog}
    </section>
  );
}

function geraetStarten(id: string, ui: ReactNode) {
  geraet.id = id;
  return render(<MatchEngineContext.Provider value={engine}>{ui}</MatchEngineContext.Provider>);
}

const von = (name: string) => within(screen.getByTestId(`geraet-${name}`));
let online = true;

beforeEach(() => {
  server.felder.clear();
  server.kontoWechsel = null;
  server.rpc.mockReset();
  server.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => (fn === 'take_field_control' && !online
    ? Promise.reject(new TypeError('Failed to fetch'))
    : Promise.resolve({ data: antwort(fn, args), error: null })));
  listeners.clear();
  kick.mockClear();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});
afterEach(() => { vi.restoreAllMocks(); });

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const takeVon = (id: string) => server.rpc.mock.calls.filter(([fn, args]) => fn === 'take_field_control' && (args as { p_device_id: string }).p_device_id === id);
const takeCalls = () => server.rpc.mock.calls.filter(([fn, args]) => fn === 'take_field_control' && (args as { p_device_id: string }).p_device_id === 'olli-tablet');

describe('B-49 Cockpit: Steuer je Feld', () => {
  it('@FU-026 Toms Gerät steuert Feld 2: Olli sieht „Feld 2 wird von Tom (Handy) gesteuert“, kann nicht eintragen, sieht „Spielleitung übernehmen“', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' });
    geraetStarten('olli-tablet', <Cockpit name="olli" istLeitung />);
    expect(await von('olli').findByText('Feld 2 wird von Tom (Handy) gesteuert')).toBeInTheDocument();
    expect(von('olli').getByTestId('kann')).toHaveTextContent('false');
    expect(von('olli').getByRole('button', { name: 'Spielleitung übernehmen' })).toBeInTheDocument();
  });

  it('@FU-026 Gegenbeispiel: Toms Handy selbst steuert Feld 2 und trägt ein – keine Nur-Lesen-Zeile', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' });
    geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} />);
    await waitFor(() => expect(von('tom').getByRole('option', { name: 'Feld 2: dieses Gerät' })).toBeInTheDocument());
    expect(von('tom').getByTestId('kann')).toHaveTextContent('true');
    expect(von('tom').queryByTestId('leiste-nur-lesen')).toBeNull();
  });

  it('@FU-027 @SL-046 Olli bestätigt „Spielleitung übernehmen“: Ollis Gerät steuert, Toms Gerät zeigt „Die Spielleitung hat jetzt Olli (Laptop)“ und trägt nicht mehr ein', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' });
    geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} />);
    await waitFor(() => expect(von('tom').getByTestId('kann')).toHaveTextContent('true'));
    geraetStarten('olli-tablet', <Cockpit name="olli" istLeitung />);
    await userEvent.click(await von('olli').findByRole('button', { name: 'Spielleitung übernehmen' }));
    // Rückfrage nennt Halter und Folge; erst die Bestätigung übernimmt
    expect(screen.getByTestId('takeover-halter')).toHaveTextContent('Feld 2 wird gerade von Tom (Handy) gesteuert');
    expect(takeCalls()).toHaveLength(0);
    await userEvent.click(screen.getByTestId('takeover-confirm'));

    await waitFor(() => expect(von('olli').getByTestId('kann')).toHaveTextContent('true'));
    expect(takeCalls()[0][1]).toMatchObject({ p_tournament_id: 'live-cup', p_field: 2, p_expected_epoch: 1, p_device_label: 'computer' });
    expect(screen.queryByTestId('takeover-dialog')).toBeNull();
    expect(kick).toHaveBeenCalled();

    sendeLauf();
    expect(await von('tom').findByText('Die Spielleitung hat jetzt Olli (Laptop)')).toBeInTheDocument();
    expect(von('tom').getByTestId('kann')).toHaveTextContent('false');
  });

  it.each([
    ['Olli (normale Übernahme, ohne Notübernahme)', 'olli-tablet', true],
  ])('@FU-028 %s hat kein Netz: „Übernehmen geht nur mit Netz“, Toms Gerät steuert weiter', async (_person, id, leitung) => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' });
    geraetStarten(id, <Cockpit name="person" istLeitung={leitung} />);
    await userEvent.click(await von('person').findByRole('button', { name: 'Spielleitung übernehmen' }));
    online = false;
    await userEvent.click(screen.getByTestId('takeover-confirm'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Übernehmen geht nur mit Netz');
    expect(server.rpc.mock.calls.some(([fn]) => fn === 'take_field_control')).toBe(false);
    expect(server.felder.get(2)?.halter).toBe('tom-handy');
    expect(von('person').getByTestId('kann')).toHaveTextContent('false');
    // @FU-034 (MVP+): keine Notübernahme ohne Netz – der Dialog bietet nichts anderes an
    expect(within(screen.getByTestId('takeover-actions')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Abbrechen', 'Spielleitung übernehmen']);
  });

  it('@FU-028 @FU-120 Helferin Clara bei laufendem Spiel: kein „Spielleitung übernehmen“ (Turnierleitung gegen Helfer), Toms Gerät steuert weiter', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' });
    geraetStarten('clara-handy', <Cockpit name="clara" istLeitung={false} />);
    expect(await von('clara').findByText('Feld 2 wird von Tom (Handy) gesteuert')).toBeInTheDocument();
    expect(von('clara').queryByRole('button', { name: 'Spielleitung übernehmen' })).toBeNull();
    expect(von('clara').getByTestId('kann')).toHaveTextContent('false');
    expect(server.felder.get(2)?.halter).toBe('tom-handy');
  });

  it('@FU-028 Übernahme kam zu spät (inzwischen Maria): Hinweis, keine Übernahme ohne aktuellen Stand', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' });
    geraetStarten('olli-tablet', <Cockpit name="olli" istLeitung />);
    await userEvent.click(await von('olli').findByRole('button', { name: 'Spielleitung übernehmen' }));
    server.felder.set(2, { epoch: 2, halter: 'maria-handy', label: 'phone' });
    await userEvent.click(screen.getByTestId('takeover-confirm'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Feld 2 wird jetzt von Maria (Handy) gesteuert');
    expect(server.felder.get(2)?.halter).toBe('maria-handy');
  });

  it('@SL-015 @FU-111 Toms Tablet ist aus, Olli übernimmt das laufende Spiel 11: Hinweis „Uhr prüfen“ mit Toms Namen', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-tablet', label: 'tablet' });
    geraetStarten('olli-tablet', <Cockpit name="olli" istLeitung match={spiel('RUNNING')} />);
    await userEvent.click(await von('olli').findByRole('button', { name: 'Spielleitung übernehmen' }));
    await userEvent.click(screen.getByTestId('takeover-confirm'));
    await waitFor(() => expect(von('olli').getByTestId('uebernahme')).toHaveTextContent('Tom'));
    expect(von('olli').getByTestId('kann')).toHaveTextContent('true');
  });

  it('@SL-116 Übernahme kurz nach dem Abpfiff: Ollis Gerät steuert (Endstand und „Weiter“ kommen aus der Abpfiff-Zeit), kein Uhr-Hinweis', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-tablet', label: 'tablet' });
    geraetStarten('olli-tablet', <Cockpit name="olli" istLeitung match={spiel('FINISHED')} />);
    await userEvent.click(await von('olli').findByRole('button', { name: 'Spielleitung übernehmen' }));
    await userEvent.click(screen.getByTestId('takeover-confirm'));
    await waitFor(() => expect(von('olli').getByTestId('kann')).toHaveTextContent('true'));
    expect(von('olli').getByTestId('uebernahme')).toHaveTextContent('–');
  });

  it('@FU-030 gleichzeitiger Anpfiff: Tom bekommt das Feld, Claras Gerät zeigt nach dem Sende-Lauf „Feld 2 wird von Tom (Handy) gesteuert“', async () => {
    geraetStarten('clara-handy', <Cockpit name="clara" istLeitung={false} match={spiel('NOT_STARTED')} />);
    await waitFor(() => expect(server.rpc).toHaveBeenCalled());
    expect(von('clara').getByTestId('kann')).toHaveTextContent('true'); // frei: Clara darf anpfeifen
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' }); // Server: Tom kam zuerst, Claras Anpfiff abgelehnt
    sendeLauf();
    expect(await von('clara').findByText('Feld 2 wird von Tom (Handy) gesteuert')).toBeInTheDocument();
    expect(von('clara').getByTestId('kann')).toHaveTextContent('false');
  });

  it('@HE-049 Gegenbeispiel: gleiche Geräte-ID, anderes Konto (Kontowechsel am Feld-Tablet) – das Feld ist fremd, nur lesend', async () => {
    server.felder.set(2, { epoch: 1, halter: 'feld-tablet', konto: 'tom', label: 'tablet' });
    server.kontoWechsel = 'olli'; // Olli meldet sich auf Toms Feld-Tablet an, Geräte-ID bleibt
    geraetStarten('feld-tablet', <Cockpit name="tablet" istLeitung />);
    expect(await von('tablet').findByText('Feld 2 wird von Tom (Tablet) gesteuert')).toBeInTheDocument();
    expect(von('tablet').getByTestId('kann')).toHaveTextContent('false');
    expect(von('tablet').getByRole('option', { name: 'Feld 2: Tom (Tablet)' })).toBeInTheDocument();
  });

  it('@HE-049 Gegenbeispiel: gleiche Geräte-ID, gleiches Konto – dieses Gerät steuert', async () => {
    server.felder.set(2, { epoch: 1, halter: 'feld-tablet', konto: 'tom', label: 'tablet' });
    server.kontoWechsel = 'tom';
    geraetStarten('feld-tablet', <Cockpit name="tablet" istLeitung />);
    expect(await von('tablet').findByRole('option', { name: 'Feld 2: dieses Gerät' })).toBeInTheDocument();
    expect(von('tablet').getByTestId('kann')).toHaveTextContent('true');
  });

  it('@HE-049 Feldübersicht: Olli sieht „Feld 2: Tom (Handy)“', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: 'phone' });
    geraetStarten('olli-tablet', <Cockpit name="olli" istLeitung />);
    expect(await von('olli').findByRole('option', { name: 'Feld 2: Tom (Handy)' })).toBeInTheDocument();
    expect(von('olli').getByRole('option', { name: 'Feld 1' })).toBeInTheDocument();
  });

  it('@HE-049 Toms Gerät hat Feld 2 per Anpfiff (ohne Bezeichnung) – es trägt seine Bezeichnung mit der aktuellen Epoche nach', async () => {
    server.felder.set(2, { epoch: 1, halter: 'tom-handy', label: null });
    geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} />);
    await waitFor(() => expect(server.felder.get(2)?.label).toBe('computer'));
    const nachtrag = server.rpc.mock.calls.find(([fn]) => fn === 'take_field_control');
    expect(nachtrag?.[1]).toMatchObject({ p_field: 2, p_expected_epoch: 1, p_device_id: 'tom-handy' });
    expect(server.felder.get(2)?.epoch).toBe(1);
  });
});

describe('@FU-120 Helfer übernimmt ein Feld nur ausdrücklich und nur, wenn dort kein Spiel läuft', () => {
  beforeEach(() => {
    server.namen.set('olli', 'Olli');
    server.felder.set(1, { epoch: 1, halter: 'olli-laptop', label: 'computer' });
  });

  it('@FU-120 Ollis Laptop steuert Feld 1, kein Spiel läuft: Tom wählt „Spielleitung übernehmen“, bestätigt, Toms Handy steuert, Ollis Laptop zeigt „Die Spielleitung hat jetzt Tom (Handy)“', async () => {
    geraetStarten('olli-laptop', <Cockpit name="olli" istLeitung feld={1} match={spiel('NOT_STARTED')} />);
    await waitFor(() => expect(von('olli').getByTestId('kann')).toHaveTextContent('true'));
    geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} feld={1} match={spiel('NOT_STARTED')} />);
    expect(await von('tom').findByText('Feld 1 wird von Olli (Laptop) gesteuert')).toBeInTheDocument();
    expect(von('tom').getByTestId('kann')).toHaveTextContent('false');

    await userEvent.click(von('tom').getByRole('button', { name: 'Spielleitung übernehmen' }));
    expect(screen.getByTestId('takeover-halter')).toHaveTextContent('Feld 1 wird gerade von Olli (Laptop) gesteuert');
    expect(takeVon('tom-handy')).toHaveLength(0); // erst die Bestätigung übernimmt
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    await userEvent.click(screen.getByTestId('takeover-confirm'));

    await waitFor(() => expect(von('tom').getByTestId('kann')).toHaveTextContent('true'));
    expect(takeVon('tom-handy')[0][1]).toMatchObject({ p_tournament_id: 'live-cup', p_field: 1, p_expected_epoch: 1, p_device_label: 'phone' });
    expect(server.felder.get(1)).toMatchObject({ epoch: 2, halter: 'tom-handy' });
    sendeLauf();
    expect(await von('olli').findByText('Die Spielleitung hat jetzt Tom (Handy)')).toBeInTheDocument();
    expect(von('olli').getByTestId('kann')).toHaveTextContent('false');
  });

  it('@FU-120 Aber: tippt Tom nur „Anpfiff“ ohne zu übernehmen, übernimmt die App nie von selbst (fremdes Feld nur lesend, kein Aufruf)', async () => {
    geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} feld={1} match={spiel('NOT_STARTED')} />);
    expect(await von('tom').findByText('Feld 1 wird von Olli (Laptop) gesteuert')).toBeInTheDocument();
    sendeLauf();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    expect(von('tom').getByTestId('kann')).toHaveTextContent('false'); // kein Anpfiff im Nur-Lesen-Modus (@SL-018)
    expect(takeVon('tom-handy')).toHaveLength(0);
    expect(server.felder.get(1)?.halter).toBe('olli-laptop');
  });

  it.each([['läuft', 'RUNNING'], ['ist pausiert bzw. in der Halbzeit', 'PAUSED']] as const)(
    '@FU-120 Und: %s auf Feld 1 gerade ein Spiel, bietet die App Tom „Spielleitung übernehmen“ nicht an',
    async (_fall, status) => {
      geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} feld={1} match={spiel(status)} />);
      expect(await von('tom').findByText('Feld 1 wird von Olli (Laptop) gesteuert')).toBeInTheDocument();
      expect(von('tom').queryByRole('button', { name: 'Spielleitung übernehmen' })).toBeNull();
    },
  );

  it('@FU-120 Gegenbeispiel: Tom bricht die Rückfrage ab – kein Aufruf, Olli steuert weiter', async () => {
    geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} feld={1} match={spiel('FINISHED')} />);
    await userEvent.click(await von('tom').findByRole('button', { name: 'Spielleitung übernehmen' }));
    await userEvent.click(screen.getByTestId('takeover-cancel'));
    expect(screen.queryByTestId('takeover-dialog')).toBeNull();
    expect(takeVon('tom-handy')).toHaveLength(0);
    expect(server.felder.get(1)?.halter).toBe('olli-laptop');
  });

  it('@FU-120 @FU-028 Tom ohne Netz: „Übernehmen geht nur mit Netz“, Olli steuert weiter', async () => {
    geraetStarten('tom-handy', <Cockpit name="tom" istLeitung={false} feld={1} match={spiel('NOT_STARTED')} />);
    await userEvent.click(await von('tom').findByRole('button', { name: 'Spielleitung übernehmen' }));
    online = false;
    await userEvent.click(screen.getByTestId('takeover-confirm'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Übernehmen geht nur mit Netz');
    expect(takeVon('tom-handy')).toHaveLength(0);
    expect(server.felder.get(1)?.halter).toBe('olli-laptop');
  });
});
