
import type { ImageSpec, ImageLayout, Viewpoint, Whitespace, ImageTextPolicy } from '../types.ts';

/**
 * Prepares an ImageSpec for saving by sanitizing, validating, and formatting it.
 * Centralizes the logic used in multiple places.
 */
export function prepareSpecForSave(
    spec: ImageSpec,
    gradeLevel: string,
    subject: string
): { imageSpec: ImageSpec; renderedImagePrompt: string } {
    const { spec: normalizedSpec, warnings } = normalizeImageSpec(spec, gradeLevel);

    // Log warnings if any
    if (warnings.length > 0) {
        console.warn("Spec validation warnings:", warnings);
    }

    // Format the normalized spec into a prompt
    const rendered = formatImageSpec(normalizedSpec, { gradeLevel, subject });

    return {
        imageSpec: normalizedSpec,
        renderedImagePrompt: rendered
    };
}

/**
 * Validates an ImageSpec object at runtime.
 * Returns an array of error messages. Empty array means valid.
 */
export function validateImageSpec(spec: ImageSpec): string[] {
    const errors: string[] = [];

    if (!spec) {
        return ['ImageSpec is null or undefined'];
    }

    // Required Fields
    if (!spec.primaryFocal || typeof spec.primaryFocal !== 'string' || spec.primaryFocal.trim() === '') {
        errors.push('imageSpec.primaryFocal is required');
    }

    if (!spec.conceptualPurpose || typeof spec.conceptualPurpose !== 'string' || spec.conceptualPurpose.trim() === '') {
        errors.push('imageSpec.conceptualPurpose is required');
    }

    // Array Length Checks
    if (!Array.isArray(spec.subjects) || spec.subjects.length < 2 || spec.subjects.length > 5) {
        errors.push('imageSpec.subjects must have 2–5 items');
    }

    if (!Array.isArray(spec.mustInclude) || spec.mustInclude.length < 2 || spec.mustInclude.length > 6) {
        errors.push('imageSpec.mustInclude must have 2–6 items');
    }

    if (!Array.isArray(spec.avoid) || spec.avoid.length < 2) {
        errors.push('imageSpec.avoid must have at least 2 items');
    }

    // COMPOSITION
    if (!spec.composition) {
        errors.push('imageSpec.composition is required');
    } else {
        const validLayouts: ImageLayout[] = [
            'single-focal-subject-centered',
            'balanced-pair',
            'simple-sequence-2-panel',
            'comparison-split-screen',
            'diagram-with-flow'
        ];
        const validViewpoints: Viewpoint[] = [
            'front',
            'three-quarter',
            'side',
            'overhead',
            'child-eye-level',
            'side-profile',
            'isometric-3d-cutaway'
        ];
        const validWhitespaces: Whitespace[] = ['generous', 'moderate'];

        if (!validLayouts.includes(spec.composition.layout)) {
            errors.push(`Invalid layout: ${spec.composition.layout}`);
        }
        if (spec.composition.viewpoint && !validViewpoints.includes(spec.composition.viewpoint)) {
            errors.push(`Invalid viewpoint: ${spec.composition.viewpoint}`);
        }
        if (!validWhitespaces.includes(spec.composition.whitespace)) {
            errors.push(`Invalid whitespace: ${spec.composition.whitespace}`);
        }
    }

    // TEXT POLICY
    if (spec.textPolicy) {
        const validPolicies: ImageTextPolicy[] = ['NO_LABELS', 'LIMITED_LABELS_1_TO_3'];
        if (!validPolicies.includes(spec.textPolicy)) {
            errors.push(`Invalid textPolicy: ${spec.textPolicy}`);
        }

        // CONSISTENT VALIDATION WITH SANITIZATION
        if (spec.textPolicy === 'LIMITED_LABELS_1_TO_3') {
            const hasLabels = spec.allowedLabels && Array.isArray(spec.allowedLabels) && spec.allowedLabels.length > 0;
            if (!hasLabels) {
                errors.push('LIMITED_LABELS_1_TO_3 requires at least 1 allowedLabel');
            }
        }
        if (spec.textPolicy === 'NO_LABELS') {
            const hasLabels = spec.allowedLabels && Array.isArray(spec.allowedLabels) && spec.allowedLabels.length > 0;
            if (hasLabels) {
                errors.push('NO_LABELS must not have allowedLabels');
            }
        }

    } else {
        errors.push('imageSpec.textPolicy is required');
    }

    return errors;
}

