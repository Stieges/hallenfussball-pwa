/**
 * Prüfstand für die Live-Info eines laufenden Spiels im Spielplan (LiveInfoExpand, G3-N N3, Befund C-LIVEINFO-TASTEN-AUS-DEM-BILD).
 * Im echten Ablauf ist sie nur ohne Rechte erreichbar (Zuschauer-Spielplan, Bearbeiten-Modus); diese Seite rendert die ECHTE Komponente mit
 * allen drei Tasten (Schließen, Spiel beenden und Ergebnis eintragen, Zum Cockpit), Design-Tokens, i18n und Hell/Dunkel über den echten
 * ThemeProvider. `?lang=1` setzt sehr lange Teamnamen (50 Zeichen), `?sprache=en` die englischen Texte. Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { LiveInfoExpand } from '../../../src/components/schedule/MatchExpand/LiveInfoExpand';
import { cssVars } from '../../../src/design-tokens';

const query = new URLSearchParams(window.location.search);
if (query.get('sprache') === 'en') { void i18n.changeLanguage('en'); }
const lang = query.get('lang') === '1';
const noop = (): void => undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <div style={{ padding: cssVars.spacing.md, background: cssVars.colors.background, minHeight: '100vh' }}>
      <div style={{ padding: cssVars.spacing.md, background: cssVars.colors.surface, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg }}>
        <LiveInfoExpand
          homeTeam={{ id: 'a', name: lang ? 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V.' : 'FC Nord' }}
          awayTeam={{ id: 'b', name: lang ? 'Turn- und Sportverein Petting-Oberhausen 1888' : 'SV Süd' }}
          homeScore={1}
          awayScore={0}
          onClose={noop}
          onEndAndEnter={noop}
          onNavigateToCockpit={noop}
        />
      </div>
    </div>
  </ThemeProvider>,
);
