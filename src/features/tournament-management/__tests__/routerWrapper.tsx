/** Router für Tests, die `ManagementTab` rendern: Feld in der Adresse (`?f=`) und „Zurück“ im schmalen Kopf brauchen einen Router (Plan LT-2). */
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

export function RouterWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/tournament/tournament-1/live']}>{children}</MemoryRouter>;
}
