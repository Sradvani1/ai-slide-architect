import type { ImageSpec, ImageTextPolicy } from '../types';

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
    _textPolicy: ImageTextPolicy,
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
