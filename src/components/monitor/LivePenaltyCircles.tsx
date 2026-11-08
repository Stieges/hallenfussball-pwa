/**
 * LivePenaltyCircles – laufende Zeitstrafen am Kasten der Live-Folie (@ZM-182, @ZM-183, @ZM-192; Mockup zeitstrafe-monitor
 * Variante A, Daniel 05.11.): innen in der Ecke unten links des Kastens, so groß wie der Pokal-Kreis, die älteste Strafe in
 * der Ecke, weitere rechts daneben ohne Lücke. Liegt absolut im Kasten: Kästen, Stand und Uhr verschieben sich nie (@ZM-151).
 * Die Restzeit rechnet `laufendeZeitstrafen` (core/view) in Serverzeit; der Ring tickt im Sekundentakt.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { displayLayout } from '../../design-tokens';
import type { monitorThemes } from '../../design-tokens';
import { zeitstrafeRestText, type OeffentlicheZeitstrafen } from '../../core/view';
import { StrafKreis } from '../ui/atoms/StrafKreis';

const layout = displayLayout.scoreArea;
/** Höchstens so viele Kreise je Kasten (drei passen im freien Band unter der Ziffer, @ZM-192) */
const MAX_KREISE = 3;

export interface LivePenaltyCirclesProps {
  side: 'home' | 'away';
  zeitstrafen: OeffentlicheZeitstrafen;
  themeColors: (typeof monitorThemes)[keyof typeof monitorThemes];
}

export function LivePenaltyCircles({ side, zeitstrafen, themeColors }: LivePenaltyCirclesProps): ReactElement | null {
  const { t } = useTranslation('monitor');
  const liste = zeitstrafen[side].slice(0, MAX_KREISE);
  if (liste.length === 0) {
    return null;
  }
  const reihe: CSSProperties = {
    position: 'absolute',
    left: layout.penaltyInset,
    bottom: layout.penaltyInset,
    display: 'flex',
    gap: layout.penaltyGap,
    pointerEvents: 'none',
  };
  const farben = {
    ring: themeColors.text,
    spur: `color-mix(in srgb, ${themeColors.text} ${layout.penaltyTrackMix}, ${themeColors.background})`,
    scheibe: themeColors.background,
    text: themeColors.text,
  };
  return (
    <div style={reihe} data-testid={`live-penalties-${side}`}>
      {liste.map((strafe) => {
        const rest = zeitstrafeRestText(strafe);
        return (
          <StrafKreis
            key={strafe.id}
            nummer={strafe.nummer}
            anteil={strafe.anteil}
            durchmesser={layout.monitorCup}
            rand={layout.frameWidthSubtle}
            ringAnteil={layout.penaltyRingShare}
            zifferAnteil={layout.penaltyNumberShare}
            farben={farben}
            steht={zeitstrafen.steht}
            ariaLabel={strafe.nummer === null
              ? t('liveMatch.penaltyAriaNoNumber', { rest })
              : t('liveMatch.penaltyAria', { number: strafe.nummer, rest })}
          />
        );
      })}
    </div>
  );
}
