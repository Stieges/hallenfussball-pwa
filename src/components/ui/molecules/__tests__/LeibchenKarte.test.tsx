/**
 * Leibchen-Karte (Leibchen 2b-2): Tipp-Zähler K-1/K-2/K-8 (@SL-211, @SL-218; gezählt wird vom ersten Tipp bis einschließlich „Bestätigen“),
 * Vorschlag antippbar, gleich große umrandete Tasten (@SL-206, @SL-224), Zeile nach dem Tipp (@SL-208), Warnungen mit Wort (@SL-231, @SL-173),
 * „Kein passendes Leibchen vorhanden“ (@SL-217), Gerät ohne Steuerung (@SL-202, @SL-213). Testwerte aus dem Gherkin (2026-10-02_spiel-leiten.md).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { palette } from '../../../../design-tokens/colors/palette';
import { LeibchenKarte, type LeibchenKarteProps } from '../LeibchenKarte';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
await initRealDeI18n();

const BLAU = '#1565C0';
const GELB = '#FFCC00';
const ORANGE = '#FF6600';
const ROT = '#C62828';
const WEISS_ = '#FFFFFF';
const PINK = palette.jersey.pink;

function aufbau(extra: Partial<LeibchenKarteProps> = {}) {
  const onBestaetigen = vi.fn();
  const onKeine = vi.fn();
  const tipps = { n: 0 };
  const props: LeibchenKarteProps = {
    teams: { a: 'TSV Waging 1', b: 'TSV Petting' }, trikot: { a: BLAU, b: BLAU }, hallenFarben: [GELB, ORANGE], gewaehlt: null,
    vorschlag: { kind: 'vorschlag', seite: 'a', farbe: GELB }, nurFestlegen: false, senden: null, lesen: false, onBestaetigen, onKeine, ...extra,
  };
  const ansicht = render(<LeibchenKarte {...props} />);
  const user = userEvent.setup();
  /** Ein Tipp: zählt mit. */
  const tippe = async (el: HTMLElement): Promise<void> => { tipps.n += 1; await user.click(el); };
  return { ...ansicht, props, onBestaetigen, onKeine, tipps, tippe };
}
const byId = (id: string) => screen.getByTestId(`leibchen-${id}`);

