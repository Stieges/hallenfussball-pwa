/**
 * Zeitstrafe am Monitor (Mockup zeitstrafe-monitor Variante A, Daniel 05.11.): @ZM-182, @ZM-183, @ZM-192.
 * Spiel 7 „FC Nord – SV Süd“ läuft auf der Live-Folie Feld 1, Stand 1:0; SV Süd hat in der 4. Minute eine Zeitstrafe von
 * 2 Minuten für die Rückennummer 5. Ereignisse und Uhr kommen wie aus der öffentlichen Antwort (`events`, `liveState`),
 * „jetzt“ ist die Serverzeit des Monitors (`NowSourceContext`).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import type { Match, RuntimeMatchEvent } from '../../../types/tournament';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';
import { displayLayout } from '../../../design-tokens';
import { buildTournament, slide, withMatch } from './monitorFixture';
import { liveMatchOf, withView } from './monitorViewHelper';
import { LiveMatchDisplay } from '../../../components/monitor';

const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const START_5 = 200_000;

function strafe(id: string, teamId: string, nummer: number | undefined, clockMs: number): RuntimeMatchEvent {
  return {
    id, type: 'TIME_PENALTY', timestampSeconds: Math.floor(clockMs / 1000), clockMs,
    payload: { teamId, ...(nummer === undefined ? {} : { playerNumber: nummer }), durationSeconds: 120 },
    scoreAfter: { home: 1, away: 0 },
  };
}

function uhr(gespieltMs: number, status = 'running') {
  return { status, phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, sectionStartMs: 0, elapsedMs: gespieltMs, anchorAt: status === 'running' ? T0 : null };
}

const NR5 = strafe('s5', 'team-sued', 5, START_5);

function zeige(patch: Partial<Match>, extra: Parameters<typeof buildTournament>[0] = {}) {
  const tournament = buildTournament({ matches: withMatch('match-7', patch), ...extra });
  return render(
    <NowSourceContext.Provider value={() => T0}>
      <LiveSlide slide={slide('live', { fieldId: 'field-1' })} {...withView(tournament)} performanceSettings={{} as PerformanceSettings} theme="dark" style={{}} />
    </NowSourceContext.Provider>,
  );
}

const kreise = (seite: 'home' | 'away') => Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="live-penalties-${seite}"] [data-zeitstrafe]`));
const alleKreise = () => document.querySelectorAll('[data-zeitstrafe]');

describe('@ZM-182 Eine laufende Zeitstrafe zeigt der Monitor als ablaufenden Kreis an der Ecke des Kastens', () => {
  it('@ZM-182 die Strafe läuft 30 Sekunden: am Kasten von SV Süd ein Kreis mit „5“, Ring zu drei Vierteln voll', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000) });
    const [kreis] = kreise('away');
    expect(kreise('away')).toHaveLength(1);
    expect(kreis).toHaveTextContent('5');
    expect(kreis.dataset.anteil).toBe('0.750');
    expect(kreise('home')).toEqual([]);
    // der Kreis sitzt im Kasten von SV Süd
    expect(kreis.closest('[data-testid="live-block-away"]')).not.toBeNull();
  });

  it('@ZM-182 die Strafe ist abgelaufen: kein Kreis mehr am Kasten von SV Süd', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 120_000) });
    expect(alleKreise()).toHaveLength(0);
  });

  it('@ZM-182 zweite Zeitstrafe für Nr. 8: zwei Kreise nebeneinander, „5“ und „8“', () => {
    zeige({ events: [NR5, strafe('s8', 'team-sued', 8, START_5 + 20_000)], liveState: uhr(START_5 + 30_000) });
    expect(kreise('away').map((k) => k.textContent)).toEqual(['5', '8']);
    expect(kreise('away').map((k) => k.dataset.anteil)).toEqual(['0.750', '0.917']);
  });

  it('@ZM-182 die Uhr steht in der Halbzeitpause: Kreis mit „5“ und grauem Ring (wie der angehaltene Zeitbalken)', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000, 'section_break') });
    const [kreis] = kreise('away');
    expect(kreis).toHaveTextContent('5');
    expect(kreis.dataset.steht).toBe('true');
  });

  it('@ZM-182 der Stand und die Kästen bleiben: der Kreis liegt im Kasten (absolut), nicht im Raster', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000) });
    const reihe = document.querySelector<HTMLElement>('[data-testid="live-penalties-away"]');
    expect(reihe).toHaveStyle({ position: 'absolute', left: displayLayout.scoreArea.penaltyInset, bottom: displayLayout.scoreArea.penaltyInset });
    expect(document.querySelector('[data-position="away"]')).toHaveAttribute('aria-label', 'Gast: 0');
  });
});

describe('@ZM-183 Ohne laufende Zeitstrafe oder bei verborgenen Ereignissen zeigt der Monitor keinen Kreis', () => {
  it('@ZM-183 SV Süd hat in der 4. Minute eine Gelbe Karte bekommen: an keinem Kasten ein Kreis', () => {
    const gelb: RuntimeMatchEvent = { id: 'g', type: 'YELLOW_CARD', timestampSeconds: 200, clockMs: START_5, payload: { teamId: 'team-sued', playerNumber: 5, cardType: 'YELLOW' }, scoreAfter: { home: 1, away: 0 } };
    zeige({ events: [gelb], liveState: uhr(START_5 + 30_000) });
    expect(alleKreise()).toHaveLength(0);
  });

  it('@ZM-183 „Ereignisse je Spiel“ aus: die Antwort enthält keine Ereignisse, an keinem Kasten ein Kreis', () => {
    zeige({ events: undefined, liveState: uhr(START_5 + 30_000) });
    expect(alleKreise()).toHaveLength(0);
  });

  it('@ZM-183 Kindermodus, SV Süd hat eine laufende Zeitstrafe: an keinem Kasten ein Kreis', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000) }, { hideScoresForPublic: true });
    expect(alleKreise()).toHaveLength(0);
  });
});

describe('@ZM-192 Der Zeitstrafen-Kreis folgt dem Spielverlauf, ohne Kästen, Stand oder Uhr zu verschieben', () => {
  const nr8 = strafe('s8', 'team-sued', 8, START_5 + 10_000);
  const nr3 = strafe('s3', 'team-sued', 3, START_5 + 20_000);

  it('@ZM-192 Zeitstrafen für Nr. 8 und Nr. 3: drei Kreise, „5“ in der Ecke, rechts daneben „8“, dann „3“', () => {
    zeige({ events: [NR5, nr8, nr3], liveState: uhr(START_5 + 30_000) });
    expect(kreise('away').map((k) => k.textContent)).toEqual(['5', '8', '3']);
  });

  it('@ZM-192 die Strafe für Nr. 5 läuft ab: „8“ rückt in die Ecke, „3“ rechts daneben', () => {
    zeige({ events: [NR5, nr8, nr3], liveState: uhr(START_5 + 120_000) });
    expect(kreise('away').map((k) => k.textContent)).toEqual(['8', '3']);
  });

  it('@ZM-192 ohne Rückennummer: ein Kreis mit leerer Scheibe', () => {
    zeige({ events: [strafe('s0', 'team-sued', undefined, START_5)], liveState: uhr(START_5 + 30_000) });
    const [kreis] = kreise('away');
    expect(kreis.textContent).toBe('');
  });

  it('@ZM-192 die Uhr wird im laufenden Spiel angehalten: grauer Ring', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000, 'paused'), matchStatus: 'paused' });
    expect(kreise('away')[0].dataset.steht).toBe('true');
  });

  it('@ZM-192 Gegenbeispiel: läuft die Uhr, ist der Ring nicht grau', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000) });
    expect(kreise('away')[0].dataset.steht).toBe('false');
  });

  it('@ZM-192 neben dem Kreis steht kein Wort „Zeitstrafe“ und keine Restzeit in Ziffern (nur für Bildschirmleser)', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000) });
    const reihe = document.querySelector<HTMLElement>('[data-testid="live-penalties-away"]');
    expect(reihe?.textContent).toBe('5');
    // Wortlaut für Bildschirmleser mit echten Texten: LivePenaltyCircles.i18n.test.tsx
    expect(kreise('away')[0]).toHaveAttribute('role', 'img');
  });

  it('@ZM-192 der Kreis ist so groß wie der Pokal-Kreis', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000) });
    expect(kreise('away')[0]).toHaveStyle({ width: displayLayout.scoreArea.monitorCup, height: displayLayout.scoreArea.monitorCup });
  });

  it('@ZM-180 @ZM-192 beendet bleibt beendet: kommt noch ein älterer Feinstatus „läuft“ mit, zeigt der Endstand keinen Kreis', () => {
    const tournament = buildTournament({ matches: withMatch('match-7', { matchStatus: 'finished' }) });
    const spiel7 = tournament.matches.find((m) => m.id === 'match-7');
    if (spiel7 === undefined) { throw new Error('Spiel 7 fehlt'); }
    render(
      <NowSourceContext.Provider value={() => T0}>
        <LiveMatchDisplay match={liveMatchOf(spiel7, tournament)} fullscreen zeitstrafenQuelle={{ events: [NR5], liveState: uhr(START_5 + 30_000) }} />
      </NowSourceContext.Provider>,
    );
    expect(document.querySelector('[data-testid="live-block-away"]')).not.toBeNull();
    expect(alleKreise()).toHaveLength(0);
  });

  it('@ZM-192 das Spiel wird abgepfiffen, während die Strafe läuft: kein Kreis mehr, auch nicht auf dem Endstand', () => {
    zeige({ events: [NR5], liveState: uhr(START_5 + 30_000, 'finished'), matchStatus: 'finished' });
    expect(alleKreise()).toHaveLength(0);
  });
});
