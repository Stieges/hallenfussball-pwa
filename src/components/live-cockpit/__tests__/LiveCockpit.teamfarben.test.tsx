/**
 * Cockpit mit Teamfarben (Plan Cockpit v2 A2): @SL-176 Kästen und Team-Kopf in der getragenen Farbe wie am Monitor,
 * @SL-177 Bedientasten behalten ihre Funktionsfarben, Seiten tauschen (H6).
 * Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md (@SL-176, @SL-177, @SL-065).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';
import type { CockpitKasten } from '../typesFarben';
import { getContrastRatio } from '../../../design-tokens/display';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const LILA = '#6A1B9A';
const GRUEN = '#2E7D32';
const GELB = '#FDD835';
const BLAU = '#1565C0';
const ROT = '#C62828';
const spiel = () => makeLiveMatch({ homeTeam: { id: 'petting', name: 'TSV Petting' }, awayTeam: { id: 'otting', name: 'DJK Otting' } });
const solid = (color: string) => ({ fill: { kind: 'solid' as const, color }, bib: false });

describe('@SL-176 Kästen und Team-Kopf in der getragenen Farbe', () => {
  const faelle: Array<{ lage: string; kasten: CockpitKasten; heim: string; gast: string; gastWeste: boolean }> = [
    { lage: 'Petting trägt Lila, Otting Grün', kasten: { home: solid(LILA), away: solid(GRUEN) }, heim: LILA, gast: GRUEN, gastWeste: false },
    { lage: 'Otting trägt gelbe Leibchen über grünen Trikots', kasten: { home: solid(LILA), away: { fill: { kind: 'vest', center: GELB, stripes: GRUEN }, bib: true } }, heim: LILA, gast: GELB, gastWeste: true },
    { lage: '„Teamfarben“ ausgeschaltet: Standardfarben Heim und Gast', kasten: { home: solid(BLAU), away: solid(ROT) }, heim: BLAU, gast: ROT, gastWeste: false },
  ];
  it.each(faelle)('$lage', ({ kasten, heim, gast, gastWeste }) => {
    render(<LiveCockpit {...makeProps(spiel(), { kasten })} />);
    const links = screen.getByTestId('scoreboard-box-links');
    const rechts = screen.getByTestId('scoreboard-box-rechts');
    expect(links).toHaveAttribute('data-color', heim);
    expect(rechts).toHaveAttribute('data-color', gast);
    expect(screen.getByTestId('team-head-home')).toHaveAttribute('data-color', heim);
    expect(screen.getByTestId('team-head-away')).toHaveAttribute('data-color', gast);
    // Weste und Leibchen-Zeichen nur bei Leibchen
    expect(rechts.hasAttribute('data-stripes')).toBe(gastWeste);
    expect(screen.queryByTestId('scoreboard-box-rechts-bib') !== null).toBe(gastWeste);
    // Ziffern auf dem Kasten mit mindestens 4,5 : 1
    for (const [box, farbe] of [[links, heim], [rechts, gast]] as const) {
      expect(getContrastRatio(farbe, box.getAttribute('data-digit-color') ?? '#000000')).toBeGreaterThanOrEqual(4.5);
    }
    // Name, Seite, „Heim“/„Gast“ stehen weiter dabei
    expect(within(screen.getByTestId('team-head-home')).getByTestId('team-name-home')).toHaveTextContent('TSV Petting');
    expect(screen.getByTestId('team-head-home')).toHaveTextContent('Heim');
    expect(screen.getByTestId('team-head-away')).toHaveTextContent('Gast');
    expect(screen.getByTestId('scoreboard-name-links')).toHaveTextContent('TSV Petting');
  });

  it('Gegenbeispiel: ohne Angabe die Standardfarben Heim Blau und Gast Rot (wie der Monitor ohne Ansicht)', () => {
    render(<LiveCockpit {...makeProps(spiel())} />);
    expect(screen.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', BLAU);
    expect(screen.getByTestId('scoreboard-box-rechts')).toHaveAttribute('data-color', ROT);
  });

  it('H6 Seiten getauscht: die Farbe wandert mit dem Team – Lila für Petting steht jetzt rechts, Kasten und Kopf gleich', async () => {
    render(<LiveCockpit {...makeProps(spiel(), { kasten: { home: solid(LILA), away: solid(GRUEN) } })} />);
    await userEvent.click(screen.getByTestId('cockpit-more-button'));
    await userEvent.click(await screen.findByTestId('mehr-seiten-tauschen'));
    expect(screen.getByTestId('scoreboard-box-rechts')).toHaveAttribute('data-color', LILA);
    expect(screen.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', GRUEN);
    expect(screen.getByTestId('scoreboard-name-rechts')).toHaveTextContent('TSV Petting');
    // der Kopf von Petting bleibt Lila, in der rechten Spalte
    expect(screen.getByTestId('team-head-home')).toHaveAttribute('data-color', LILA);
    expect(screen.getByTestId('team-column-home').compareDocumentPosition(screen.getByTestId('team-column-away')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

describe('@SL-177 Die Bedientasten behalten ihre Funktionsfarben', () => {
  const rotesTeam = () => makeLiveMatch({ homeTeam: { id: 'waging', name: 'TSV Waging rot' }, awayTeam: { id: 'otting', name: 'DJK Otting' } });
  const kasten: CockpitKasten = { home: solid(ROT), away: solid(GRUEN) };

  it('„Tor“, „Foul“, „Zeitstrafe“ und „Karte“ von TSV Waging rot tragen keine Teamfarbe und kein Rot', () => {
    render(<LiveCockpit {...makeProps(rotesTeam(), { kasten })} />);
    const tasten = ['goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home'].map((id) => screen.getByTestId(id));
    for (const taste of tasten) {
      const stil = (taste.getAttribute('style') ?? '').toLowerCase();
      expect(stil, taste.getAttribute('data-testid') ?? '').not.toContain(ROT.toLowerCase());
      expect(stil).not.toContain('198, 40, 40');
      expect(stil).not.toContain('--color-error');
    }
    // Tor bleibt in der Hauptfarbe, ohne farbigen Rahmen um die Teamfarbe
    expect(screen.getByTestId('goal-button-home').getAttribute('style')).toContain('var(--color-primary)');
  });

  it('Rot bleibt dem Abpfiff vorbehalten: die Halte-Taste „Abpfiff“ trägt weiter den Fehler-Ton (Gegenprobe)', () => {
    render(<LiveCockpit {...makeProps(rotesTeam(), { kasten })} />);
    const abpfiff = screen.getByTestId('match-finish-button');
    expect(`${abpfiff.getAttribute('style') ?? ''} ${abpfiff.className}`).toMatch(/error|danger|rot/i);
  });
});