describe('@SL-206 die Karte zeigt den Vorschlag und zwei gleich große, nur umrandete Tasten', () => {
  it('@SL-206 „TSV Waging 1 zieht Gelb“, darunter „Bestätigen“ und „Keine Leibchen“; die kleinen Tasten „Andere Farbe“ und „Gast zieht“ gibt es nicht', () => {
    aufbau();
    expect(byId('vorschlag')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(byId('vorschlag')).toHaveTextContent('Leibchen ändern');
    expect(byId('bestaetigen')).toHaveTextContent('Bestätigen');
    expect(byId('keine')).toHaveTextContent('Keine Leibchen');
    expect(screen.queryByText('Gast zieht')).toBeNull();
    expect(screen.queryByText('Andere Farbe')).toBeNull();
  });

  it('@SL-224 beide Tasten tragen dieselben Maße (Höhe Haupttaste, gleiche Breite) und sind umrandet, keine ist gefüllt', () => {
    aufbau();
    const a = byId('bestaetigen'); const b = byId('keine');
    expect(a.style.height).toBe('var(--touch-target-primary)');
    expect(a.style.height).toBe(b.style.height);
    expect(a.style.flex).toBe(b.style.flex);
    expect(a.style.background).toBe('transparent');
    expect(b.style.background).toBe('transparent');
    expect(a.style.border).toBe(b.style.border);
  });

  it('@SL-206 Gegenbeispiel: ohne passende Karte (nur Festlegen) steht nur die kleine Taste „Leibchen festlegen“ (@SL-148)', () => {
    aufbau({ nurFestlegen: true, vorschlag: { kind: 'vorschlag', seite: 'a', farbe: GELB } });
    expect(byId('festlegen')).toHaveTextContent('Leibchen festlegen');
    expect(screen.queryByTestId('leibchen-bestaetigen')).toBeNull();
  });
});

describe('@SL-218 Tipp-Zähler: vom ersten Tipp bis einschließlich „Bestätigen“ (K-1, K-2, K-8)', () => {
  it('@SL-218 annehmen: „Bestätigen“ = 1 Tipp, die Wahl ist der Vorschlag', async () => {
    const k = aufbau();
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('a', GELB);
    expect(k.tipps.n).toBe(1);
  });

  it('@SL-218 ablehnen: „Keine Leibchen“ = 1 Tipp', async () => {
    const k = aufbau();
    await k.tippe(byId('keine'));
    expect(k.onKeine).toHaveBeenCalledTimes(1);
    expect(k.tipps.n).toBe(1);
  });

  it('@SL-218 Zeile 1: auf den Vorschlag tippen, TSV Petting wählen, „Bestätigen“ = 3 Tipps (höchstens 3, eine Sache geändert)', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('team-gast'));
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('b', GELB);
    expect(k.tipps.n).toBe(3);
  });

  it('@SL-218 Zeile 2: Vorschlag, TSV Petting, Orange, „Bestätigen“ = 4 Tipps (höchstens 4, Team und Farbe)', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('team-gast'));
    await k.tippe(byId('farbe-orange'));
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('b', ORANGE);
    expect(k.tipps.n).toBe(4);
  });

  it('@SL-218 Zeile 3: Vorschlag, „Andere Farbe …“, Pink, „Bestätigen“ = 4 Tipps (höchstens 4)', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('andere'));
    await k.tippe(byId('farbe-pink'));
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('a', PINK);
    expect(k.tipps.n).toBe(4);
  });

  it('@SL-218 Zeile 4: die Farbe wählen, ohne zu bestätigen, ändert nichts nach außen – erst „Bestätigen“ stellt um', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('farbe-orange'));
    expect(k.onBestaetigen).not.toHaveBeenCalled();
    expect(k.onKeine).not.toHaveBeenCalled();
  });

  it('@SL-218 Zeile 5: nach „Bestätigen“ steht die Zeile; „Ändern“ (1), Vorschlag (2), Orange (3), „Bestätigen“ (4) = 4 Tipps seit „Ändern“', async () => {
    const k = aufbau({ gewaehlt: { art: 'bestaetigt', seite: 'a', farbe: GELB } });
    await k.tippe(byId('aendern'));
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('farbe-orange'));
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('a', ORANGE);
    expect(k.tipps.n).toBe(4);
  });

  it('@SL-218 Zeile 6: eine Wahl aufgeben = 2 Tipps („Ändern“, „Keine Leibchen“)', async () => {
    const k = aufbau({ gewaehlt: { art: 'bestaetigt', seite: 'a', farbe: GELB } });
    await k.tippe(byId('aendern'));
    await k.tippe(byId('keine'));
    expect(k.onKeine).toHaveBeenCalledTimes(1);
    expect(k.tipps.n).toBe(2);
  });

  it('@SL-218 Zeile 7: nach „Keine Leibchen“ zurück: „Ändern“, „Bestätigen“ = 2 Tipps', async () => {
    const k = aufbau({ gewaehlt: { art: 'keine' } });
    await k.tippe(byId('aendern'));
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('a', GELB);
    expect(k.tipps.n).toBe(2);
  });

  it('@SL-211 Gegenbeispiel: ohne Tipp ist nichts bestätigt (Anpfiff ohne Tipp bedeutet keine Leibchen, @SL-210)', () => {
    const k = aufbau();
    expect(k.onBestaetigen).not.toHaveBeenCalled();
    expect(k.onKeine).not.toHaveBeenCalled();
  });
});

