/**
 * Prüfstand @EK-032 (Regel T2-UI): der Korrekturdialog im Zustand „abgelehnt“ -- Olli hat Spiel 7 inzwischen auf 2:2 geändert, der Dialog
 * bleibt offen, zeigt den Hinweis mit Namen und 2:2 als bisher. ECHTE Komponente, echte Design-Tokens, i18n, Hell/Dunkel über den echten
 * ThemeProvider. Adresse: `?name=` (leer = ohne Namen), `&sprache=en`, `&lang=1` (lange Teamnamen). Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { CockpitKorrekturDialog } from '../../../src/features/tournament-management/components/CockpitKorrekturDialog';

const query = new URLSearchParams(window.location.search);
const name = query.get('name') ?? 'Olli';
const lang = query.get('lang') === '1';
const en = query.get('sprache') === 'en';
void i18n.changeLanguage(en ? 'en' : 'de');
const home = lang ? 'Sportgemeinschaft Rot-Weiß Musterstadt Nord 1904 I' : 'FC Nord';
const away = lang ? 'Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921' : 'SV Süd';
const hinweis = en ? `Match 7 has since been changed by ${name} (now 2:2)` : `Spiel 7 wurde inzwischen von ${name} geändert (jetzt 2:2)`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <CockpitKorrekturDialog matchNumber={7} homeName={home} awayName={away} scoreHome={2} scoreAway={2} staleHint={hinweis} onWeiter={() => undefined} onAbbrechen={() => undefined} />
  </ThemeProvider>,
);
