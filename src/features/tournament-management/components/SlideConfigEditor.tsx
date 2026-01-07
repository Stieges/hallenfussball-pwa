import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { MonitorSlide, SlideConfig, WhenIdleType } from '../../../types/monitor';
import { TournamentField, TournamentGroup } from '../../../types/tournament';

// Constants
const WHEN_IDLE_OPTIONS: { value: WhenIdleType; label: string; description: string }[] = [
    { value: 'next-match', label: 'Nächstes Spiel', description: 'Zeigt das nächste Spiel mit Countdown' },
    { value: 'last-result', label: 'Letztes Ergebnis', description: 'Zeigt das letzte Spielergebnis' },
    { value: 'sponsor', label: 'Sponsor', description: 'Zeigt einen Sponsor-Screen' },
    { value: 'skip', label: 'Überspringen', description: 'Springt zum nächsten Slide' },
];

interface SlideConfigEditorProps {
    slide: MonitorSlide;
    fields: TournamentField[];
    groups: TournamentGroup[];
    sponsors: { id: string; name: string }[];
    onUpdate: (config: Partial<SlideConfig>, duration?: number | null) => void;
    getFieldDisplayName: (id: string) => string;
    styles: Record<string, CSSProperties>;
}

export function SlideConfigEditor({
    slide,
    fields,
    groups,
    sponsors,
    onUpdate,
    getFieldDisplayName,
    styles,
}: SlideConfigEditorProps) {
    const { type, config, duration } = slide;

    const handleConfigChange = (key: keyof SlideConfig, value: SlideConfig[keyof SlideConfig]) => {
        onUpdate({ [key]: value });
    };

    const handleDurationChange = (value: string) => {
        const num = parseInt(value, 10);
        onUpdate({}, isNaN(num) || num <= 0 ? null : num);
    };

    return (
        <div style={styles.slideConfigStyle}>
            {/* Feld-Auswahl für live, schedule-field */}
            {(type === 'live' || type === 'schedule-field') && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle}>Spielfeld</label>
                    <select
                        style={styles.selectStyle}
                        value={config.fieldId ?? ''}
                        onChange={(e) => handleConfigChange('fieldId', e.target.value || undefined)}
                    >
                        <option value="">Bitte wählen...</option>
                        {fields.map(f => (
                            <option key={f.id} value={f.id}>{getFieldDisplayName(f.id)}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* When Idle - nur für Live-Slides */}
            {type === 'live' && (
                <>
                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={styles.labelStyle}>Wenn kein Spiel läuft</label>
                        <select
                            style={styles.selectStyle}
                            value={config.whenIdle?.type ?? 'next-match'}
                            onChange={(e) => handleConfigChange('whenIdle', {
                                type: e.target.value as WhenIdleType,
                                timeoutSeconds: config.whenIdle?.timeoutSeconds ?? 60,
                            })}
                        >
                            {WHEN_IDLE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <span style={{
                            fontSize: cssVars.fontSizes.xs,
                            color: cssVars.colors.textMuted,
                            marginTop: cssVars.spacing.xs,
                        }}>
                            {WHEN_IDLE_OPTIONS.find(o => o.value === (config.whenIdle?.type ?? 'next-match'))?.description}
                        </span>
                    </div>

                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={config.pauseRotationDuringMatch !== false}
                                onChange={(e) => handleConfigChange('pauseRotationDuringMatch', e.target.checked)}
                            />
                            <span style={styles.labelStyle}>Rotation bei laufendem Spiel pausieren</span>
                        </label>
                    </div>
                </>
            )}

            {/* Gruppen-Auswahl für standings, schedule-group */}
            {(type === 'standings' || type === 'schedule-group') && groups.length > 1 && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle}>Gruppe</label>
                    <select
                        style={styles.selectStyle}
                        value={config.groupId ?? ''}
                        onChange={(e) => handleConfigChange('groupId', e.target.value || undefined)}
                    >
                        <option value="">Alle Gruppen</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>
                                {g.customName || `Gruppe ${g.id}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* All Standings - keine spezielle Config, aber Hinweis anzeigen */}
            {type === 'all-standings' && (
                <div style={{ ...styles.inputGroupStyle, padding: cssVars.spacing.sm, background: 'rgba(0,0,0,0.05)', borderRadius: cssVars.borderRadius.sm }}>
                    <span style={styles.labelStyle}>Zeigt Tabellen aller Gruppen in einer Übersicht an.</span>
                </div>
            )}

            {/* Next Matches */}
            {type === 'next-matches' && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle}>Anzahl Spiele</label>
                    <select
                        style={styles.selectStyle}
                        value={config.matchCount ?? 5}
                        onChange={(e) => handleConfigChange('matchCount', Number(e.target.value))}
                    >
                        {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <option key={n} value={n}>{n} Spiele</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Top Scorers */}
            {type === 'top-scorers' && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle}>Anzahl Spieler</label>
                    <select
                        style={styles.selectStyle}
                        value={config.numberOfPlayers ?? 10}
                        onChange={(e) => handleConfigChange('numberOfPlayers', Number(e.target.value))}
                    >
                        {[5, 10, 15, 20].map(n => (
                            <option key={n} value={n}>Top {n}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Sponsor-Auswahl */}
            {type === 'sponsor' && (
                <>
                    <div style={styles.inputGroupStyle}>
                        <label style={styles.labelStyle}>Sponsor</label>
                        <select
                            style={styles.selectStyle}
                            value={config.sponsorId ?? ''}
                            onChange={(e) => handleConfigChange('sponsorId', e.target.value || undefined)}
                        >
                            <option value="">Bitte wählen...</option>
                            {sponsors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={config.showQrCode !== false}
                                onChange={(e) => handleConfigChange('showQrCode', e.target.checked)}
                            />
                            <span style={styles.labelStyle}>QR-Code anzeigen</span>
                        </label>
                    </div>
                </>
            )}

            {/* Custom Text */}
            {type === 'custom-text' && (
                <>
                    <div style={styles.inputGroupStyle}>
                        <label style={styles.labelStyle}>Überschrift</label>
                        <input
                            type="text"
                            style={styles.inputStyle}
                            value={config.headline ?? ''}
                            onChange={(e) => handleConfigChange('headline', e.target.value)}
                            placeholder="z.B. Wichtige Ankündigung"
                        />
                    </div>
                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={styles.labelStyle}>Text</label>
                        <textarea
                            style={{ ...styles.inputStyle, minHeight: '80px', resize: 'vertical' }}
                            value={config.body ?? ''}
                            onChange={(e) => handleConfigChange('body', e.target.value)}
                            placeholder="Dein Text hier..."
                        />
                    </div>
                </>
            )}

            {/* Custom Duration */}
            <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                <label style={styles.labelStyle}>
                    Eigene Dauer (Sek.) - leer = Monitor-Standard
                </label>
                <input
                    type="number"
                    style={{ ...styles.inputStyle, maxWidth: '100px' }}
                    value={duration ?? ''}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    placeholder="Standard"
                    min="1"
                    max="300"
                />
            </div>
        </div>
    );
}