describe('@SL-208 @SL-230 die Zeile nach dem Tipp', () => {
  it('@SL-208 „TSV Waging 1 zieht Gelb · Ändern“ mit Leibchen-Zeichen, „Keine Leibchen · Ändern“', () => {
    const { unmount } = aufbau({ gewaehlt: { art: 'bestaetigt', seite: 'a', farbe: GELB } });
    expect(byId('zeile')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(byId('aendern')).toHaveTextContent('Ändern');
    unmount();
    aufbau({ gewaehlt: { art: 'keine' } });
    expect(byId('zeile')).toHaveTextContent('Keine Leibchen');
  });

  it('@SL-230 „wird gesendet“ und „gesendet“ stehen als Wort, nicht nur als Farbe', () => {
    const { rerender, props } = aufbau({ gewaehlt: { art: 'bestaetigt', seite: 'a', farbe: GELB }, senden: 'pending' });
    expect(byId('status')).toHaveTextContent('wird gesendet');
    rerender(<LeibchenKarte {...props} gewaehlt={{ art: 'bestaetigt', seite: 'a', farbe: GELB }} senden="sent" />);
    expect(byId('status')).toHaveTextContent('gesendet');
    expect(byId('status')).not.toHaveTextContent('wird');
  });

  it('@SL-230 Gegenbeispiel: ohne Sendezustand kein Status', () => {
    aufbau({ gewaehlt: { art: 'keine' }, senden: null });
    expect(screen.queryByTestId('leibchen-status')).toBeNull();
  });

  it('@SL-221 Kein Sprung: die Zeile hat keine eigene Fläche außerhalb des Blocks über der Daumenleiste (ein Kind, gleiche Wurzel-Rolle)', () => {
    const { container } = aufbau({ gewaehlt: { art: 'keine' } });
    expect(container.children).toHaveLength(1);
  });
});

describe('@SL-231 @SL-173 @SL-219 Farbwahl: Name als Wort, Haken, Warnung mit Wort', () => {
  it('@SL-231 SV Süd in Rot, FC Nord in Weiß: Rot trägt „Wie Trikot“ (Hallenfarbe „Ähnlich wie Trikot“), der volle Satz erst nach der Wahl', async () => {
    const k = aufbau({ trikot: { a: ROT, b: '#FFFFFF' }, hallenFarben: [GELB], teams: { a: 'SV Süd', b: 'FC Nord' }, vorschlag: { kind: 'vorschlag', seite: 'a', farbe: GELB } });
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('andere'));
    const rot = byId('farbe-rot');
    expect(rot).toHaveTextContent('Wie Trikot');
    expect(rot).toHaveAccessibleName('Rot – sieht aus wie das eigene Trikot von SV Süd'); // Wortlaut @SL-231
    expect(screen.queryByTestId('leibchen-satz')).toBeNull();
    await k.tippe(rot);
    expect(byId('satz')).toHaveTextContent('Leibchen sieht aus wie das eigene Trikot');
    await k.tippe(byId('bestaetigen')); // bestätigen bleibt erlaubt
    expect(k.onBestaetigen).toHaveBeenCalledWith('a', palette.jersey.red);
  });

  it('@SL-151 Gelb ist dem Trikot des Gegners zu ähnlich: Kachel „Wie Gegner“, vorgelesen „Gelb – zu ähnlich wie das Trikot von FC Nord“, nach der Wahl der volle Satz', async () => {
    const k = aufbau({ trikot: { a: WEISS_, b: '#FFEB3B' }, hallenFarben: [ORANGE], teams: { a: 'SV Süd', b: 'FC Nord' }, vorschlag: { kind: 'vorschlag', seite: 'a', farbe: ORANGE } });
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('andere'));
    expect(byId('farbe-gelb')).toHaveTextContent('Wie Gegner');
    expect(byId('farbe-gelb')).toHaveAccessibleName('Gelb – zu ähnlich wie das Trikot von FC Nord');
    await k.tippe(byId('farbe-gelb'));
    expect(byId('satz')).toHaveTextContent('Gelb – zu ähnlich wie das Trikot von FC Nord');
  });

  it('@SL-231 Rot gegen Blau (Farbabstand 44,8, aber gleich hell): Rot trägt „Gleich hell“', async () => {
    const k = aufbau({ trikot: { a: BLAU, b: '#FFFFFF' }, hallenFarben: [GELB] });
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('andere'));
    expect(byId('farbe-rot')).toHaveTextContent('Gleich hell');
  });

  it('@SL-219 „Andere Farbe …“ zeigt die Hallenfarben oben, darunter die Grundauswahl; jede Farbe trägt ihren Namen als Wort, die gewählte „(gewählt)“ per aria-pressed', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    expect(byId('farbe-gelb')).toHaveAttribute('aria-pressed', 'true');
    expect(byId('farbe-orange')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('leibchen-farbe-pink')).toBeNull();
    await k.tippe(byId('andere'));
    for (const name of ['neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz']) { expect(byId(`farbe-${name}`)).toBeInTheDocument(); }
    expect(byId('farbe-neongruen')).toHaveTextContent('Neongrün');
  });

  it('@SL-231 Gegenbeispiel: eine unproblematische Farbe trägt keine Warnung', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    expect(byId('farbe-gelb')).not.toHaveTextContent('Trikot');
    expect(screen.queryByTestId('leibchen-warnung')).toBeNull();
  });
});

describe('@SL-217 Kein passendes Leibchen vorhanden', () => {
  it('@SL-217 „Kein passendes Leibchen vorhanden“ mit „Keine Leibchen“ und „Andere Farbe …“, ohne „Bestätigen“; nach der Farbwahl steht der normale Vorschlag mit „Bestätigen“', async () => {
    const k = aufbau({ vorschlag: { kind: 'keinPassendes', seite: 'a' }, hallenFarben: [GELB] });
    expect(byId('kein-passendes')).toHaveTextContent('Kein passendes Leibchen vorhanden');
    expect(screen.queryByTestId('leibchen-bestaetigen')).toBeNull();
    expect(byId('keine')).toBeInTheDocument();
    await k.tippe(byId('andere-farbe'));
    await k.tippe(byId('farbe-pink'));
    expect(byId('vorschlag')).toHaveTextContent('TSV Waging 1 zieht Pink');
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('a', PINK);
  });
});

