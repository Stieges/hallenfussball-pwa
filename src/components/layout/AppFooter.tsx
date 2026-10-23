/**
 * AppFooter – Fußzeile der App nur ohne Cockpit-Rahmen (Plan LT-2, Ruling R-LT1, @SL-140: im laufenden Spiel keine Fußzeile).
 */
import type { ComponentProps, ReactElement } from 'react';
import { Footer } from './Footer';
import { useCockpitFrame } from '../live-cockpit/frame/cockpitFrame';

export function AppFooter(props: ComponentProps<typeof Footer>): ReactElement | null {
  const { vollbild } = useCockpitFrame();
  return vollbild ? null : <Footer {...props} />;
}
