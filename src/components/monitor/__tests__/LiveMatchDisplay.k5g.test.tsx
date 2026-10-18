/**
 * Fixrunde 3 (Daniel 18.10.): das Ende nach dem Strafstoßschießen wie das freigegebene Mockup K5g (Monitor-Phasen v8).
 * @ZM-147 (nur Ergebnis, K5g4), @ZM-049 (Ende nach Strafstoßschießen: Sieger-Kasten mit Ring und Pokal, Verlierer zurückgenommen,
 * Strafstoß klein unter dem Doppelpunkt, Siegerzeile), @ZM-087 (50-Zeichen-Name: Umbruch, Monitor-Form, nichts überlappt).
 * K5g/K5g2/K5g3/K5g4 als Varianten; die Schützen-Punktreihen von K5g/K5g2 zeigt die Live-Folie noch nicht (der Verlauf der
 * Schüsse kommt mit B-15, `LiveMatch` trägt ihn nicht) – K5g4 („nur Ergebnis“) ist der Zustand ohne Reihen.
 * Gegenbeispiele: Sieg in regulärer Zeit/Verlängerung hat Ring und Pokal, aber keine Strafstoß-Zeile; Unentschieden in der Gruppe nichts davon.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { displayLayout, displayFontSizes, displayMonitor } from '../../../design-tokens';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import { buildMonitorView } from '../../../features/monitor-display/monitorView';
import { liveMatchOf } from '../../../features/monitor-display/__tests__/monitorViewHelper';
import { GAME, hf1Besetzt, NORD, withCloudColumns, type Hallencup } from '../../../core/view/__fixtures__/hallencupNord';

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({ liveMatches: new Map(), lastGoalEvent: null, lastCardEvent: null }),
}));

const LANG = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
type Spalten = Parameters<typeof withCloudColumns>[2];

/** `spiel`: Halbfinale 1 (Finalrunde) oder ein Gruppenspiel (z. B. GAME[7]) */
async function ende(spalten: Spalten, benennen?: { id: string; name: string }, spiel: number = GAME.HF1) {
  const cup = withCloudColumns(await hf1Besetzt(), spiel, { match_status: 'finished', ...spalten });
  const teams = benennen ? cup.tournament.teams.map((t) => (t.id === benennen.id ? { ...t, name: benennen.name } : t)) : cup.tournament.teams;
  return zeige(cup, { ...cup.tournament, teams }, spiel);
}
/** Wie der Monitor-Weg: Stand und Runde (Gruppe/Finalrunde) kommen aus der Ansicht des Spiels */
function zeige(cup: Hallencup, tournament = cup.tournament, spiel: number = GAME.HF1) {
  const match = tournament.matches[spiel];
  const gezeigt = buildMonitorView(tournament).byId.get(match.id);
  return render(<LiveMatchDisplay match={liveMatchOf(match, tournament)} finalScore={gezeigt?.score} finalRound={gezeigt?.phase === 'final'} />);
}
const NUR_ERGEBNIS: Spalten = { score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, decided_by: 'penalty' };
const kasten = (seite: 'home' | 'away') => screen.getByTestId(`live-block-${seite}`).querySelector<HTMLElement>('[data-position]')!;
const name = (seite: 'home' | 'away') => screen.getByTestId(`live-name-${seite}`).querySelector<HTMLElement>('[data-teamname]')!;