describe('@SL-202 @SL-213 ein Gerät ohne Steuerung sieht Karte und Zeile ohne Tasten', () => {
  it('@SL-213 Karte ohne Tasten, mit „Nur das steuernde Gerät kann Leibchen bestätigen.“ und dem Angebot, das Feld zu übernehmen', async () => {
    const uebernehmen = vi.fn();
    const k = aufbau({ lesen: true, onUebernehmen: uebernehmen });
    expect(screen.queryByTestId('leibchen-bestaetigen')).toBeNull();
    expect(screen.queryByTestId('leibchen-keine')).toBeNull();
    expect(byId('nur-lesen')).toHaveTextContent('Nur das steuernde Gerät kann Leibchen bestätigen.');
    await k.tippe(byId('uebernehmen'));
    expect(uebernehmen).toHaveBeenCalledTimes(1);
  });

  it('@SL-213 die Zeile ohne „Ändern“, mit dem Angebot zur Übernahme', () => {
    aufbau({ lesen: true, gewaehlt: { art: 'bestaetigt', seite: 'a', farbe: GELB }, onUebernehmen: vi.fn() });
    expect(screen.queryByTestId('leibchen-aendern')).toBeNull();
    expect(byId('uebernehmen')).toBeInTheDocument();
  });

  it('@SL-213 Gegenbeispiel: der Vorschlag ist ohne Steuerung nicht antippbar', () => {
    aufbau({ lesen: true });
    expect(byId('vorschlag')).toBeDisabled();
  });
});

describe('@SL-237 die offene Wahl wird verlassen', () => {
  it('@SL-237 „Keine Leibchen“ bleibt auch bei geöffneter Wahl erreichbar', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('farbe-orange'));
    expect(byId('keine')).toBeInTheDocument();
    expect(k.onBestaetigen).not.toHaveBeenCalled();
  });

  it('@SL-237 die Wahl wieder schließen (zweiter Tipp auf den Vorschlag) verwirft Orange: es bleibt der alte Vorschlag', async () => {
    const k = aufbau();
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('farbe-orange'));
    await k.tippe(byId('vorschlag'));
    await k.tippe(byId('bestaetigen'));
    expect(k.onBestaetigen).toHaveBeenCalledWith('a', GELB);
  });

  it('@SL-221 beim Auf- und Zuklappen meldet die Karte den Zustand (am Handy weichen Tafel und Einträge)', async () => {
    const onWahlOffen = vi.fn();
    const k = aufbau({ onWahlOffen });
    await k.tippe(byId('vorschlag'));
    expect(onWahlOffen).toHaveBeenLastCalledWith(true);
    await k.tippe(byId('vorschlag'));
    expect(onWahlOffen).toHaveBeenLastCalledWith(false);
  });
});

