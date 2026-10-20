/**
 * Scoreboard (Aufgabe 2.4): Tafel-Block aus Tokens, Texte kommen als Modell (kein i18n im Baustein).
 * Szenarien: @ZM-139 (Restzeit groß, Spielzeit klein), @SL-003/@SL-136 (Schlussphasen-Farbe der Uhr),
 * @SL-004 (angehaltene Uhr markiert), @SL-064 (Meldezeile im Block, überlagert nichts), @HE-051 (Abzeichen),
 * @SL-122 (stehendes Symbol), Mockup-Freigabe 16.10. (Stand-Kästen in Trikotfarbe).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Scoreboard, type ScoreboardModel } from '../Scoreboard';
import { cssVars } from '../../../../design-tokens';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';

await initRealDeI18n();

const model: ScoreboardModel = {
  badge: { kind: 'badge', state: 'live' }, links: { name: 'FC Nord', tore: 1 }, rechts: { name: 'SV Süd', tore: 0 },
  uhr: { rest: '2:48', gespielt: '3:12', label: 'Restzeit', unterzeile: 'Spielzeit 3:12', hervorgehoben: false, steht: false, schlussphase: false },
  abschnittText: '2. Halbzeit', hinweise: [],
  eintraegeWartenText: '2 Einträge warten', helferAnfragenText: '1 Helfer-Anfrage', ariaStand: 'FC Nord 1, SV Süd 0',
};

describe('Scoreboard', () => {
  it('@ZM-139 die Restzeit steht groß, die Spielzeit klein darunter', () => {
    render(<Scoreboard model={model} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('2:48');
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spielzeit 3:12');
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('Restzeit');
  });

  it('regular zeigt Teamnamen, compact nicht (der Stand bleibt)', () => {
    const { rerender } = render(<Scoreboard model={model} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    rerender(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.queryByText('FC Nord')).toBeNull();
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('1:0');
  });

  it('Teamnamen tragen data-teamname (Umbruch wortweise, nie ein Wort getrennt)', () => {
    render(<Scoreboard model={{ ...model, links: { name: 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', tore: 1 } }} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByText('Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921')).toHaveAttribute('data-teamname');
  });

  it('Uhr wird nicht sekündlich vorgelesen, Stand und Zustand höflich', () => {
    render(<Scoreboard model={model} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-clock')).not.toHaveAttribute('aria-live');
    expect(screen.getByTestId('scoreboard-score')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('scoreboard-state')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('scoreboard-score')).toHaveAttribute('aria-label', 'FC Nord 1, SV Süd 0');
  });

  it('@HE-051 das Abzeichen „1 Helfer-Anfrage“ öffnet mit einem Tipp, „2 Einträge warten“ ist reine Anzeige', async () => {
    const onHelferAnfragen = vi.fn();
    render(<Scoreboard model={model} size="compact" meldezeile={null} onHelferAnfragen={onHelferAnfragen} testId="scoreboard" />);
    await userEvent.click(screen.getByRole('button', { name: '1 Helfer-Anfrage' }));
    expect(onHelferAnfragen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2 Einträge warten')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2 Einträge warten' })).toBeNull();
  });

  it('@HE-051 Gegenbeispiel: ohne Rückruf ist die Helfer-Anfrage nur Text, kein Knopf', () => {
    render(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByText('1 Helfer-Anfrage')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1 Helfer-Anfrage' })).toBeNull();
  });

  it('@SL-122 stehendes Wachhalten-Symbol mit Namen; Antippen ruft den Rückruf', async () => {
    const onAntippen = vi.fn();
    render(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" wachhaltenHinweis={{ label: 'Bildschirm kann sich sperren – antippen zum Ausblenden', onAntippen }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bildschirm kann sich sperren – antippen zum Ausblenden' }));
    expect(onAntippen).toHaveBeenCalledTimes(1);
  });

  it('Ton-Abzeichen: „Ton aus“ steht in der Tafel und schaltet mit einem Tipp frei (kein schwebender Hinweis)', async () => {
    const onAntippen = vi.fn();
    render(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" tonHinweis={{ label: 'Ton aus – antippen zum Einschalten', kurz: 'Ton aus', onAntippen }} />);
    const knopf = screen.getByRole('button', { name: 'Ton aus – antippen zum Einschalten' });
    expect(screen.getByTestId('scoreboard')).toContainElement(knopf);
    expect(knopf).toHaveTextContent('Ton aus');
    await userEvent.click(knopf);
    expect(onAntippen).toHaveBeenCalledTimes(1);
  });

  it('Tipp-Flächen der Abzeichen sind mindestens 44 px hoch', () => {
    render(<Scoreboard model={model} size="compact" meldezeile={null} onHelferAnfragen={vi.fn()} testId="scoreboard" />);
    expect(screen.getByRole('button', { name: '1 Helfer-Anfrage' })).toHaveStyle({ minHeight: 'var(--touch-target-minimum)' });
  });

  it('@SL-003 Schlussphase: Uhr in der Schlussphasen-Farbe, sonst nicht', () => {
    const { rerender } = render(<Scoreboard model={{ ...model, uhr: { ...model.uhr!, schlussphase: true } }} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-clock')).toHaveAttribute('data-schlussphase', 'true');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveStyle({ color: 'var(--color-scoreboard-final-phase)' });
    rerender(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-clock')).toHaveAttribute('data-schlussphase', 'false');
    expect(screen.getByTestId('scoreboard-clock-rest')).not.toHaveStyle({ color: 'var(--color-scoreboard-final-phase)' });
  });

  it('@SL-004 angehaltene Uhr ist markiert (data-steht) und trägt einen Text, nicht nur Farbe', () => {
    render(<Scoreboard model={{ ...model, uhr: { ...model.uhr!, steht: true, hervorgehoben: true, label: 'angehalten' } }} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'true');
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('angehalten');
  });

  // B1 (Review 2c): „die Tafel springt nicht“ – Markierungen der Uhr dürfen die Höhe nicht ändern
  it('B1 die Markierung der angehaltenen Uhr hat keine Layoutwirkung: Outline, kein Rand und kein Innenabstand', () => {
    const { rerender } = render(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" />);
    const laeuft = screen.getByTestId('scoreboard-clock').getAttribute('style');
    rerender(<Scoreboard model={{ ...model, uhr: { ...model.uhr!, steht: true, hervorgehoben: true, label: 'Uhr steht' } }} size="compact" meldezeile={null} testId="scoreboard" />);
    const steht = screen.getByTestId('scoreboard-clock');
    expect(steht.style.outline).toMatch(/dashed/);
    expect(steht.style.padding).toBe('');
    expect(steht.style.border).toBe('');
    expect(laeuft).not.toMatch(/padding|border:/);
  });

  it('B1 „Pause vorbei“ (Wiederanpfiff) wird nur durch Farbe und Text markiert, ohne Rand und Innenabstand', () => {
    render(<Scoreboard model={{ ...model, uhr: { ...model.uhr!, ton: 'ok', hervorgehoben: true, label: 'Pause vorbei', unterzeile: 'Wiederanpfiff' } }} size="compact" meldezeile={null} testId="scoreboard" />);
    const uhr = screen.getByTestId('scoreboard-clock');
    expect(uhr.style.padding).toBe('');
    expect(uhr.style.border).toBe('');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveStyle({ color: 'var(--color-scoreboard-ok)' });
  });

  it('B1 die Unterzeile behält ihre Höhe, auch wenn sie leer ist (Strafstoßschießen entschieden, Endstand)', () => {
    render(<Scoreboard model={{ ...model, uhr: { ...model.uhr!, unterzeile: null, gespielt: null } }} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveStyle({ minHeight: 'var(--line-height-body-sm)' });
  });

  it('das Uhr-Element steht immer, ohne Uhr leer (die Tafel springt nicht)', () => {
    render(<Scoreboard model={{ ...model, uhr: null }} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-clock')).toBeEmptyDOMElement();
  });

  it('Stand-Kästen in Trikotfarbe (Mockup-Freigabe 16.10.), Ziffern in der Kontrastfarbe; ohne Trikotfarbe neutral', () => {
    const { rerender } = render(<Scoreboard model={{ ...model, links: { ...model.links, trikot: '#FACC15' }, rechts: { ...model.rechts, trikot: '#2563EB' } }} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-box-links')).toHaveStyle({ backgroundColor: '#FACC15', color: 'var(--color-scoreboard-on-highlight)' });
    expect(screen.getByTestId('scoreboard-box-rechts')).toHaveStyle({ backgroundColor: '#2563EB', color: 'var(--color-scoreboard-on-live)' });
    rerender(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-box-links')).toHaveAttribute('data-trikot', 'neutral');
  });

  it('Stehende Zeilen (Hinweise) stehen unter Uhr und Stand', () => {
    render(<Scoreboard model={{ ...model, hinweise: ['Uhr hält bei Unterbrechung'] }} size="compact" meldezeile={null} testId="scoreboard" />);
    const zeile = screen.getByText('Uhr hält bei Unterbrechung');
    expect(screen.getByTestId('scoreboard-clock').compareDocumentPosition(zeile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('@SL-064 die Meldezeile steht im Tafel-Block unter Uhr und Stand, nicht davor', () => {
    render(<Scoreboard model={{ ...model, hinweise: ['Uhr steht'] }} size="compact" meldezeile={<div data-testid="notice-line">x</div>} testId="scoreboard" />);
    const block = screen.getByTestId('scoreboard');
    const zeile = screen.getByTestId('notice-line');
    expect(block).toContainElement(zeile);
    expect(screen.getByTestId('scoreboard-clock').compareDocumentPosition(zeile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Uhr steht').compareDocumentPosition(zeile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ohne Boxen (kein Spiel / wartet) steht ein Text in der Mitte statt Stand und Uhr', () => {
    render(<Scoreboard model={{ ...model, uhr: null, leerAnzeige: { titel: 'Kein weiteres Spiel', untertitel: 'Feld 2' } }} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-empty')).toHaveTextContent('Kein weiteres Spiel');
    expect(screen.getByTestId('scoreboard-empty')).toHaveTextContent('Feld 2');
    expect(screen.queryByTestId('scoreboard-score')).toBeNull();
  });

  it('@SL-064 eine lange einzeilige Meldung weitet die Tafel nicht über ihre Breite (eine Spalte mit Mindestbreite 0)', () => {
    render(<Scoreboard model={model} size="compact" meldezeile={<div style={{ whiteSpace: 'nowrap' }}>Foul für Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921</div>} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard')).toHaveStyle({ gridTemplateColumns: 'minmax(0, 1fr)', minWidth: '0px' });
  });

  it('das Zustands-Abzeichen trägt den Text (Farbe allein bedeutet nichts) und die Größe steht als Attribut', () => {
    render(<Scoreboard model={model} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live');
    expect(screen.getByTestId('scoreboard')).toHaveAttribute('data-size', 'regular');
  });

  it('@OB-065 das Abzeichen der Tafel ist das Molekül der Spielkarte: „Live“ mit Puls-Punkt, „Halbzeit“ ohne Uhrzeit', () => {
    const { rerender } = render(<Scoreboard model={model} size="regular" meldezeile={null} testId="scoreboard" />);
    const live = screen.getByTestId('scoreboard-abzeichen');
    expect(live).toHaveAttribute('data-state', 'live');
    expect(live).toHaveAttribute('data-pulse', 'true');
    expect(live.textContent).toBe('Live');
    rerender(<Scoreboard model={{ ...model, badge: { kind: 'badge', state: 'halftime' } }} size="regular" meldezeile={null} testId="scoreboard" />);
    const halbzeit = screen.getByTestId('scoreboard-abzeichen');
    expect(halbzeit).toHaveAttribute('data-state', 'halftime');
    expect(halbzeit.textContent).toBe('Halbzeit');
  });

  it('@OB-066 „Ende“ auf der Tafel in Tafel-Schrift (Verdrahtung surface="scoreboard")', () => {
    render(<Scoreboard model={{ ...model, badge: { kind: 'badge', state: 'ended' } }} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-abzeichen').style.color).toBe(cssVars.colors.scoreboardTextMuted);
  });

  it('@OB-068 ein geplantes Spiel ohne Überfälligkeit lässt den Abzeichen-Platz leer', () => {
    render(<Scoreboard model={{ ...model, badge: { kind: 'none' } }} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-state')).toBeEmptyDOMElement();
  });

  it('@OB-068 „überfällig 7 Min“ steht im Abzeichen-Platz in Tafel-Warnfarbe und als Wort', () => {
    render(<Scoreboard model={{ ...model, badge: { kind: 'none' }, ueberfaelligText: 'überfällig 7 Min' }} size="regular" meldezeile={null} testId="scoreboard" />);
    const wort = screen.getByTestId('scoreboard-ueberfaellig');
    expect(wort.textContent).toBe('überfällig 7 Min');
    expect(wort.style.color).toBe(cssVars.colors.scoreboardHighlight);
    expect(screen.getByTestId('scoreboard-state')).toContainElement(wort);
  });

  it('@OB-065 Gegenbeispiel: ein geplantes Spiel zeigt im Abzeichen nur seine Anstoßzeit, kein Wort', () => {
    render(<Scoreboard model={{ ...model, badge: { kind: 'kickoff', time: '15:15' } }} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.getByTestId('scoreboard-abzeichen')).toHaveTextContent('15:15');
    expect(screen.getByTestId('scoreboard-abzeichen')).not.toHaveAttribute('data-state');
  });
});