/**
 * Helper to parse grade level strings into a numeric approximation.
 * Handles "2nd", "5th Grade", "Kindergarten", etc.
 */
export function parseGradeLevel(gradeLevel: string): number {
    if (!gradeLevel) return 3; // Default to 3rd grade if missing

    const lower = gradeLevel.toLowerCase();

    // Direct number match
    const match = lower.match(/(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }

    // Common text formats
    const map: Record<string, number> = {
        'k': 0, 'kindergarten': 0, 'pre-k': -1, 'pk': -1,
        'first': 1, 'second': 2, 'third': 3, 'fourth': 4,
        'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8,
        'ninth': 9, 'tenth': 10, 'eleventh': 11, 'twelfth': 12,
        'freshman': 9, 'sophomore': 10, 'junior': 11, 'senior': 12
    };

    // Check for keys in string
    for (const key of Object.keys(map)) {
        if (lower.includes(key)) return map[key];
    }

    return 3; // Default fallback
}

/**
 * Sanitizes an ImageSpec, ensuring all arrays are clamped and defaults are set.
 * This should be called before formatting.
 */
export function sanitizeImageSpec(spec: ImageSpec, gradeLevel: string): ImageSpec {
    // Compatibility Check: Handle Null/Undefined input gracefully
    if (!spec) {
        return {
            primaryFocal: 'Visual representation of the concept',
            conceptualPurpose: 'Visual aid for the requested topic',
            subjects: ['key subject'],
            mustInclude: ['clear visuals'],
            avoid: ['text', 'blur'],
            composition: {
                layout: 'single-focal-subject-centered',
                viewpoint: 'front',
                whitespace: 'generous'
            },
            textPolicy: 'NO_LABELS',
            colors: [],
            negativePrompt: [],
            actions: [],
            allowedLabels: []
        };
    }

    // Shallow clone + data repair
    const clone: ImageSpec = { ...spec };

    // Backfill conceptualPurpose
    if (!clone.conceptualPurpose || typeof clone.conceptualPurpose !== 'string' || clone.conceptualPurpose.trim() === '') {
        // Fallback: use primary focal as the base, or a generic purpose
        clone.conceptualPurpose = clone.primaryFocal
            ? `Help students visualize: ${clone.primaryFocal}`
            : 'Provide a clear visual aid for this concept';
    }

    // 3. Clamp Arrays
    clone.subjects = [...(spec.subjects || [])].filter(s => s && typeof s === 'string').slice(0, 5);
    clone.mustInclude = [...(spec.mustInclude || [])].filter(s => s && typeof s === 'string').slice(0, 6);
    clone.avoid = [...(spec.avoid || [])].filter(s => s && typeof s === 'string').slice(0, 10);
    clone.actions = spec.actions ? [...spec.actions].filter(s => s && typeof s === 'string').slice(0, 3) : [];
    clone.colors = spec.colors ? [...spec.colors].filter(s => s && typeof s === 'string').slice(0, 5) : [];
    clone.negativePrompt = spec.negativePrompt ? [...spec.negativePrompt].filter(s => s && typeof s === 'string').slice(0, 10) : [];
    clone.allowedLabels = spec.allowedLabels ? [...spec.allowedLabels].filter(s => s && typeof s === 'string').slice(0, 3) : [];

    // 4. Composition Defaults
    clone.composition = spec.composition ? { ...spec.composition } : {
        layout: 'single-focal-subject-centered',
        viewpoint: undefined as any,
        whitespace: 'generous'
    };

    if (!clone.composition.layout) clone.composition.layout = 'single-focal-subject-centered';
    if (!clone.composition.whitespace) clone.composition.whitespace = 'generous';

    // Smart Viewpoint Default
    const gradeNum = parseGradeLevel(gradeLevel);
    if (!clone.composition.viewpoint) {
        // Younger kids (K-2) benefit from simple eye-level views. Older -> Front/Isom/Side.
        // Defaulting to 'front' for 3+ ensures clarity.
        clone.composition.viewpoint = gradeNum <= 2 ? 'child-eye-level' : 'front';
    }

    // 5. Text Policy Defaults & strict enforcement
    if (!clone.textPolicy) {
        clone.textPolicy = 'NO_LABELS';
    }

    // SANITIZE LABELS FIRST
    // Trim, dedupe, and filter valid labels immediately
    let cleanLabels = (spec.allowedLabels || [])
        .map(l => l ? String(l).trim() : '')
        .filter(l => l.length > 0 && l.length < 30) // Cap length to avoid prose
        .slice(0, 3); // Hard cap at 3

    // Deduplicate
    cleanLabels = [...new Set(cleanLabels)];
    clone.allowedLabels = cleanLabels;

    // STRICT CONTRACT ENFORCEMENT:
    // If LIMITED_LABELS_1_TO_3 is selected but no labels are provided (after clamping),
    // automatically coerce to NO_LABELS to avoid hallucinated/gibberish text.
    if (clone.textPolicy === 'LIMITED_LABELS_1_TO_3' && clone.allowedLabels.length === 0) {
        clone.textPolicy = 'NO_LABELS';
    }

    // If NO_LABELS, ensure allowedLabels is strictly empty
    if (clone.textPolicy === 'NO_LABELS') {
        clone.allowedLabels = [];
    }

    // 6. Color Defaults (if empty)
    if (clone.colors.length === 0) {
        clone.colors = ['#1976D2', '#388E3C', '#F57C00']; // Simple primary-ish defaults
    }

    // 7. Negative Prompt Defaults (if empty)
    if (clone.negativePrompt.length === 0) {
        clone.negativePrompt = [
            'misspelled text',
            'gibberish',
            'confusing details',
            'watermarks',
            'blurry'
        ];
    }

    return clone;
}



/**
 * Normalizes an ImageSpec by sanitizing and validating it.
 * Returns the normalized spec along with any validation warnings.
 * This is the single entry point for spec normalization.
 */
export function normalizeImageSpec(
    spec: ImageSpec,
    gradeLevel: string
): {
    spec: ImageSpec;
    warnings: string[];
} {
    // Sanitize first (clamps arrays, fills defaults, enforces contracts)
    const sanitized = sanitizeImageSpec(spec, gradeLevel);

    // Validate the sanitized spec
    const errors = validateImageSpec(sanitized);

    // Return sanitized spec with any validation warnings
    return {
        spec: sanitized,
        warnings: errors,
    };
}

interface FormatContext {
    gradeLevel: string;
    subject: string;
}

/**
 * Helper functions for formatting ImageSpec prompt sections
 */

function formatHeaderSection(ctx: FormatContext): string {
    return `EDUCATIONAL VISUAL AID PROMPT
${'='.repeat(40)}

CONTEXT:
- Grade Level: ${ctx.gradeLevel}
- Subject: ${ctx.subject}`;
}

function formatTeachingPurposeSection(conceptualPurpose?: string): string {
    return `
TEACHING PURPOSE (Why this matters):
${conceptualPurpose || 'Provide a visual aid for the concept.'}`;
}

function formatPrimaryVisualConceptSection(primaryFocal: string): string {
    return `
PRIMARY VISUAL CONCEPT:
${primaryFocal}`;
}

function formatVisualElementsSection(subjects: string[]): string {
    return `
VISUAL ELEMENTS (Concrete objects):
${subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

function formatActionsSection(actions: string[]): string {
    if (actions.length === 0) return '';
    return `
ACTIONS / INTERACTIONS:
${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}
`;
}

function formatMustIncludeSection(mustInclude: string[]): string {
    return `
MUST INCLUDE (Critical details):
${mustInclude.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
}

function formatCompositionSection(composition: ImageSpec['composition']): string {
    return `
COMPOSITION & LAYOUT:
- Layout: ${composition.layout}
- Viewpoint: ${composition.viewpoint}
- Whitespace: ${composition.whitespace} (keep clean for text overlay)
- Background: Minimal/Plain (standard educational style)`;
}

function formatTextPolicySection(
    textPolicy: ImageTextPolicy,
    allowedLabels: string[],
    isNoLabels: boolean
): string {
    const section = `
TEXT POLICY:`;

    if (isNoLabels) {
        return `${section}
- STRICTLY NO TEXT: No letters, numbers, labels, legends, or watermarks anywhere in the image.`;
    } else {
        return `${section}
- Include ONLY these labels: ${allowedLabels.join(', ')}.
- Use large, legible font.`;
    }
}

function formatColorsSection(colors: string[]): string {
    const section = `
COLORS (Semantic & High Contrast):`;

    if (colors.length > 0) {
        return `${section}
- Use this palette: ${colors.join(', ')}`;
    } else {
        return `${section}
- Use high-contrast primary colors suitable for classroom projection.`;
    }
}

function formatAvoidSection(avoid: string[]): string {
    return `
AVOID (Distractions):
${avoid.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
}

function formatNegativePromptSection(finalNegativePrompt: string[]): string {
    return `
NEGATIVE PROMPT (Prevent these errors):
${finalNegativePrompt.join(', ')}`;
}

function formatStyleToneSection(): string {
    return `
STYLE & TONE:
- Educational illustration, suitable for textbooks or classroom slides.
- Prioritize CLARITY over decorative flair.
- Use clean lines and distinct shapes.`;
}

/**
 * Deterministically formats an ImageSpec into a prompt string for Gemini.
 */
export function formatImageSpec(spec: ImageSpec, ctx: FormatContext): string {
    const {
        primaryFocal,
        conceptualPurpose,
        subjects,
        actions = [],
        mustInclude,
        avoid,
        composition,
        textPolicy,
        allowedLabels = [],
        colors = [],
        negativePrompt = [],
    } = spec;

    // Detect if we need strong text suppression
    const effectivePolicy = (textPolicy === 'LIMITED_LABELS_1_TO_3' && (!allowedLabels || allowedLabels.length === 0))
        ? 'NO_LABELS'
        : textPolicy;

    const isNoLabels = effectivePolicy === 'NO_LABELS';

    // Build negative prompt with text suppression logic
    const textSuppressionTerms = [
        'text', 'labels', 'words', 'lettering', 'typography',
        'annotations', 'watermark', 'signature', 'caption', 'numbers', 'legends'
    ];

    let finalNegativePrompt: string[];
    if (isNoLabels) {
        finalNegativePrompt = [...new Set([...negativePrompt, ...textSuppressionTerms])];
    } else {
        finalNegativePrompt = negativePrompt.filter(term => !textSuppressionTerms.includes(term.toLowerCase()));
    }

    // Build prompt sections
    const sections = [
        formatHeaderSection(ctx),
        formatTeachingPurposeSection(conceptualPurpose),
        formatPrimaryVisualConceptSection(primaryFocal),
        formatVisualElementsSection(subjects),
        formatActionsSection(actions),
        formatMustIncludeSection(mustInclude),
        formatCompositionSection(composition),
        formatTextPolicySection(textPolicy, allowedLabels, isNoLabels),
        formatColorsSection(colors),
        formatAvoidSection(avoid),
        formatNegativePromptSection(finalNegativePrompt),
        formatStyleToneSection(),
    ];

    return sections.filter(section => section.trim().length > 0).join('\n');
}

// Helper Types for UI Summary
export interface VisualIdeaSummary {
    title: string;
    subtitle: string;
    elements: string;
}

/**
 * Returns a user-friendly summary of the visual idea.
 * Used to display a clean UI instead of the raw prompt.
 */
export function getVisualIdeaSummary(spec: ImageSpec): VisualIdeaSummary {
    if (!spec) {
        return {
            title: 'No Visual Idea',
            subtitle: 'Create a new idea to get started.',
            elements: ''
        };
    }

    const { primaryFocal, conceptualPurpose, subjects = [] } = spec;

    // Truncate subjects if there are too many
    const displaySubjects = subjects.slice(0, 3);
    const remaining = subjects.length - 3;
    const elementsStr = displaySubjects.join(', ') + (remaining > 0 ? `... (+${remaining} more)` : '');

    return {
        title: primaryFocal || 'Visual Concept',
        subtitle: conceptualPurpose || 'Visual aid',
        elements: elementsStr
    };
}