describe('@SL-221 Doppeltipp: die Zeile liegt an derselben Stelle wie die Taste', () => {
  it('@SL-221 nach „Bestätigen“ schrumpft die Karte zur Zeile; ein zweiter Tipp unter 1 s auf „Ändern“ öffnet sie nicht wieder, nach 1 s geht es', async () => {
    const k = aufbau();
    await k.tippe(byId('bestaetigen'));
    k.rerender(<LeibchenKarte {...k.props} gewaehlt={{ art: 'bestaetigt', seite: 'a', farbe: GELB }} />);
    await k.tippe(byId('aendern')); // der Daumen tippt noch einmal an dieselbe Stelle
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
    expect(byId('zeile')).toBeInTheDocument();
    const jetzt = Date.now() + 1100;
    vi.spyOn(Date, 'now').mockReturnValue(jetzt);
    await k.tippe(byId('aendern'));
    expect(byId('karte')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('@SL-221 dasselbe nach „Keine Leibchen“', async () => {
    const k = aufbau();
    await k.tippe(byId('keine'));
    k.rerender(<LeibchenKarte {...k.props} gewaehlt={{ art: 'keine' }} />);
    await k.tippe(byId('aendern'));
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
  });

  it('@SL-206 die Überschrift „Leibchen für dieses Spiel · Spiel 3“ steht immer auf der Karte (im Endstand gilt sie dem nächsten Spiel)', () => {
    aufbau({ spielNummer: 3 });
    expect(byId('ueberschrift')).toHaveTextContent('Leibchen für dieses Spiel · Spiel 3');
  });

  it('@SL-206 Gegenbeispiel: ohne Nummer steht die Überschrift ohne Nummer, die Zeile trägt keine Überschrift', () => {
    const { unmount } = aufbau();
    expect(byId('ueberschrift')).toHaveTextContent(/^Leibchen für dieses Spiel$/);
    unmount();
    aufbau({ gewaehlt: { art: 'keine' } });
    expect(screen.queryByTestId('leibchen-ueberschrift')).toBeNull();
  });
});

describe('@SL-219 @SL-221 „Andere Farbe …“ öffnet die Grundauswahl als eigenes Blatt (ohne Rollen am kleinen Handy)', () => {
  it('@SL-219 „Andere Farbe …“ zeigt die übrigen Farben im Blatt; die Hallenfarben bleiben in der Karte, keine Farbe steht doppelt', async () => {
    const a = aufbau();
    await a.tippe(byId('vorschlag'));
    expect(screen.queryByTestId('leibchen-andere-blatt')).toBeNull();
    await a.tippe(byId('andere'));
    const blatt = byId('andere-blatt');
    expect(blatt).toBeInTheDocument();
    expect(blatt.querySelectorAll('[data-testid^="leibchen-farbe-"]')).toHaveLength(6); // 8 Grundfarben minus 2 Hallenfarben
    expect(screen.getAllByTestId('leibchen-farbe-gelb')).toHaveLength(1);
    expect(screen.getAllByTestId('leibchen-farbe-pink')).toHaveLength(1);
  });

  it('@SL-219 eine Farbe im Blatt antippen wählt sie und schließt das Blatt; die Karte zeigt sie mit Haken', async () => {
    const a = aufbau();
    await a.tippe(byId('vorschlag'));
    await a.tippe(byId('andere'));
    await a.tippe(byId('farbe-pink'));
    expect(screen.queryByTestId('leibchen-andere-blatt')).toBeNull();
    await a.tippe(byId('bestaetigen'));
    expect(a.onBestaetigen).toHaveBeenCalledWith('a', PINK);
  });

  it('Gegenbeispiel: „Schließen“ im Blatt wählt nichts und schließt es', async () => {
    const a = aufbau();
    await a.tippe(byId('vorschlag'));
    await a.tippe(byId('andere'));
    await a.tippe(byId('andere-schliessen'));
    expect(screen.queryByTestId('leibchen-andere-blatt')).toBeNull();
    await a.tippe(byId('bestaetigen'));
    expect(a.onBestaetigen).toHaveBeenCalledWith('a', GELB);
  });

  it('@SL-217 „Kein passendes Leibchen“: „Andere Farbe …“ öffnet gleich das Blatt', async () => {
    const a = aufbau({ trikot: { a: GELB, b: GELB }, hallenFarben: [GELB], vorschlag: { kind: 'keinPassendes', seite: 'a' } });
    await a.tippe(byId('andere-farbe'));
    expect(byId('andere-blatt')).toBeInTheDocument();
  });
});

describe('@SL-215 Karte im Endstand: „Leibchen für das nächste Spiel · Spiel N“ mit dem Grund', () => {
  it('@SL-215 im Endstand gilt die Überschrift dem nächsten Spiel, darunter „Beide spielen Blau“', () => {
    aufbau({ naechstes: true, spielNummer: 3, trikot: { a: palette.jersey.blue, b: palette.jersey.blue } });
    expect(byId('ueberschrift')).toHaveTextContent('Leibchen für das nächste Spiel · Spiel 3');
    expect(byId('grund')).toHaveTextContent('Beide spielen Blau');
  });

  it('@SL-215 eine Trikotfarbe ohne Namen (Blau #1565C0 gleich Blau): „Gleiche Trikotfarbe“', () => {
    aufbau({ naechstes: true, spielNummer: 3 });
    expect(byId('grund')).toHaveTextContent('Gleiche Trikotfarbe');
  });

  it('@SL-215 ähnliche, nicht gleiche Trikotfarben: „Sehr ähnliche Trikotfarben“', () => {
    aufbau({ naechstes: true, spielNummer: 3, trikot: { a: '#FFEB3B', b: '#FFF59D' } });
    expect(byId('grund')).toHaveTextContent('Sehr ähnliche Trikotfarben');
  });

  it('Gegenbeispiel: vor dem Anpfiff (nicht im Endstand) heißt es „für dieses Spiel“ und der Grund steht nicht in der Karte', () => {
    aufbau({ spielNummer: 3 });
    expect(byId('ueberschrift')).toHaveTextContent('Leibchen für dieses Spiel · Spiel 3');
    expect(screen.queryByTestId('leibchen-grund')).toBeNull();
  });
});
