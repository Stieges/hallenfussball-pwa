/**
 * @OB-087 Zeilen 1 und 5 am Kasten unter der Tafel im Cockpit (Oberfläche, echte DE-Texte):
 * - Zeile 1: Tom leitet Spiel 11, im Cockpit steht „Kein Netz – Halle zeigt alten Stand“ → Taste „Verbinden“ (≥ 44 px), versucht die Verbindung neu,
 *   gesperrt und „Verbinde …“ solange der Versuch läuft, kein Doppelaufruf; gelingt es, verschwindet der Hinweis.
 * - Zeile 5: Ist dieses Gerät selbst Hallen-Lautsprecher des Felds und steht „Grund: Ton nicht aktiviert“ → Taste „Ton aktivieren“; auf einem anderen Gerät
 *   (oder bei anderem Grund) fehlt sie.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { touchTargets } from '../../../../design-tokens';
import type { HallStatus } from '../../useHallStatus';
import type { LeitungLebenszeichen, LeitungStand } from '../../runtime/leitungLebenszeichen';

import hallenton from '../../../../i18n/locales/de/hallenton.json';
import cockpit from '../../../../i18n/locales/de/cockpit.json';

// echte DE-Texte der beiden Namensräume (`hallenton` fehlt in `initRealDeI18n`)
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    i18n: { language: 'de' },
    t: (key: string, opts?: Record<string, unknown>) => {
      const quelle = ns === 'cockpit' ? cockpit : hallenton;
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], quelle);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));
const statusMock = vi.hoisted(() => ({ wert: null as unknown as HallStatus }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => statusMock.wert }));
vi.mock('../../useUhrAbgeglichen', () => ({ useUhrAbgeglichen: () => true }));
const verbinden = vi.hoisted(() => ({ reconnect: vi.fn(), resync: vi.fn() }));
vi.mock('../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ reconnect: verbinden.reconnect }) }));
vi.mock('../../../match-engine/useResyncNow', () => ({ useResyncNow: () => verbinden.resync }));
const geraet = vi.hoisted(() => ({
  wert: { rolle: 'keiner', felder: [] as number[], laufzeit: null as null | { rolle: string; zustandJeFeld: Record<string, string> }, tonAktivieren: vi.fn() },
}));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => geraet.wert }));

import { setzeLeitung } from '../../leitungGeraet';
import { CockpitHallHinweis } from '../CockpitHallHinweis';

const TID = 'tour-1';
const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
let version = 1;
const hoerer = new Set<() => void>();
function leitung(stand: LeitungStand | null, gescheitert = false): LeitungLebenszeichen {
  return {
    start: vi.fn(), stop: vi.fn(), stand: () => stand, versuchGescheitert: () => gescheitert, version: () => version, jetzt: () => 1000,
    subscribe: (fn) => { hoerer.add(fn); return () => { hoerer.delete(fn); }; },
  };
}
const stand = (state: 'ready' | 'not_activated' | 'slept'): LeitungStand => ({
  status: 'ok', speaker: { state, ageMs: 2000, outputHint: false }, serverNow: SERVER_JETZT, empfangenUm: 900,
});
const zeige = () => render(<CockpitHallHinweis tournamentId={TID} feldId="field-1" zustand="laeuft" kannSteuern />);

beforeEach(() => {
  version = 1;
  hoerer.clear();
  verbinden.reconnect.mockReset().mockResolvedValue(false);
  verbinden.resync.mockReset().mockResolvedValue(undefined);
  geraet.wert = { rolle: 'keiner', felder: [], laufzeit: null, tonAktivieren: vi.fn().mockResolvedValue(true) };
  statusMock.wert = { stand: 'aktuell', antwort: null, felder: { 1: { art: 'bereit', pruefen: false } }, lautsprecherBekannt: true, letzteSprecher: [], testtonAnfordern: vi.fn(), gehoert: vi.fn() };
});
afterEach(() => { setzeLeitung(null); });

describe('@OB-087 Zeile 1 – „Verbinden“ am Kasten „Kein Netz – Halle zeigt alten Stand“', () => {
  it('@OB-087 Zeile 1: am Kasten steht „Verbinden“ (≥ 44 px); ein Tipp ruft Anmeldung und Übertragung je einmal auf', async () => {
    setzeLeitung(leitung(stand('ready'), true));
    zeige();
    const kasten = screen.getByTestId('cockpit-hall-kein-netz');
    const taste = screen.getByTestId('cockpit-hall-verbinden');
    expect(kasten).toContainElement(taste);
    expect(taste).toHaveTextContent('Verbinden');
    expect(taste).toHaveStyle({ minHeight: touchTargets.minimum });
    await act(async () => { fireEvent.click(taste); await Promise.resolve(); });
    expect(verbinden.reconnect).toHaveBeenCalledTimes(1);
    expect(verbinden.resync).toHaveBeenCalledTimes(1);
  });

  it('@OB-087 Zeile 1: solange der Versuch läuft, ist die Taste gesperrt und zeigt „Verbinde …“; ein zweiter Tipp löst nichts doppelt aus', async () => {
    setzeLeitung(leitung(stand('ready'), true));
    let fertig: () => void = () => undefined;
    verbinden.resync.mockImplementation(() => new Promise<void>((ok) => { fertig = ok; }));
    zeige();
    const taste = screen.getByTestId('cockpit-hall-verbinden');
    await act(async () => { fireEvent.click(taste); fireEvent.click(taste); await Promise.resolve(); });
    expect(verbinden.reconnect).toHaveBeenCalledTimes(1);
    expect(verbinden.resync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cockpit-hall-verbinden')).toHaveTextContent('Verbinde …');
    expect(screen.getByTestId('cockpit-hall-verbinden')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('cockpit-hall-verbinden')).toHaveAttribute('aria-disabled', 'true');
    await act(async () => { fertig(); await new Promise((r) => setTimeout(r, 1300)); });
    expect(screen.getByTestId('cockpit-hall-verbinden')).toHaveTextContent('Verbinden');
  });

  it('@OB-087 Zeile 1: gelingt die Verbindung, antwortet der Server wieder, und der Hinweis verschwindet', () => {
    const l = leitung(stand('ready'), true);
    setzeLeitung(l);
    const { rerender } = zeige();
    expect(screen.getByTestId('cockpit-hall-kein-netz')).toBeInTheDocument();
    setzeLeitung(leitung(stand('ready'), false));
    version += 1;
    rerender(<CockpitHallHinweis tournamentId={TID} feldId="field-1" zustand="laeuft" kannSteuern />);
    expect(screen.queryByTestId('cockpit-hall-kein-netz')).toBeNull();
    expect(screen.queryByTestId('cockpit-hall-verbinden')).toBeNull();
  });

  it('@OB-087 Zeile 1 Gegenbeispiel: die anderen Kästen („Lautsprecher aus“, „Ausgang geändert“) tragen keine „Verbinden“-Taste', () => {
    setzeLeitung(leitung(stand('slept')));
    const { unmount } = zeige();
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
    expect(screen.queryByTestId('cockpit-hall-verbinden')).toBeNull();
    unmount();
    setzeLeitung(leitung({ ...stand('ready'), speaker: { state: 'ready', ageMs: 1000, outputHint: true } }));
    zeige();
    expect(screen.getByTestId('cockpit-hall-ausgang-geaendert')).toBeInTheDocument();
    expect(screen.queryByTestId('cockpit-hall-verbinden')).toBeNull();
  });
});

describe('@OB-087 Zeile 5 – „Ton aktivieren“ am Kasten „Hallen-Lautsprecher aus – Grund: Ton nicht aktiviert“', () => {
  it('@OB-087 Zeile 5: ist dieses Gerät selbst Lautsprecher des Felds, steht „Ton aktivieren“ (≥ 44 px) am Kasten; ein Tipp aktiviert den Ton dieses Geräts', async () => {
    geraet.wert.rolle = 'diesesTurnier';
    geraet.wert.felder = [1];
    setzeLeitung(leitung(stand('not_activated')));
    zeige();
    const taste = screen.getByTestId('cockpit-hall-ton-aktivieren');
    expect(screen.getByTestId('cockpit-hall-aus')).toHaveTextContent('Grund: Ton nicht aktiviert');
    expect(taste).toHaveTextContent('Ton aktivieren');
    expect(taste).toHaveStyle({ minHeight: touchTargets.minimum });
    await act(async () => { fireEvent.click(taste); await Promise.resolve(); });
    expect(geraet.wert.tonAktivieren).toHaveBeenCalledTimes(1);
  });

  it('@OB-087 Zeile 5 Gegenbeispiel: auf einem anderen Gerät (kein Lautsprecher, anderes Feld, anderes Turnier) steht keine Taste', () => {
    setzeLeitung(leitung(stand('not_activated')));
    for (const lage of [
      { rolle: 'keiner', felder: [] },
      { rolle: 'diesesTurnier', felder: [2] },
      { rolle: 'anderesTurnier', felder: [] },
    ]) {
      geraet.wert.rolle = lage.rolle;
      geraet.wert.felder = lage.felder;
      const { unmount } = zeige();
      expect(screen.getByTestId('cockpit-hall-aus')).toHaveTextContent('Grund: Ton nicht aktiviert');
      expect(screen.queryByTestId('cockpit-hall-ton-aktivieren')).toBeNull();
      unmount();
    }
  });

  it('@OB-087 Zeile 5 Gegenbeispiel: bei anderem Grund (schlafen gelegt) trägt der Kasten die Taste nicht', () => {
    geraet.wert.rolle = 'diesesTurnier';
    geraet.wert.felder = [1];
    setzeLeitung(leitung(stand('slept')));
    zeige();
    expect(screen.getByTestId('cockpit-hall-aus')).toHaveTextContent('Grund: schlafen gelegt');
    expect(screen.queryByTestId('cockpit-hall-ton-aktivieren')).toBeNull();
  });

  it('@OB-087 Zeile 5: solange die Aktivierung läuft, ist die Taste gesperrt; ein zweiter Tipp löst nichts doppelt aus', async () => {
    geraet.wert.rolle = 'diesesTurnier';
    geraet.wert.felder = [1];
    let fertig: (ok: boolean) => void = () => undefined;
    geraet.wert.tonAktivieren = vi.fn(() => new Promise<boolean>((ok) => { fertig = ok; }));
    setzeLeitung(leitung(stand('not_activated')));
    zeige();
    const taste = screen.getByTestId('cockpit-hall-ton-aktivieren');
    await act(async () => { fireEvent.click(taste); fireEvent.click(taste); });
    expect(geraet.wert.tonAktivieren).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cockpit-hall-ton-aktivieren')).toHaveAttribute('aria-busy', 'true');
    await act(async () => { fertig(true); });
    expect(screen.getByTestId('cockpit-hall-ton-aktivieren')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('@OB-087 Zeile 5: meldet das eigene Gerät das Feld als bereit, verschwindet der Hinweis (der Server-Stand zieht gleich nach)', () => {
    geraet.wert.rolle = 'diesesTurnier';
    geraet.wert.felder = [1];
    setzeLeitung(leitung(stand('not_activated')));
    const { rerender } = zeige();
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
    geraet.wert = { ...geraet.wert, laufzeit: { rolle: 'toent', zustandJeFeld: { 'field-1': 'ready' } } };
    rerender(<CockpitHallHinweis tournamentId={TID} feldId="field-1" zustand="laeuft" kannSteuern />);
    expect(screen.queryByTestId('cockpit-hall-aus')).toBeNull();
  });

  it('@OB-087 Zeile 5: meldet das eigene Gerät „eigener Ton nicht ladbar“ (Hupe 1 tönt trotzdem), tritt der Kasten zurück – die Halle hört etwas', () => {
    geraet.wert.rolle = 'diesesTurnier';
    geraet.wert.felder = [1];
    geraet.wert.laufzeit = { rolle: 'toent', zustandJeFeld: { 'field-1': 'custom_sound_failed' } };
    setzeLeitung(leitung(stand('not_activated')));
    zeige();
    expect(screen.queryByTestId('cockpit-hall-aus')).toBeNull();
  });

  // Gegenbeispiele: nur wenn dieses Gerät wirklich tönt, tritt der Kasten zurück (Review 🟡2)
  it.each([
    ['still', 'stehengebliebenes ready bei Rolle still'],
    ['aus', 'Laufzeit aus'],
    ['andererTab', 'ein anderes Fenster tönt, dieses nicht'],
  ])('@OB-087 Zeile 5 Gegenbeispiel: Rolle %s (%s) – der Kasten „Ende selbst anzeigen“ bleibt', (rolle) => {
    geraet.wert.rolle = 'diesesTurnier';
    geraet.wert.felder = [1];
    geraet.wert.laufzeit = { rolle, zustandJeFeld: { 'field-1': 'ready' } };
    setzeLeitung(leitung(stand('not_activated')));
    zeige();
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
  });

  it('@OB-087 Zeile 5 Gegenbeispiel: ready, aber nur für ein anderes Feld des Geräts – der Kasten bleibt', () => {
    geraet.wert.rolle = 'diesesTurnier';
    geraet.wert.felder = [1, 2];
    geraet.wert.laufzeit = { rolle: 'toent', zustandJeFeld: { 'field-2': 'ready', 'field-1': 'not_activated' } };
    setzeLeitung(leitung(stand('not_activated')));
    zeige();
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
  });
});
