/**
 * SettingRow: eine Zeile der Einstellungen mit Beschriftung, Beschreibung und Bedienelement (aus `MatchCockpitSettingsPanel.tsx`, H4-12).
 */
import { styles } from './settingsPanelStile';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps): React.ReactNode {
  return (
    <div style={styles.row}>
      <div style={styles.rowContent}>
        <span style={styles.rowLabel}>{label}</span>
        {description && <span style={styles.rowDescription}>{description}</span>}
      </div>
      <div style={styles.rowControl}>{children}</div>
    </div>
  );
}
