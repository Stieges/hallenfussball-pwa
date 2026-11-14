/**
 * LoginRoute – die Anmeldeseite unter `/login` mit ihren Wegen (H4-9, @HT-026): nach erfolgreicher Anmeldung zurück in den Unterpunkt, von dem
 * aus „Anmelden“ gedrückt wurde (`holeRueckkehr`), sonst auf die Startseite.
 */
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { holeRueckkehr } from '../utils/loginRueckkehr';
import { LoginScreen } from './LoginScreen';

export function LoginRoute(): ReactElement {
  const navigate = useNavigate();
  return (
    <LoginScreen
      onSuccess={() => void navigate(holeRueckkehr() ?? '/')}
      onNavigateToRegister={() => void navigate('/register')}
      onBack={() => void navigate(-1)}
      onContinueAsGuest={() => void navigate('/')}
      onNavigateToLegal={(path) => void navigate(path)}
    />
  );
}
