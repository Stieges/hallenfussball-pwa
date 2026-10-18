/**
 * SW (@EK-062) Monitor: „Und Monitor, Zuschauer-Seite und Finalrunde zeigen 2:3 ohne Strafstoß.“ Gegenfall: endet Halbfinale 1
 * nach dem Wiedereröffnen erneut 2:2, zählt das Strafstoßschießen 4:3 wieder.
 * Halbfinale 1 FC Nord – DJK Berg: Direkteintrag 2:2 + 4:3, wieder eröffnet, (Tor DJK Berg,) Abpfiff. Die Spielzeile kommt aus der
 * echten Kette (Engine → `cacheColumns` → Mapper, `ek062Halbfinale.ts`), die Folie wie auf main über `buildMonitorView` +
 * `finalScore` (Muster `LiveMatchDisplay.zm147.test.tsx`, A-36c).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next'); // echte DE-Texte
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { LiveMatchDisplay } from '../../../components/monitor/LiveMatchDisplay';
import { buildMonitorView } from '../monitorView';
import { liveMatchOf } from './monitorViewHelper';
import { gespielt } from '../../../core/view/__fixtures__/ek062Halbfinale';

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({ liveMatches: new Map(), lastGoalEvent: null, lastCardEvent: null }),
}));

async function monitorFolie(mitTorDjkBerg: boolean) {
  const { cup, hf1 } = await gespielt(mitTorDjkBerg);
  const view = buildMonitorView(cup.tournament);
  return render(<LiveMatchDisplay match={liveMatchOf(hf1, cup.tournament)} finalScore={view.byId.get(hf1.id)?.score} />);
}

describe('@EK-062 Monitor zeigt das wiedereröffnete Halbfinale 1 mit 2:3 ohne Strafstoß', () => {
  // Ohne Strafstoß steht an der Uhr „Endstand“ (LiveFinalScore: Siegerzeile nur nach einem Strafstoßschießen, @ZM-147).
  it('@EK-062 Monitor-Folie: FC Nord 2 : 3 DJK Berg, „Endstand“, kein Strafstoßschießen und keine Siegerzeile', async () => {
    const { container } = await monitorFolie(true);
    expect(screen.getByLabelText('Heim: 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Gast: 3')).toBeInTheDocument();
    expect(screen.getByTestId('live-endstand').textContent).toBe('Endstand');
    expect(screen.queryByTestId('live-winner')).toBeNull();
    expect(screen.queryByTestId('live-penalty')).toBeNull();
    expect(container.textContent).not.toMatch(/Strafstoß/);
  });

  it('@EK-062 Gegenbeispiel: erneut 2:2 – Monitor zeigt 2 : 2, „Strafstoßschießen 4 : 3“ und FC Nord als Sieger', async () => {
    await monitorFolie(false);
    expect(screen.getByLabelText('Heim: 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Gast: 2')).toBeInTheDocument();
    expect(screen.getByTestId('live-penalty').textContent).toBe('Strafstoßschießen 4 : 3');
    expect(screen.getByTestId('live-winner').textContent).toBe('FC Nord gewinnt');
  });
});
