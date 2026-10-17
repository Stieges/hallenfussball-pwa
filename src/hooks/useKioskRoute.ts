import { useLocation } from 'react-router-dom';
import { isKioskRoute } from '../core/routing';

/** true auf Kiosk-Routen (@ME-003, @OB-028): die App zeigt dort keine globalen Einblendungen. */
export function useKioskRoute(): boolean {
  const location = useLocation();
  return isKioskRoute(location.pathname);
}
