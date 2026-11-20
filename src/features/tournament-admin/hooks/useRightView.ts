/**
 * @HE-113: was ein rechtegebundener Bereich zeigt (Inhalt, Platzhalter oder Hinweis) -- für `RightSlot` und für Stellen, die
 * davon weitere Anzeigen abhängig machen. Unbekannte Rolle (Prüfung gescheitert, auf diesem Gerät nie gelernt): ein Konto und der
 * lokale Gast behalten den Inhalt (Notfall-Weg der Turnierleitung, der Server lehnt Unberechtigte ab), eine anonyme Sitzung nicht.
 */
import { useContext } from 'react';
import { AuthContext } from '../../auth/context/authContextInstance';
import { useCanState } from '../../auth/hooks/useCan';
import type { Permission } from '../../auth/utils/permissions';

export type RightView = 'content' | 'loading' | 'hint';

export function useRightView(permission: Permission, tournamentId: string): RightView {
  const { allowed, isLoading, isUnknown } = useCanState(permission, tournamentId);
  const anonymous = useContext(AuthContext)?.isAnonymous === true;
  if (allowed) { return 'content'; }
  if (isLoading) { return 'loading'; }
  return isUnknown === true && !anonymous ? 'content' : 'hint';
}

