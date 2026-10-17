/**
 * Prüfstand für die Abmelde-Warnung (DA-2a): Der Dialog ist nur mit angemeldetem Konto und wartenden Einträgen erreichbar,
 * beides gibt es in der Offline-E2E-Umgebung nicht. Diese Seite rendert den echten Dialog (echte Komponente, echte
 * Design-Tokens, echte i18n, Hell/Dunkel über den echten ThemeProvider) und meldet die Tastenwirkung in `window.__logoutProbe`. Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { LogoutWarningDialog } from '../../../src/features/collaboration/outbox/LogoutWarningDialog';

declare global {
  interface Window {
    __logoutProbe: { cancel: number; confirm: number };
  }
}

window.__logoutProbe = { cancel: 0, confirm: 0 };
const count = Number(new URLSearchParams(window.location.search).get('count') ?? '3');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <LogoutWarningDialog
      isOpen
      count={count}
      onCancel={() => { window.__logoutProbe.cancel += 1; }}
      onConfirm={() => { window.__logoutProbe.confirm += 1; }}
    />
  </ThemeProvider>,
);
