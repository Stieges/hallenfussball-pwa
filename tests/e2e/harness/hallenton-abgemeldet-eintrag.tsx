/**
 * Prüfstand für H4-11b (@HT-057, @HT-012): der Eintrag „Feld 1: als Hallen-Lautsprecher abgemeldet“ der Statuszeile in einer Ansicht der Verwaltung (Kopf, mit echter Seitenleiste) und in einer Ansicht ohne Kopf
 * (der Streifen). Die echte `HallStatusZeileAnsicht` mit echtem Eintragsbau; die Seite darum ist ein Platzhalter (die Köpfe selbst haben Vitest-Tests). Das Cockpit hat seinen Fall im Prüfstand `cockpit-hallenton`.
 * Aufruf: `?ansicht=verwaltung|ohne` (`&lang=en`). Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { AdminSidebar } from '../../../src/features/tournament-admin/components/AdminSidebar';
import { CategoryPage } from '../../../src/features/tournament-admin/categories/shared';
import { HallStatusZeileAnsicht } from '../../../src/features/hallenton/ui/HallStatusZeile';
import { hallAnzeige } from '../../../src/features/hallenton/hallAnzeige';

const params = new URLSearchParams(window.location.search);
if (params.get('lang') === 'en') { void i18n.changeLanguage('en'); }
const aus = () => undefined;
const anzeige = hallAnzeige({ server: { stand: 'aktuell', felder: {}, antwort: null }, lokal: null, angepfiffen: new Set(), lautsprecherBekannt: false });

export function Seite() {
  const verwaltung = params.get('ansicht') !== 'ohne';
  const breit = window.innerWidth >= 768;
  const zeile = (
    <HallStatusZeileAnsicht
      anzeige={anzeige} tournamentId="hallencup-sued" tonAktivieren={aus} abgemeldet={[1]}
      data-testid={verwaltung ? 'hallenton-status-zeile' : 'hallenton-geraet-streifen'}
    />
  );
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
      {verwaltung && breit ? <AdminSidebar activeCategory="team-helpers" onNavigate={aus} onBackToTournament={aus} /> : null}
      <main style={{ flex: 1, minWidth: 0 }}>
        {zeile}
        <div style={{ padding: breit ? cssVars.spacing.lg : cssVars.spacing.md, maxWidth: 800 }} data-testid="hallenton-seite">
          <CategoryPage icon={verwaltung ? '👥' : '📊'} title={verwaltung ? 'Team & Helfer' : 'Dashboard'} description={verwaltung ? 'Hallencup Süd' : 'Meine Turniere'}>
            <p>{verwaltung ? 'Ansicht der Verwaltung mit Kopf: die Statuszeile steht unter dem Kopf.' : 'Ansicht ohne Kopf: der Streifen steht oben.'}</p>
          </CategoryPage>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><ThemeProvider><Seite /></ThemeProvider></HashRouter>);
