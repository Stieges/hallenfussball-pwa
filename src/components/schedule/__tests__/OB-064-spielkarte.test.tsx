/**
 * @OB-064 „Tore folgen der Anordnung der Mannschaften, der Sieger steht fett“ (Record Oberfläche, Paket SK).
 * Werte und Wortlaut aus dem Gherkin des Szenariogrundrisses (Beispiele Z.1–Z.3), Halbfinale 1 „FC Nord gegen SG Mitte“:
 *   Z.1  2:2, FC Nord gewinnt das Strafstoßschießen 4:3 → je Zeile 2 / 2, (4) bei FC Nord, (3) bei SG Mitte, FC Nord fett, Tabelle „2:2 (4:3 i. E.)“
 *   Z.2  3:2 nach Verlängerung für FC Nord             → 3 / 2, Kopfzeile „n. V.“, FC Nord fett, Tabelle „3:2 n. V.“
 *   Z.3  1:0 nach regulärer Zeit                        → 1 / 0, kein Zusatz, FC Nord fett, Tabelle „1:0“
 * Regel „Tore folgen der Anordnung“: ein laufendes Spiel zeigt seine Spielzeit in der Kopfzeile der Karte.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Echte deutsche Texte prüfen (src/test/realDeI18n.ts).
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { cssVars } from '../../../design-tokens';
import { MatchCard, MatchCardDesktop } from '../MatchCard';
import { resultFigures, type ResultSource, type ResultStatus } from '../matchResult';

const NORD = { id: 'nord', name: 'FC Nord' };
const MITTE = { id: 'mitte', name: 'SG Mitte' };
const ID = 'hf1';

/** Ergebnis wie am Spiel gespeichert (Engine-Zwischenspeicher): `scoreA/B` regulär, Verlängerung getrennt. */
const AUSGANG = {
  strafstoss: { scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' },
  verlaengerung: { scoreA: 2, scoreB: 2, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime' },
  regulaer: { scoreA: 1, scoreB: 0 },
} satisfies Record<string, ResultSource>;

function karte(source: ResultSource, status: ResultStatus, extra: { elapsedFormatted?: string } = {}) {
  return render(
    <MatchCard
      matchId={ID}
      homeTeam={NORD}
      awayTeam={MITTE}
      scheduledTime="14:20"
      field={1}
      status={status}
      result={resultFigures(source, status)}
      {...extra}
    />,
  );
}

const tore = (seite: 'home' | 'away') => screen.getByTestId(`match-goals-${ID}-${seite}`).textContent;
const strafstoss = (seite: 'home' | 'away') => screen.queryByTestId(`match-penalty-${ID}-${seite}`)?.textContent;
/** fett = Schriftgewicht „bold“ (Token); `data-winner` allein reicht nicht, der Name muss auch so gesetzt sein. */
const istFett = (name: string) => screen.getByText(name).style.fontWeight === cssVars.fontWeights.bold;
const tabelle = (source: ResultSource) => {
  render(<MatchCardDesktop matchId={ID} homeTeam={NORD} awayTeam={MITTE} status="finished" result={resultFigures(source, 'finished')} />);
  return screen.getByTestId(`match-circle-${ID}`).textContent;
};

describe('@OB-064 Spielkarte am Handy: Tore je Zeile', () => {
  it('Z.1 Strafstoßschießen: je Zeile 2, daneben (4) bei FC Nord und (3) bei SG Mitte, FC Nord fett', () => {
    karte(AUSGANG.strafstoss, 'finished');
    expect(tore('home')).toBe('2');
    expect(tore('away')).toBe('2');
    expect(strafstoss('home')).toBe('(4)');
    expect(strafstoss('away')).toBe('(3)');
    expect(istFett('FC Nord')).toBe(true);
    expect(screen.getByTestId('match-card-decision').textContent).toBe('beendet i. E.');
  });

  it('Z.1 Gegenbeispiel: der Verlierer SG Mitte steht nicht fett', () => {
    karte(AUSGANG.strafstoss, 'finished');
    expect(istFett('SG Mitte')).toBe(false);
    expect(screen.getByText('SG Mitte').style.fontWeight).not.toBe(screen.getByText('FC Nord').style.fontWeight);
  });

  it('Z.2 Verlängerung: 3 und 2, die Kopfzeile nennt „n. V.“, FC Nord fett, kein Strafstoß', () => {
    karte(AUSGANG.verlaengerung, 'finished');
    expect(tore('home')).toBe('3');
    expect(tore('away')).toBe('2');
    expect(screen.getByTestId('match-card-decision').textContent).toBe('n. V.');
    expect(strafstoss('home')).toBeUndefined();
    expect(istFett('FC Nord')).toBe(true);
  });

  it('Z.3 regulär: 1 und 0, kein Zusatz, FC Nord fett', () => {
    karte(AUSGANG.regulaer, 'finished');
    expect(tore('home')).toBe('1');
    expect(tore('away')).toBe('0');
    expect(strafstoss('home')).toBeUndefined();
    expect(screen.queryByTestId('match-card-decision')).toBeNull();
    expect(istFett('FC Nord')).toBe(true);
  });

  it('Z.2/Z.3 Gegenbeispiel: ohne Verlängerung steht kein „n. V.“ auf der Karte', () => {
    const { container } = karte(AUSGANG.regulaer, 'finished');
    expect(container.textContent).not.toContain('n. V.');
    expect(container.textContent).not.toContain('i. E.');
  });

  it('Unentschieden ohne Entscheidung (Gruppenspiel 1:1): niemand fett', () => {
    karte({ scoreA: 1, scoreB: 1 }, 'finished');
    expect(istFett('FC Nord')).toBe(false);
    expect(istFett('SG Mitte')).toBe(false);
    expect(screen.getByText('FC Nord').style.fontWeight).not.toBe(cssVars.fontWeights.bold);
    expect(screen.getByText('SG Mitte').style.fontWeight).not.toBe(cssVars.fontWeights.bold);
  });
});

describe('@OB-064 Tabellenzeile am Desktop: Ergebnis waagerecht', () => {
  it('Z.1: „2:2 (4:3 i. E.)“', () => { expect(tabelle(AUSGANG.strafstoss)).toBe('2:2 (4:3 i. E.)'); });
  it('Z.2: „3:2 n. V.“', () => { expect(tabelle(AUSGANG.verlaengerung)).toBe('3:2 n. V.'); });
  it('Z.3: „1:0“ ohne Zusatz', () => { expect(tabelle(AUSGANG.regulaer)).toBe('1:0'); });
  it('Sieger fett: FC Nord (Heim) fett, SG Mitte nicht', () => {
    render(<MatchCardDesktop matchId={ID} homeTeam={NORD} awayTeam={MITTE} status="finished" result={resultFigures(AUSGANG.strafstoss, 'finished')} />);
    expect(istFett('FC Nord')).toBe(true);
    expect(istFett('SG Mitte')).toBe(false);
  });
});

describe('Regel: laufendes Spiel zeigt seine Spielzeit in der Kopfzeile, Tore je Zeile', () => {
  it('läuft 07:30 in der Kopfzeile, Tore 1 und 0, noch kein Sieger', () => {
    karte({ scoreA: 1, scoreB: 0 }, 'running', { elapsedFormatted: '07:30' });
    // Mockup Variante D: „läuft 07:30“ (i18n `matchResult.runningElapsed`), nicht das feste Wort „LIVE“
    expect(screen.getByTestId('match-card-live').textContent).toBe('läuft 07:30');
    expect(screen.queryByText('LIVE')).toBeNull();
    expect(tore('home')).toBe('1');
    expect(tore('away')).toBe('0');
    expect(istFett('FC Nord')).toBe(false);
  });

  it('läuft ohne bekannte Spielzeit: nur „läuft“, keine leere Zeit', () => {
    karte({ scoreA: 0, scoreB: 0 }, 'running');
    expect(screen.getByTestId('match-card-live').textContent).toBe('läuft');
  });

  it('Gegenbeispiel: ein geplantes Spiel zeigt weder Spielzeit noch Tore noch „läuft“', () => {
    const { container } = karte({}, 'scheduled');
    expect(screen.queryByTestId('match-card-elapsed')).toBeNull();
    expect(screen.queryByTestId('match-card-live')).toBeNull();
    expect(tore('home')).toBe('–');
    expect(tore('away')).toBe('–');
    expect(container.querySelector('[data-testid^="match-penalty"]')).toBeNull();
  });
});

describe('Golden Goal ist eine Form der Verlängerung (Z.2 sinngemäß)', () => {
  it('Spiel durch Golden Goal: Kopfzeile „n. V.“, Tabelle „n. V.“', () => {
    const golden = { scoreA: 1, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'goldenGoal' } as const;
    karte(golden, 'finished');
    expect(screen.getByTestId('match-card-decision').textContent).toBe('n. V.');
    expect(tore('home')).toBe('2');
  });
});

describe('Klickziel ins Cockpit bleibt (≥ 44 px)', () => {
  it('ein Klick auf die Torzahl ruft onCircleClick, nicht onCardClick', () => {
    const onCircleClick = vi.fn();
    const onCardClick = vi.fn();
    render(
      <MatchCard matchId={ID} homeTeam={NORD} awayTeam={MITTE} status="finished" result={resultFigures(AUSGANG.regulaer, 'finished')}
        onCircleClick={onCircleClick} onCardClick={onCardClick} />,
    );
    fireEvent.click(screen.getByTestId(`match-goals-${ID}-home`));
    expect(onCircleClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('die Torzahl-Fläche trägt die Mindestgröße 44 px als Token', () => {
    karte(AUSGANG.regulaer, 'finished');
    const knopf = screen.getByTestId(`match-goals-${ID}-home`);
    expect(knopf.style.minHeight).toContain('--touch');
  });
});
