/**
 * Symbole der Aktionen im Aktionsblatt (@SL-239: jeder Eintrag trägt ein Symbol und sein Wort). Reine Zuordnung
 * Aktion → vorhandenes Symbol; das Wort der Taste trägt die Bedeutung, das Symbol ist nur Wiedererkennung.
 */
import type { ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { Icons } from '../../ui/Icons';
import type { MatchActionId } from './matchActions';

/** „Nicht angetreten“: durchgestrichener Kreis (Icons kennt keinen). */
function Ban({ size }: { size: string }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2" />
      <path d="M4.7 4.7l10.6 10.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MatchActionIcon({ action }: { action: MatchActionId }): ReactElement {
  const size = cssVars.iconSizes.md;
  switch (action) {
    case 'enterResult':
    case 'endAndEnter':
    case 'correct':
      return <Icons.Edit size={size} />;
    case 'kickOff':
    case 'toCockpit':
      return <Icons.Monitor size={size} />;
    case 'shiftFrom':
      return <Icons.Clock size={size} />;
    case 'changeReferee':
      return <Icons.User size={size} />;
    case 'changeField':
      return <Icons.ArrowRightLeft size={size} />;
    case 'forfeit':
      return <Ban size={size} />;
    case 'revokeForfeit':
      return <Icons.Restore size={size} />;
    case 'protocol':
      return <Icons.List size={size} />;
  }
}
