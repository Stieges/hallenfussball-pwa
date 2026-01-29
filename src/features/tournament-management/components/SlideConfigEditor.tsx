import { CSSProperties, useMemo, useId } from 'react';
import { cssVars } from '../../../design-tokens';
import { MonitorSlide, SlideConfig, WhenIdleType, QrTargetType, ColorScheme, COLOR_SCHEMES, DEFAULT_LIVE_COLOR_SCHEME } from '../../../types/monitor';
import type { LiveColorScheme } from '../../../types/monitor';
import { TournamentField, TournamentGroup } from '../../../types/tournament';
import { validateSlideConfig } from '../../../core/models/schemas/SlideConfigSchema';
import { ColorSchemeEditor } from './ColorSchemeEditor';

// =============================================================================
// CONSTANTS
// =============================================================================

const WHEN_IDLE_OPTIONS: { value: WhenIdleType; label: string; description: string }[] = [
    { value: 'next-match', label: 'Nächstes Spiel', description: 'Zeigt das nächste Spiel mit Countdown' },
    { value: 'last-result', label: 'Letztes Ergebnis', description: 'Zeigt das letzte Spielergebnis' },
    { value: 'sponsor', label: 'Sponsor', description: 'Zeigt einen Sponsor-Screen' },
    { value: 'skip', label: 'Überspringen', description: 'Springt zum nächsten Slide' },
];

const QR_TARGET_OPTIONS: { value: QrTargetType; label: string; description: string }[] = [
    { value: 'tournament', label: 'Public View (Turnier)', description: 'Link zur öffentlichen Turnier-Ansicht' },
    { value: 'sponsor-website', label: 'Sponsor-Website', description: 'Link zur Website des Sponsors' },
    { value: 'custom', label: 'Eigene URL', description: 'Beliebige URL eingeben' },
];

const TEXT_ALIGN_OPTIONS: { value: 'left' | 'center' | 'right'; label: string }[] = [
    { value: 'left', label: 'Linksbündig' },
    { value: 'center', label: 'Zentriert' },
    { value: 'right', label: 'Rechtsbündig' },
];

const COLOR_SCHEME_OPTIONS: { value: ColorScheme; label: string; description: string }[] = [
    { value: 'default', label: 'Standard', description: COLOR_SCHEMES.default.description },
    { value: 'highlight', label: 'Hervorgehoben', description: COLOR_SCHEMES.highlight.description },
    { value: 'urgent', label: 'Dringend', description: COLOR_SCHEMES.urgent.description },
    { value: 'celebration', label: 'Feier', description: COLOR_SCHEMES.celebration.description },
];

// =============================================================================
// TYPES
// =============================================================================

interface SlideConfigEditorProps {
    slide: MonitorSlide;
    fields: TournamentField[];
    groups: TournamentGroup[];
    sponsors: { id: string; name: string }[];
    onUpdate: (config: Partial<SlideConfig>, duration?: number | null) => void;
    getFieldDisplayName: (id: string) => string;
    styles: Record<string, CSSProperties>;
    /** Show validation errors. When true, validates on render. */
    showErrors?: boolean;
}

// =============================================================================
// STYLES
// =============================================================================

const errorStyle: CSSProperties = {
    color: cssVars.colors.error,
    fontSize: cssVars.fontSizes.sm,
    marginTop: cssVars.spacing.xs,
};

const requiredMarkerStyle: CSSProperties = {
    color: cssVars.colors.error,
};

const descriptionStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textMuted,
    marginTop: cssVars.spacing.xs,
};

const checkboxLabelStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    cursor: 'pointer',
    minHeight: cssVars.touchTargets.minimum,
};

const infoBoxStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    background: 'rgba(0,0,0,0.05)',
    borderRadius: cssVars.borderRadius.sm,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function SlideConfigEditor({
    slide,
    fields,
    groups,
    sponsors,
    onUpdate,
    getFieldDisplayName,
    styles,
    showErrors = false,
}: SlideConfigEditorProps) {
    const { type, config, duration } = slide;
    const idPrefix = useId();

    // Validate config on each render when showErrors is true
    const errors = useMemo(() => {
        if (!showErrors) {
            return {};
        }
        return validateSlideConfig(type, config as Record<string, unknown>);
    }, [showErrors, type, config]);

    const handleConfigChange = (key: keyof SlideConfig, value: SlideConfig[keyof SlideConfig]) => {
        onUpdate({ [key]: value });
    };

    const handleDurationChange = (value: string) => {
        const num = parseInt(value, 10);
        onUpdate({}, isNaN(num) || num <= 0 ? null : num);
    };

    const getErrorId = (field: string) => `${idPrefix}-${field}-error`;
    const hasError = (field: string) => !!errors[field];

    // WCAG: minHeight for touch targets on all interactive elements
    const accessibleSelectStyle: CSSProperties = {
        ...styles.selectStyle,
        minHeight: cssVars.touchTargets.minimum,
    };

    const accessibleInputStyle: CSSProperties = {
        ...styles.inputStyle,
        minHeight: cssVars.touchTargets.minimum,
    };

    return (
        <div
            style={styles.slideConfigStyle}
            role="group"
            aria-label={`Konfiguration für ${type}-Slide`}
        >
            {/* === Feld-Auswahl für live, schedule-field === */}
            {(type === 'live' || type === 'schedule-field') && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle} htmlFor={`${idPrefix}-fieldId`}>
                        Spielfeld <span style={requiredMarkerStyle}>*</span>
                    </label>
                    <select
                        id={`${idPrefix}-fieldId`}
                        style={{
                            ...accessibleSelectStyle,
                            borderColor: hasError('fieldId') ? cssVars.colors.error : undefined,
                        }}
                        value={config.fieldId ?? ''}
                        onChange={(e) => handleConfigChange('fieldId', e.target.value || undefined)}
                        aria-invalid={hasError('fieldId') || undefined}
                        aria-describedby={hasError('fieldId') ? getErrorId('fieldId') : undefined}
                        aria-required="true"
                    >
                        <option value="">Bitte wählen...</option>
                        {fields.map(f => (
                            <option key={f.id} value={f.id}>{getFieldDisplayName(f.id)}</option>
                        ))}
                    </select>
                    {hasError('fieldId') && (
                        <span id={getErrorId('fieldId')} role="alert" style={errorStyle}>
                            {errors.fieldId}
                        </span>
                    )}
                </div>
            )}

            {/* === When Idle - nur für Live-Slides === */}
            {type === 'live' && (
                <>
                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={styles.labelStyle} htmlFor={`${idPrefix}-whenIdle`}>
                            Wenn kein Spiel läuft
                        </label>
                        <select
                            id={`${idPrefix}-whenIdle`}
                            style={accessibleSelectStyle}
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
                        <span style={descriptionStyle}>
                            {WHEN_IDLE_OPTIONS.find(o => o.value === (config.whenIdle?.type ?? 'next-match'))?.description}
                        </span>
                    </div>

                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={checkboxLabelStyle}>
                            <input
                                type="checkbox"
                                checked={config.pauseRotationDuringMatch !== false}
                                onChange={(e) => handleConfigChange('pauseRotationDuringMatch', e.target.checked)}
                            />
                            <span style={styles.labelStyle}>Rotation bei laufendem Spiel pausieren</span>
                        </label>
                    </div>

                    {/* Score-Farben für Live-Slides */}
                    <ColorSchemeEditor
                        value={config.liveColorScheme ?? DEFAULT_LIVE_COLOR_SCHEME}
                        onChange={(scheme: LiveColorScheme) => handleConfigChange('liveColorScheme', scheme)}
                        styles={styles}
                    />
                </>
            )}

            {/* === Gruppen-Auswahl für standings, schedule-group === */}
            {(type === 'standings' || type === 'schedule-group') && groups.length > 1 && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle} htmlFor={`${idPrefix}-groupId`}>
                        Gruppe
                    </label>
                    <select
                        id={`${idPrefix}-groupId`}
                        style={accessibleSelectStyle}
                        value={config.groupId ?? ''}
                        onChange={(e) => handleConfigChange('groupId', e.target.value || undefined)}
                    >
                        <option value="">Alle Gruppen</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>
                                {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty customName should use fallback */}
                                {g.customName || `Gruppe ${g.id}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* === All Standings - Info-Hinweis === */}
            {type === 'all-standings' && (
                <div style={{ ...styles.inputGroupStyle, ...infoBoxStyle }}>
                    <span style={styles.labelStyle}>Zeigt Tabellen aller Gruppen in einer Übersicht an.</span>
                </div>
            )}

            {/* === Next Matches === */}
            {type === 'next-matches' && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle} htmlFor={`${idPrefix}-matchCount`}>
                        Anzahl Spiele
                    </label>
                    <select
                        id={`${idPrefix}-matchCount`}
                        style={accessibleSelectStyle}
                        value={config.matchCount ?? 5}
                        onChange={(e) => handleConfigChange('matchCount', Number(e.target.value))}
                    >
                        {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <option key={n} value={n}>{n} Spiele</option>
                        ))}
                    </select>
                </div>
            )}

            {/* === Top Scorers === */}
            {type === 'top-scorers' && (
                <div style={styles.inputGroupStyle}>
                    <label style={styles.labelStyle} htmlFor={`${idPrefix}-numberOfPlayers`}>
                        Anzahl Spieler
                    </label>
                    <select
                        id={`${idPrefix}-numberOfPlayers`}
                        style={accessibleSelectStyle}
                        value={config.numberOfPlayers ?? 10}
                        onChange={(e) => handleConfigChange('numberOfPlayers', Number(e.target.value))}
                    >
                        {[5, 10, 15, 20].map(n => (
                            <option key={n} value={n}>Top {n}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* === Sponsor-Auswahl === */}
            {type === 'sponsor' && (
                <>
                    <div style={styles.inputGroupStyle}>
                        <label style={styles.labelStyle} htmlFor={`${idPrefix}-sponsorId`}>
                            Sponsor <span style={requiredMarkerStyle}>*</span>
                        </label>
                        <select
                            id={`${idPrefix}-sponsorId`}
                            style={{
                                ...accessibleSelectStyle,
                                borderColor: hasError('sponsorId') ? cssVars.colors.error : undefined,
                            }}
                            value={config.sponsorId ?? ''}
                            onChange={(e) => handleConfigChange('sponsorId', e.target.value || undefined)}
                            aria-invalid={hasError('sponsorId') || undefined}
                            aria-describedby={hasError('sponsorId') ? getErrorId('sponsorId') : undefined}
                            aria-required="true"
                        >
                            <option value="">Bitte wählen...</option>
                            {sponsors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {hasError('sponsorId') && (
                            <span id={getErrorId('sponsorId')} role="alert" style={errorStyle}>
                                {errors.sponsorId}
                            </span>
                        )}
                    </div>

                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={checkboxLabelStyle}>
                            <input
                                type="checkbox"
                                checked={config.showQrCode !== false}
                                onChange={(e) => handleConfigChange('showQrCode', e.target.checked)}
                            />
                            <span style={styles.labelStyle}>QR-Code anzeigen</span>
                        </label>
                    </div>

                    {/* QR-Code Ziel - nur sichtbar wenn QR-Code aktiviert */}
                    {config.showQrCode !== false && (
                        <>
                            <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                                <label style={styles.labelStyle} htmlFor={`${idPrefix}-qrTarget`}>
                                    QR-Code Ziel
                                </label>
                                <select
                                    id={`${idPrefix}-qrTarget`}
                                    style={accessibleSelectStyle}
                                    value={config.qrTarget ?? 'tournament'}
                                    onChange={(e) => handleConfigChange('qrTarget', e.target.value as QrTargetType)}
                                >
                                    {QR_TARGET_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <span style={descriptionStyle}>
                                    {QR_TARGET_OPTIONS.find(o => o.value === (config.qrTarget ?? 'tournament'))?.description}
                                </span>
                            </div>

                            {/* Custom URL Input - nur sichtbar wenn qrTarget = 'custom' */}
                            {config.qrTarget === 'custom' && (
                                <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                                    <label style={styles.labelStyle} htmlFor={`${idPrefix}-customQrUrl`}>
                                        Eigene URL
                                    </label>
                                    <input
                                        id={`${idPrefix}-customQrUrl`}
                                        type="url"
                                        style={{
                                            ...accessibleInputStyle,
                                            borderColor: hasError('customQrUrl') ? cssVars.colors.error : undefined,
                                        }}
                                        value={config.customQrUrl ?? ''}
                                        onChange={(e) => handleConfigChange('customQrUrl', e.target.value)}
                                        placeholder="https://..."
                                        aria-invalid={hasError('customQrUrl') || undefined}
                                        aria-describedby={hasError('customQrUrl') ? getErrorId('customQrUrl') : undefined}
                                    />
                                    {hasError('customQrUrl') && (
                                        <span id={getErrorId('customQrUrl')} role="alert" style={errorStyle}>
                                            {errors.customQrUrl}
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* === Custom Text === */}
            {type === 'custom-text' && (
                <>
                    <div style={styles.inputGroupStyle}>
                        <label style={styles.labelStyle} htmlFor={`${idPrefix}-headline`}>
                            Überschrift <span style={requiredMarkerStyle}>*</span>
                        </label>
                        <input
                            id={`${idPrefix}-headline`}
                            type="text"
                            style={{
                                ...accessibleInputStyle,
                                borderColor: hasError('headline') ? cssVars.colors.error : undefined,
                            }}
                            value={config.headline ?? ''}
                            onChange={(e) => handleConfigChange('headline', e.target.value)}
                            placeholder="z.B. Wichtige Ankündigung"
                            maxLength={100}
                            aria-invalid={hasError('headline') || undefined}
                            aria-describedby={hasError('headline') ? getErrorId('headline') : undefined}
                            aria-required="true"
                        />
                        {hasError('headline') && (
                            <span id={getErrorId('headline')} role="alert" style={errorStyle}>
                                {errors.headline}
                            </span>
                        )}
                    </div>
                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={styles.labelStyle} htmlFor={`${idPrefix}-body`}>
                            Text
                        </label>
                        <textarea
                            id={`${idPrefix}-body`}
                            style={{
                                ...accessibleInputStyle,
                                minHeight: '80px',
                                resize: 'vertical',
                                borderColor: hasError('body') ? cssVars.colors.error : undefined,
                            }}
                            value={config.body ?? ''}
                            onChange={(e) => handleConfigChange('body', e.target.value)}
                            placeholder="Dein Text hier..."
                            maxLength={500}
                            aria-invalid={hasError('body') || undefined}
                            aria-describedby={hasError('body') ? getErrorId('body') : undefined}
                        />
                        {hasError('body') && (
                            <span id={getErrorId('body')} role="alert" style={errorStyle}>
                                {errors.body}
                            </span>
                        )}
                    </div>

                    {/* Textausrichtung */}
                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={styles.labelStyle} htmlFor={`${idPrefix}-textAlign`}>
                            Textausrichtung
                        </label>
                        <select
                            id={`${idPrefix}-textAlign`}
                            style={accessibleSelectStyle}
                            value={config.textAlign ?? 'center'}
                            onChange={(e) => handleConfigChange('textAlign', e.target.value as SlideConfig['textAlign'])}
                        >
                            {TEXT_ALIGN_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Farbschema */}
                    <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                        <label style={styles.labelStyle} htmlFor={`${idPrefix}-colorScheme`}>
                            Farbschema
                        </label>
                        <select
                            id={`${idPrefix}-colorScheme`}
                            style={accessibleSelectStyle}
                            value={config.colorScheme ?? 'default'}
                            onChange={(e) => handleConfigChange('colorScheme', e.target.value as ColorScheme)}
                        >
                            {COLOR_SCHEME_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <span style={descriptionStyle}>
                            {COLOR_SCHEME_OPTIONS.find(o => o.value === (config.colorScheme ?? 'default'))?.description}
                        </span>
                    </div>
                </>
            )}

            {/* === Custom Duration === */}
            <div style={{ ...styles.inputGroupStyle, marginTop: cssVars.spacing.sm }}>
                <label style={styles.labelStyle} htmlFor={`${idPrefix}-duration`}>
                    Eigene Dauer (Sek.) - leer = Monitor-Standard
                </label>
                <input
                    id={`${idPrefix}-duration`}
                    type="number"
                    style={{ ...accessibleInputStyle, maxWidth: '100px' }}
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
