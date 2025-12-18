import type { ImageSpec } from '../types';

interface FormatContext {
    gradeLevel: string;
    subject: string;
}

// --- Narrative Building Helpers ---

function buildSubjectNarrative(spec: ImageSpec): string {
    if (spec.subjects && spec.subjects.length > 0) {
        // Natural integration: "A [primaryFocal] with [subjects]"
        return `A ${spec.primaryFocal} with ${spec.subjects.join(', ')}`;
    }
    return `A ${spec.primaryFocal}`;
}

function buildActionNarrative(spec: ImageSpec): string {
    if (!spec.visualizationDynamics || spec.visualizationDynamics.length === 0) return '';

    // Use present participle formatting ensuring proper grammar
    const actions = spec.visualizationDynamics.map(v => {
        const lower = v.toLowerCase();
        // If already ends in 'ing', use as-is
        if (lower.endsWith('ing')) return v;

        // Handle common verb endings
        if (lower.endsWith('e')) return v.slice(0, -1) + 'ing'; // "evaporate" -> "evaporating"

        // Simple default add 'ing' - heuristic, not perfect but better than nothing
        return v + 'ing';
    }).join(' and ');

    return actions;
}

function buildLocationNarrative(spec: ImageSpec): string {
    const parts = [];
    if (spec.environment) parts.push(spec.environment);
    if (spec.contextualDetails && spec.contextualDetails.length > 0) {
        parts.push(spec.contextualDetails.join(', '));
    }
    return parts.length > 0 ? parts.join(' with ') : '';
}

function buildLightingNarrative(spec: ImageSpec, gradeLevel: string): string {
    if (!spec.lighting) return '';
    const l = spec.lighting;
    const parts = [];

    // Check for explicit elementary indicators using regex to avoid partial matches (e.g. "10th" matching "1")
    const lower = gradeLevel.toLowerCase();
    const gradeMatch = lower.match(/(\d+)(?:st|nd|rd|th)?\s*grade/);
    let isElementary = false;

    if (gradeMatch) {
        const gradeNum = parseInt(gradeMatch[1], 10);
        if (gradeNum >= 1 && gradeNum <= 5) {
            isElementary = true;
        }
    } else {
        // Fallback for non-numeric grade strings
        isElementary = lower.includes('kindergarten') ||
            lower.includes('preschool') ||
            lower.includes('pre-k') ||
            lower.includes('elementary') ||
            lower.includes('primary');
    }

    if (l.quality && l.direction) {
        parts.push(`${l.quality} ${l.direction} lighting`);
    } else if (l.quality) {
        parts.push(`${l.quality} lighting`);
    } else if (l.direction) {
        parts.push(`${l.direction} lighting`);
    }

    if (l.colorTemperature && !isElementary) {
        parts.push(`${l.colorTemperature} color temperature`);
    }

    if (l.mood) {
        parts.push(`creating a ${l.mood} atmosphere`);
    }

    return parts.length > 0 ? `Illuminated by ${parts.join(', ')}.` : '';
}

// --- Technical Section Formatters ---

function formatCompositionSection(spec: ImageSpec): string {
    const c = spec.composition;
    let description = `${c.viewpoint.replace(/-/g, ' ')} shot`;

    if (c.layout !== 'single-focal-subject-centered') {
        description += `, ${c.layout.replace(/-/g, ' ')} composition`;
    }

    if (c.whitespace === 'generous') {
        description += ', generous negative space for text overlay';
    }

    if (c.depthOfField) {
        description += `, ${c.depthOfField} depth of field`;
        if (c.depthOfField === 'shallow') description += ' (f/1.8)';
    }

    if (c.framingRationale) {
        description += `. ${c.framingRationale}`;
    }

    return `COMPOSITION & CAMERA ANGLE:
${description}.`;
}

