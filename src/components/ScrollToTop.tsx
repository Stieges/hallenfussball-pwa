/**
 * ScrollToTop - Scrolls to top on route change
 *
 * This component should be placed inside the Router context.
 * It automatically scrolls to the top of the page whenever
 * the pathname changes.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default ScrollToTop;
