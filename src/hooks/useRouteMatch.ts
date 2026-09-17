import { useLocation } from 'react-router-dom';
import { matchRoute, type RouteMatch } from '../core/routing';

/** Zentraler Routen-Match — ersetzt die Inline-Regexe in App.tsx. */
export function useRouteMatch(): RouteMatch | null {
  const location = useLocation();
  return matchRoute(location.pathname);
}
