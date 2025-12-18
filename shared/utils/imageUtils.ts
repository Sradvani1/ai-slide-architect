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

    // LLM is instructed to provide gerunds (ending in -ing), so we can trust the input
    // Just join them naturally
    return spec.visualizationDynamics.join(' and ');
}

function buildLocationNarrative(spec: ImageSpec): string {
    const parts = [];
    if (spec.environment) parts.push(spec.environment);
    if (spec.contextualDetails && spec.contextualDetails.length > 0) {
        parts.push(`featuring ${spec.contextualDetails.join(', ')}`);
    }
    return parts.length > 0 ? parts.join(', ') : '';
}

function buildLightingNarrative(spec: ImageSpec, gradeLevel: string): string {
    if (!spec.lighting) return '';
    const l = spec.lighting;
    const parts = [];

    // Note: App focuses on 6th-12th grade, so all lighting details are appropriate
    if (l.quality && l.direction) {
        parts.push(`${l.quality} ${l.direction} lighting`);
    } else if (l.quality) {
        parts.push(`${l.quality} lighting`);
    } else if (l.direction) {
        parts.push(`${l.direction} lighting`);
    }

    if (l.colorTemperature) {
        parts.push(`${l.colorTemperature} color temperature`);
    }

    if (l.mood) {
        parts.push(`creating a ${l.mood} atmosphere`);
    }

    return parts.length > 0 ? `Illuminated by ${parts.join(', ')}.` : '';
}

/**
 * Builds a cohesive narrative scene description weaving all 5 Core Components
 * into a single flowing prose paragraph.
 */
function buildFullNarrativeScene(spec: ImageSpec, ctx: FormatContext): string {
    const subjectPart = buildSubjectNarrative(spec);
    const actionPart = buildActionNarrative(spec);
    const locationPart = buildLocationNarrative(spec);
    const lightingPart = buildLightingNarrative(spec, ctx.gradeLevel);

    // Start with subject
    let narrative = subjectPart;

    // Integrate action naturally
    if (actionPart) {
        // If subject doesn't already imply action, add it
        narrative += ` ${actionPart}`;
    }

    // Add location context
    if (locationPart) {
        narrative += ` inside ${locationPart}`;
    }

    // Ensure proper punctuation before lighting
    if (!narrative.endsWith('.')) {
        narrative += '.';
    }

    // Add lighting as a separate sentence for clarity
    if (lightingPart) {
        narrative += ` ${lightingPart}`;
    } else if (!narrative.endsWith('.')) {
        narrative += '.';
    }

    return narrative;
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
        if (c.depthOfField === 'shallow') {
            description += ', shallow depth of field with blurred background to emphasize the subject';
        } else {
            description += ', deep depth of field with sharp focus throughout';
        }
    }

    let compositionSection = `COMPOSITION & CAMERA ANGLE:
${description}.`;

    // Add pedagogical framing as separate section if present
    if (c.framingRationale) {
        compositionSection += `\n\nPEDAGOGICAL FRAMING:
This ${c.viewpoint.replace(/-/g, ' ')} viewpoint is chosen because: ${c.framingRationale}`;
    }

    return compositionSection;
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
    // 1. Negative Prompt Logic (Strict Text Suppression + Educational Safety)
    let negativePrompt = spec.negativePrompt ? [...spec.negativePrompt] : [];
    const isNoLabels = spec.textPolicy === 'NO_LABELS';

    // Add text suppression terms if NO_LABELS
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

    // Always add educational safety terms (regardless of textPolicy)
    const educationalSafetyTerms = [
        'blurry', 'low-resolution', 'pixelated', 'distorted',
        'overexposed', 'completely dark', 'confusing', 'cluttered'
    ];

    educationalSafetyTerms.forEach(term => {
        if (!negativePrompt.includes(term)) negativePrompt.push(term);
    });

    // 2. Build Narrative Scene (Cohesive Paragraph using helper)
    const visualSceneDescription = buildFullNarrativeScene(spec, ctx);

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

    return sections
        .filter(section => section.trim().length > 0)
        .map((section, idx) => idx > 0 ? `\n\n---\n\n${section}` : section)
        .join('');
}
