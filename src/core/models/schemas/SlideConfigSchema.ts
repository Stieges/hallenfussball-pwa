import { z } from 'zod';

// =============================================================================
// SLIDE CONFIG ZOD SCHEMAS
// Runtime validation for monitor slide configurations
// =============================================================================

// --- Shared Enums ---

const SlideTypeSchema = z.enum([
    'live',
    'standings',
    'schedule-field',
    'sponsor',
    'custom-text',
    'all-standings',
    'schedule-group',
    'next-matches',
    'top-scorers',
]);

const WhenIdleTypeSchema = z.enum([
    'next-match',
    'last-result',
    'top-scorers',
    'sponsor',
    'skip',
]);

const QrTargetTypeSchema = z.enum([
    'tournament',
    'sponsor-website',
    'custom',
]);

const ColorSchemeSchema = z.enum(['default', 'highlight', 'urgent', 'celebration']);

const TextAlignSchema = z.enum(['left', 'center', 'right']);

// --- When Idle Config ---

const WhenIdleConfigSchema = z.object({
    type: WhenIdleTypeSchema,
    timeoutSeconds: z.number().int().min(5).max(600).optional(),
});

// --- Slide Config ---

export const SlideConfigSchema = z.object({
    // For: standings, schedule-group
    groupId: z.string().optional(),

    // For: live, schedule-field
    fieldId: z.string().optional(),

    // For: live (when no match is running)
    whenIdle: WhenIdleConfigSchema.optional(),
    pauseRotationDuringMatch: z.boolean().optional(),

    // For: next-matches
    matchCount: z.number().int().min(1).max(10).optional(),

    // For: top-scorers
    numberOfPlayers: z.number().int().min(1).max(20).optional(),

    // For: sponsor
    sponsorId: z.string().optional(),
    showQrCode: z.boolean().optional(),
    qrTarget: QrTargetTypeSchema.optional(),
    customQrUrl: z.string().refine((val) => val === '' || /^https?:\/\//.test(val), {
        message: 'Bitte eine gültige URL eingeben',
    }).optional(),

    // For: custom-text
    headline: z.string().max(100, 'Überschrift darf max. 100 Zeichen lang sein').optional(),
    body: z.string().max(500, 'Text darf max. 500 Zeichen lang sein').optional(),
    textAlign: TextAlignSchema.optional(),
    colorScheme: ColorSchemeSchema.optional(),
});

// --- Monitor Slide ---

export const MonitorSlideSchema = z.object({
    id: z.string(),
    type: SlideTypeSchema,
    config: SlideConfigSchema,
    duration: z.number().int().min(1).max(300).nullable(),
    order: z.number().int().min(0),
});

// --- Validation Helpers ---

export type ValidatedSlideConfig = z.infer<typeof SlideConfigSchema>;
export type ValidatedMonitorSlide = z.infer<typeof MonitorSlideSchema>;

/**
 * Validates a slide config and returns field-level errors.
 * Also checks type-specific required fields.
 */
export function validateSlideConfig(
    type: string,
    config: Record<string, unknown>,
): Record<string, string> {
    const errors: Record<string, string> = {};

    // Base schema validation
    const result = SlideConfigSchema.safeParse(config);
    if (!result.success) {
        for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            if (path) {
                errors[path] = issue.message;
            }
        }
    }

    // Type-specific required field checks
    switch (type) {
        case 'live':
        case 'schedule-field':
            if (!config.fieldId) {
                errors.fieldId = 'Spielfeld ist erforderlich';
            }
            break;
        case 'standings':
        case 'schedule-group':
            // groupId is optional (empty = "all groups")
            break;
        case 'sponsor':
            if (!config.sponsorId) {
                errors.sponsorId = 'Sponsor ist erforderlich';
            }
            break;
        case 'custom-text':
            if (!config.headline || (typeof config.headline === 'string' && config.headline.trim() === '')) {
                errors.headline = 'Überschrift ist erforderlich';
            }
            break;
    }

    return errors;
}

/**
 * Validates a full MonitorSlide.
 */
export function validateMonitorSlide(slide: unknown): {
    success: boolean;
    data?: ValidatedMonitorSlide;
    errors: Record<string, string>;
} {
    const result = MonitorSlideSchema.safeParse(slide);
    if (result.success) {
        const configErrors = validateSlideConfig(result.data.type, result.data.config as Record<string, unknown>);
        if (Object.keys(configErrors).length > 0) {
            return { success: false, errors: configErrors };
        }
        return { success: true, data: result.data, errors: {} };
    }

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (path) {
            errors[path] = issue.message;
        }
    }
    return { success: false, errors };
}
