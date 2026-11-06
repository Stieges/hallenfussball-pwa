/**
 * B-26: Einhängepunkte der Spielkarten für „Zeiten verschieben“ (Record Zeitplan am Turniertag).
 * - `OriginalTimeNote`: klein „(war hh:mm)“ in der Zeile der neuen Anpfiffzeit, wenn die Uhrzeit um mindestens 1 Minute abweicht
 *   (@ZP-004, @ZP-010, @ZP-037, @ZP-046). Die Uhrzeit liefert der Spielplan der Leitung über den Kontext. K.-o.-Spiele tragen
 *   keinen Zusatz „voraussichtlich“ (@ZM-105, seit 2026-11-05).
 * - `MatchMenuSlot`: der ⋮-Knopf je Spiel („Ab hier verschieben“, @ZP-098); nur, wenn der Spielplan ihn anbietet.
 * Die Zuschauer-Seite liefert die Uhrzeit aus der gemeinsamen Ansicht (`ViewTimeNotes`), die Leitung aus ihrem Spielplan.
 * Ohne Kontext (PDF, andere Ansichten) erscheint nichts.
 */
import { useContext, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { MatchTimeShiftContext } from './matchTimeShiftContext';

const noteStyle: CSSProperties = {
  display: 'inline',
  marginInlineStart: cssVars.spacing.xs,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.normal,
  color: cssVars.colors.textSecondary,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

export function OriginalTimeNote({ matchId }: { matchId: string }) {
  const { t } = useTranslation('tournament');
  const slots = useContext(MatchTimeShiftContext);
  const time = slots?.originalTimeOf(matchId);
  if (time === undefined) {
    return null;
  }
  return (
    <span style={noteStyle} data-testid={`match-original-${matchId}`}>
      {t('timeShift.original', { time })}
    </span>
  );
}

const slotStyle: CSSProperties = { display: 'flex', alignItems: 'center', flex: 'none' };

export function MatchMenuSlot({ matchId }: { matchId: string }) {
  const menu = useContext(MatchTimeShiftContext)?.renderMenu?.(matchId);
  if (menu === undefined || menu === null) {
    return null;
  }
  // Klicks im Menü öffnen nicht die Karte darunter
  return (
    <span style={slotStyle} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {menu}
    </span>
  );
}
