/**
 * JumpToLiveButton – die schwebende Taste „Zum laufenden Spiel“ (@ZP-109, Variante B, Daniel 09.11.): eine dunkle Pille mit heller
 * Schrift, einzeilig, unten mittig. Sie erscheint nur unter 1280 Bildpunkten, nur wenn die Karte des laufenden Spiels aus dem Bild
 * gescrollt ist und die Seite mehr als `SHOW_AFTER_SCROLL` Bildpunkte gescrollt wurde; sie springt zur Karte und verschwindet,
 * sobald die Karte wieder im Bild ist. Beobachtet wird die Karte (`IntersectionObserver`), kein Wartezeit-Raten.
 */
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { breakpointValues } from '../../../design-tokens/breakpoints';
import { Icons } from '../../../components/ui/Icons';
import { jumpButtonBottom } from './jumpToLivePosition';

/** Erst nach so viel Scrollen (Bildpunkte) kann die Taste erscheinen (@ZP-109) */
export const SHOW_AFTER_SCROLL = 200;

export interface JumpToLiveButtonProps {
  /** Die Karte des laufenden Spiels, auf die die Taste springt */
  targetId: string;
}

const buttonStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: cssVars.zIndex.floating,
  display: 'inline-flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  minHeight: cssVars.touchTargets.primary,
  padding: `0 ${cssVars.spacing.lg}`,
  border: 'none',
  borderRadius: cssVars.borderRadius.full,
  background: cssVars.colors.textPrimary,
  color: cssVars.colors.background,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.bold,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  boxShadow: cssVars.shadows.md,
  cursor: 'pointer',
};

const narrow = (): boolean => window.innerWidth < breakpointValues.wide;
const phone = (): boolean => window.innerWidth < breakpointValues.tablet;

export function JumpToLiveButton({ targetId }: JumpToLiveButtonProps): ReactElement | null {
  const { t } = useTranslation('tournament');
  const [visible, setVisible] = useState(false);
  const [onPhone, setOnPhone] = useState(false);

  useEffect(() => {
    const target = document.querySelector(`[data-testid="${targetId}"]`);
    if (target === null || typeof IntersectionObserver === 'undefined') {
      setVisible(false);
      return undefined;
    }
    let inView = true;
    const update = (): void => {
      setVisible(narrow() && !inView && window.scrollY > SHOW_AFTER_SCROLL);
      setOnPhone(phone());
    };
    const observer = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
      update();
    });
    observer.observe(target);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [targetId]);

  if (!visible) {
    return null;
  }
  const jump = (): void => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector(`[data-testid="${targetId}"]`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <button type="button" style={{ ...buttonStyle, bottom: jumpButtonBottom(onPhone) }} onClick={jump} data-testid="schedule-jump-to-live">
      <Icons.ArrowUp size={iconSizeValues.sm} />
      {t('scheduleCurrent.jumpToLive')}
    </button>
  );
}
