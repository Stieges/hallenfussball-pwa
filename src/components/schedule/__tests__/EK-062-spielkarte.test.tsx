/**
 * SW (@EK-062) Zuschauer-Seite: „Und Monitor, Zuschauer-Seite und Finalrunde zeigen 2:3 ohne Strafstoß.“
 * Spielkarte (Spielplan der Zuschauer-Seite, `MatchCard` mit `resultFigures`) für Halbfinale 1 FC Nord – DJK Berg:
 * Direkteintrag 2:2 + 4:3, wieder eröffnet, Tor DJK Berg, Abpfiff. Die Spielzeile kommt aus der echten Kette
 * (Engine → `cacheColumns` → Mapper, `ek062Halbfinale.ts`), nicht von Hand.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { MatchCard, MatchCardDesktop } from '../MatchCard';
import { resultFigures as figuresOf } from '../matchResult';
import { matchFinalScore, type FinalScoreSource } from '../../../core/view/finalScore';
import { gespielt } from '../../../core/view/__fixtures__/ek062Halbfinale';

/** Spielzeile → Endstand der Ansicht (`matchFinalScore`) → Darstellung, wie in OB-064-spielkarte.test.tsx. */
const resultFigures = (source: FinalScoreSource, status: 'finished') =>
  figuresOf(matchFinalScore({ ...source, matchStatus: 'finished' }) ?? undefined, status);

const NORD = { id: 'nord', name: 'FC Nord' };
const BERG = { id: 'berg', name: 'DJK Berg' };
const ID = 'hf1';

async function karte(mitTorDjkBerg: boolean) {
  const { hf1 } = await gespielt(mitTorDjkBerg);
  const result = resultFigures(hf1, 'finished');
  render(<MatchCard matchId={ID} homeTeam={NORD} awayTeam={BERG} scheduledTime="16:40" field={1} status="finished" result={result} />);
  return result;
}

const tore = (seite: 'home' | 'away') => screen.getByTestId(`match-goals-${ID}-${seite}`).textContent;
const strafstoss = (seite: 'home' | 'away') => screen.queryByTestId(`match-penalty-${ID}-${seite}`)?.textContent;

describe('@EK-062 Zuschauer-Seite zeigt das wiedereröffnete Halbfinale 1 mit 2:3 ohne Strafstoß', () => {
  it('@EK-062 Spielkarte: 2 und 3, kein Strafstoß, kein „i. E.“, DJK Berg Sieger', async () => {
    const result = await karte(true);
    expect(tore('home')).toBe('2');
    expect(tore('away')).toBe('3');
    expect(strafstoss('home')).toBeUndefined();
    expect(strafstoss('away')).toBeUndefined();
    expect(document.body.textContent).not.toContain('i. E.');
    expect(result?.winner).toBe('b');
  });

  it('@EK-062 Tabellenzeile: „2:3“ ohne Strafstoß-Zusatz', async () => {
    const { hf1 } = await gespielt(true);
    render(<MatchCardDesktop matchId={ID} homeTeam={NORD} awayTeam={BERG} status="finished" result={resultFigures(hf1, 'finished')} />);
    expect(screen.getByTestId(`match-circle-${ID}`).textContent).toBe('2:3');
  });

  it('@EK-062 Gegenbeispiel: erneut 2:2 – (4) bei FC Nord, (3) bei DJK Berg, „beendet i. E.“', async () => {
    const result = await karte(false);
    expect(tore('home')).toBe('2');
    expect(tore('away')).toBe('2');
    expect(strafstoss('home')).toBe('(4)');
    expect(strafstoss('away')).toBe('(3)');
    expect(screen.getByTestId('match-card-decision').textContent).toBe('beendet i. E.');
    expect(result?.winner).toBe('a');
  });
});
