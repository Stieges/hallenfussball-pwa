/**
 * Prüfstand für die Hinweise, die es erst mit „Hinweise tragen die Taste“ gibt (@OB-087 Zeilen 6 und 7): `PublishErrorNotice` (Vorschau des Assistenten) und
 * `VisibilityErrorNotice` (Sichtbarkeit). Nur Testumgebung. Aufruf: `?fall=veroeffentlichen|sichtbarkeit` (+ `&lang=en`, `&laeuft=1` für den laufenden Versuch).
 * `hin.erneut` zählt die Tipps auf „Erneut versuchen“.
 */
import ReactDOM from 'react-dom/client';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { PublishErrorNotice } from '../../../src/features/tournament-creation/components/PublishErrorNotice';
import { VisibilityErrorNotice } from '../../../src/features/tournament-admin/categories/Visibility/VisibilityErrorNotice';

const hin = { erneut: 0 };
(window as unknown as { __hinweise: typeof hin }).__hinweise = hin;

const query = new URLSearchParams(window.location.search);
if (query.get('lang') === 'en') { void i18n.changeLanguage('en'); }
const fall = query.get('fall') ?? 'veroeffentlichen';
const laeuft = query.get('laeuft') === '1';
const erneut = (): void => { hin.erneut += 1; };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <div style={{ minHeight: '100vh', padding: cssVars.spacing.md, background: cssVars.colors.background }}>
      {fall === 'sichtbarkeit'
        ? <VisibilityErrorNotice message="Failed to fetch" onRetry={erneut} retrying={laeuft} />
        : <PublishErrorNotice title="Turnier konnte nicht veröffentlicht werden" message="Speichern fehlgeschlagen: Server nicht erreichbar" closeLabel="Schließen" onRetry={erneut} onClose={() => undefined} retrying={laeuft} />}
    </div>
  </ThemeProvider>,
);