function formatTextPolicySection(spec: ImageSpec): string {
    const policy = spec.textPolicy;
    const labels = spec.allowedLabels ? spec.allowedLabels.join(', ') : 'None';
    const placement = spec.labelPlacement || 'clearly legible';
    const font = spec.labelFont || 'standard educational sans-serif';

    let section = `TEXT POLICY:`;

    if (policy === 'NO_LABELS') {
        return `${section}
Strictly NO TEXT: No letters, numbers, labels, legends, or watermarks anywhere in the image.`;
    }

    if (policy === 'LIMITED_LABELS_1_TO_3') {
        return `${section}
Include ONLY these labels: ${labels}.
They should be placed ${placement} using a ${font} font.`;
    }

    if (policy === 'DIAGRAM_LABELS_WITH_LEGEND') {
        return `${section}
Complex diagram with a clear legend. Include labels: ${labels}, positioned ${placement} using ${font} font.`;
    }

    return section;
}

// --- Main Formatter ---

/**
 * Deterministically formats an ImageSpec into a prompt string for Gemini.
 */
export function formatImageSpec(spec: ImageSpec, ctx: FormatContext): string {
    // 1. Negative Prompt Logic (Strict Text Suppression)
    let negativePrompt = spec.negativePrompt ? [...spec.negativePrompt] : [];
    const isNoLabels = spec.textPolicy === 'NO_LABELS';

    if (isNoLabels) {
        const textSuppressionTerms = [
            'text', 'labels', 'words', 'lettering', 'typography',
            'annotations', 'watermark', 'signature', 'caption',
            'numbers', 'legends', 'text overlay', 'written text'
        ];

        textSuppressionTerms.forEach(term => {
            if (!negativePrompt.includes(term)) negativePrompt.push(term);
        });
    }

    // 2. Build Narrative Scene (Cohesive Paragraph)
    const subjectPart = buildSubjectNarrative(spec);
    const actionPart = buildActionNarrative(spec);
    const locationPart = buildLocationNarrative(spec);
    const lightingPart = buildLightingNarrative(spec, ctx.gradeLevel);

    let visualSceneDescription = subjectPart;

    if (actionPart) {
        visualSceneDescription += ` ${actionPart}`;
    }

    if (locationPart) {
        visualSceneDescription += ` inside ${locationPart}`;
    }

    // Add punctuation if missing
    if (!visualSceneDescription.endsWith('.')) {
        visualSceneDescription += '.';
    }

    if (lightingPart) {
        visualSceneDescription += ` ${lightingPart}`;
    }

    // 3. Assemble Prompt Sections
    const sections = [
        `EDUCATIONAL VISUAL AID PROMPT
========================================
CONTEXT:
- Grade Level: ${ctx.gradeLevel}
- Subject: ${ctx.subject}`,

        `TEACHING PURPOSE:
${spec.conceptualPurpose}`,

        `VISUAL SCENE DESCRIPTION:
${visualSceneDescription}`,

        formatCompositionSection(spec),

        formatTextPolicySection(spec),

        spec.mustInclude && spec.mustInclude.length > 0
            ? `MUST INCLUDE:
The image must prominently feature ${spec.mustInclude.join(', ')}.`
            : '',

        spec.avoid && spec.avoid.length > 0
            ? `AVOID:
Avoid including ${spec.avoid.join(', ')}.`
            : '',

        spec.colors && spec.colors.length > 0
            ? `COLORS:
Use a palette of ${spec.colors.join(', ')}. Ensure high contrast for classroom projection.`
            : '',

        negativePrompt.length > 0
            ? `NEGATIVE PROMPT:
${negativePrompt.join(', ')}`
            : '',

        `STYLE & MEDIA:
Educational illustration suitable for textbooks or classroom slides. Prioritize CLARITY and ACCURACY over decorative flair. Use clean lines and distinct shapes. Appropriate for ${ctx.gradeLevel} educational content.`
    ];

    return sections.filter(section => section.trim().length > 0).join('\n\n');
}