describe('@ZM-147 @ZM-049 K5g4: Ergebnis nur eingetragen (ohne Schüsse)', () => {
  it('Sieger-Kasten mit Ring in der Primärfarbe und Pokal-Kreis, Verlierer-Kasten abgedunkelt', async () => {
    await ende(NUR_ERGEBNIS);
    expect(kasten('home').dataset.outcome).toBe('winner');
    expect(kasten('home').style.outline).toContain(displayLayout.scoreArea.frameWidthStrong);
    expect(screen.getByTestId('live-cup-home')).toBeInTheDocument();
    // Fixrunde 4: Pokal-Symbol (Mockup: Lucide „trophy“), Beschriftung „Pokal“
    expect(screen.getByTestId('live-cup-home').querySelector('[data-icon="trophy"]')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Pokal' })).toBe(screen.getByTestId('live-cup-home'));
    expect(screen.getByTestId('live-cup-home').style.width).toBe(displayLayout.scoreArea.monitorCup);
    expect(kasten('away').dataset.outcome).toBe('loser');
    expect(kasten('away').style.backgroundImage).toContain('linear-gradient');
    // Fixrunde 4: nur ein dezenter Schleier (Teamfarbe bleibt erkennbar), nicht der 70-%-Scrim
    expect(kasten('away').style.backgroundImage).toContain(`${displayLayout.scoreArea.loserDimShare}`);
    expect(kasten('away').style.backgroundImage).not.toContain(displayMonitor.overlay);
    expect(parseFloat(displayLayout.scoreArea.loserDimShare)).toBeLessThanOrEqual(35);
    expect(kasten('away').style.outline).toBe('');
    expect(screen.queryByTestId('live-cup-away')).toBeNull();
  });

  it('Verlierer-Name zurückgenommen (Textfarbe zweiter Ordnung, 600), Sieger-Name in voller Stärke (800)', async () => {
    await ende(NUR_ERGEBNIS);
    expect(name('home').style.fontWeight).toBe('800');
    expect(name('away').style.fontWeight).toBe('600');
    expect(name('away').style.color).not.toBe(name('home').style.color);
  });

  it('Strafstoß klein unter dem Doppelpunkt: Beschriftung klein, Zahl groß; keine Zeile „nach Verlängerung“; keine Schützen-Reihen', async () => {
    const { container } = await ende(NUR_ERGEBNIS);
    expect(screen.getByTestId('live-penalty').textContent).toBe('Strafstoßschießen 4 : 3');
    const zelle = screen.getByTestId('live-penalty-block').parentElement!;
    expect(zelle.style.gridColumn).toBe('2'); // die Mittelspalte, in der auch der Doppelpunkt steht
    expect(zelle.style.gridRow).toBe('2'); // unter den Kästen, nicht zwischen ihnen: dort ist der Platz für die Beschriftung zu schmal
    expect(zelle.style.justifySelf).toBe('center');
    const [beschriftung, zahl] = Array.from(screen.getByTestId('live-penalty').querySelectorAll<HTMLElement>('span'));
    expect(zahl.style.fontSize).toBe(displayFontSizes.teamName);
    expect(beschriftung.style.fontSize).toBe(displayFontSizes.clockHint);
    expect(screen.queryByTestId('live-after-overtime')).toBeNull();
    expect(container.querySelectorAll('[data-testid*="shootout"], [data-testid*="dots"], [data-testid*="schuetze"]')).toHaveLength(0);
  });

  it('Siegerzeile mit Pokal-Symbol in der Stufe monitorWinner, Hierarchie Stand > Strafstoß-Zahl > Siegerzeile', async () => {
    await ende(NUR_ERGEBNIS);
    const sieger = screen.getByTestId('live-winner');
    expect(sieger.textContent).toBe('FC Nord gewinnt');
    expect(sieger.querySelector('[data-icon="trophy"]')).not.toBeNull();
    // Fixrunde 4: Teamname fett (800), „gewinnt“ normal (Mockup `.fin b`)
    const fett = screen.getByTestId('live-winner-name');
    expect(fett.textContent).toBe('FC Nord');
    expect(fett.style.fontWeight).toBe('800');
    expect(sieger.textContent?.replace(fett.textContent ?? '', '').trim()).toBe('gewinnt');
    expect(sieger.style.fontSize).toBe(displayFontSizes.monitorWinner);
    const ziffer = (p: string) => parseFloat(p);
    expect(ziffer(displayFontSizes.monitorWinner)).toBeLessThan(ziffer(displayFontSizes.teamName)); // 4,3 < 6,2 cqh
  });
});

describe('@ZM-049 K5g: mit Verlängerung (2:2 nach Verlängerung, Strafstoß 4:3)', () => {
  it('zeigt „nach Verlängerung“ über dem Strafstoßergebnis', async () => {
    await ende({ score_a: 1, score_b: 1, overtime_score_a: 1, overtime_score_b: 1, penalty_score_a: 4, penalty_score_b: 3, decided_by: 'penalty' });
    expect(screen.getByTestId('live-after-overtime').textContent).toBe('nach Verlängerung');
    expect(screen.getByLabelText('Heim: 2')).toBeInTheDocument();
    expect(screen.getByTestId('live-penalty').textContent).toBe('Strafstoßschießen 4 : 3');
  });
});

/** Breite in Prozent aus `70%` oder `calc(56%)` (jsdom rechnet den Faktor aus) */
const prozent = (breite: string): number => parseFloat(breite.replace('calc(', ''));

describe('@ZM-087 @ZM-049 K5g3: 50-Zeichen-Verlierer', () => {
  it('Namen schmaler als der Kasten (Umbruch statt Überlappung mit dem Strafstoßergebnis), Verlierer in Monitor-Form, kein „…“', async () => {
    const { container } = await ende({ ...NUR_ERGEBNIS, penalty_score_a: 3, penalty_score_b: 4 }, { id: NORD, name: LANG });
    expect(prozent(screen.getByTestId('live-name-home').style.width)).toBeLessThan(parseFloat(displayLayout.scoreArea.blockWidth));
    expect(prozent(screen.getByTestId('live-name-away').style.width)).toBeLessThan(parseFloat(displayLayout.scoreArea.blockWidth));
    expect(name('home').textContent).toBe('SG FF Nordheim-Süd 1921');
    expect(name('home').style.fontWeight).toBe('600'); // Verlierer
    expect(screen.getByTestId('live-winner').textContent).not.toContain('…');
    expect(container.textContent).not.toContain('…');
  });
});

describe('Gegenbeispiele', () => {
  it('Sieg in regulärer Zeit: Ring und Pokal am Sieger, aber keine Strafstoß-Zeile und keine Siegerzeile (nur „Endstand“)', async () => {
    await ende({ score_a: 3, score_b: 1, decided_by: 'regular' });
    expect(kasten('home').dataset.outcome).toBe('winner');
    expect(screen.getByTestId('live-cup-home')).toBeInTheDocument();
    expect(kasten('away').dataset.outcome).toBe('loser');
    expect(screen.queryByTestId('live-penalty-block')).toBeNull();
    expect(screen.queryByTestId('live-winner')).toBeNull();
    expect(screen.getByTestId('live-endstand').textContent).toBe('Endstand');
  });

  // Spec 4.4/4.5 (Daniel 18.10.): „nach Verlängerung“ erscheint auch ohne Strafstoßschießen
  it('Sieg nach Verlängerung (Finalrunde): Ring, Pokal und „nach Verlängerung“, keine Strafstoß-Zeile', async () => {
    await ende({ score_a: 2, score_b: 2, overtime_score_a: 1, overtime_score_b: 0, decided_by: 'overtime' });
    expect(screen.getByTestId('live-cup-home')).toBeInTheDocument();
    expect(screen.queryByTestId('live-penalty-block')).toBeNull();
    expect(screen.getByTestId('live-after-overtime').textContent).toBe('nach Verlängerung');
  });

  it('Gegenbeispiel: Sieg in regulärer Zeit zeigt kein „nach Verlängerung“', async () => {
    await ende({ score_a: 3, score_b: 1, decided_by: 'regular' });
    expect(screen.queryByTestId('live-after-overtime')).toBeNull();
  });

  it('@ZM-049 Sieg nach Verlängerung in der Gruppe: Ring und „nach Verlängerung“, kein Pokal', async () => {
    await ende({ score_a: 2, score_b: 2, overtime_score_a: 0, overtime_score_b: 1, decided_by: 'overtime' }, undefined, GAME[7]);
    expect(kasten('away').dataset.outcome).toBe('winner');
    expect(screen.queryByTestId('live-cup-away')).toBeNull();
    expect(screen.getByTestId('live-after-overtime').textContent).toBe('nach Verlängerung');
  });

  // Spec 4.5: Pokal nur in der Finalrunde, Ring bei jedem Sieger
  it('@ZM-049 Gruppensieg: Ring um den Sieger-Kasten, Name fett, Verlierer zurückgenommen, aber kein Pokal', async () => {
    await ende({ score_a: 3, score_b: 1, decided_by: 'regular' }, undefined, GAME[7]);
    expect(kasten('home').dataset.outcome).toBe('winner');
    expect(kasten('home').style.outline).toContain(displayLayout.scoreArea.frameWidthStrong);
    expect(name('home').style.fontWeight).toBe('800');
    expect(kasten('away').dataset.outcome).toBe('loser');
    expect(name('away').style.fontWeight).toBe('600');
    expect(screen.queryByTestId('live-cup-home')).toBeNull();
    expect(screen.queryByTestId('live-cup-away')).toBeNull();
  });

  it('@ZM-049 Gegenbeispiel: Finalrunde (K.-o.) hat bei jedem Sieg Ring und Pokal', async () => {
    await ende({ score_a: 0, score_b: 2, decided_by: 'regular' });
    expect(kasten('away').dataset.outcome).toBe('winner');
    expect(screen.getByTestId('live-cup-away')).toBeInTheDocument();
    expect(screen.queryByTestId('live-cup-home')).toBeNull();
  });

  it('Unentschieden in der Gruppe: kein Ring, kein Pokal, kein Verlierer, nichts zurückgenommen', async () => {
    await ende({ score_a: 1, score_b: 1, decided_by: 'regular' }, undefined, GAME[7]);
    expect(kasten('home').dataset.outcome).toBeUndefined();
    expect(kasten('away').dataset.outcome).toBeUndefined();
    expect(screen.queryByTestId('live-cup-home')).toBeNull();
    expect(screen.queryByTestId('live-cup-away')).toBeNull();
    expect(name('home').style.fontWeight).toBe('700');
    expect(name('away').style.fontWeight).toBe('700');
  });

  it('laufendes Spiel: weder Ring noch Pokal', async () => {
    const cup = withCloudColumns(await hf1Besetzt(), GAME.HF1, { match_status: 'running', score_a: 2, score_b: 1 });
    zeige(cup);
    expect(kasten('home').dataset.outcome).toBeUndefined();
    expect(screen.queryByTestId('live-cup-home')).toBeNull();
  });
});
