
import type { ImageSpec, ImageLayout, Viewpoint, Whitespace, ImageTextPolicy } from '../types.ts';

/**
 * Validates an ImageSpec object at runtime.
 * Returns an array of error messages. Empty array means valid.
 */
export function validateImageSpec(spec: ImageSpec): string[] {
    const errors: string[] = [];

    if (!spec) {
        return ['ImageSpec is null or undefined'];
    }

    // REQUIRED FIELDS
    if (!spec.primaryFocal || typeof spec.primaryFocal !== 'string' || spec.primaryFocal.trim() === '') {
        errors.push('imageSpec.primaryFocal is required');
    }

    // NEW: conceptualPurpose is critical
    if (!spec.conceptualPurpose || typeof spec.conceptualPurpose !== 'string' || spec.conceptualPurpose.trim() === '') {
        errors.push('imageSpec.conceptualPurpose is required');
    }

    // Checking Ranges
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
    // 1. Compatibility Check: Handle Null/Undefined input gracefully
    // If spec is missing but we're here, we must produce a valid placeholder.
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

    // 2. Shallow clone + data repair
    const clone: ImageSpec = { ...spec };

    // Backfill conceptualPurpose (Critical for legacy slides)
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

    // 5. Text Policy Defaults
    if (!clone.textPolicy) {
        clone.textPolicy = 'NO_LABELS';
    }
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

interface FormatContext {
    gradeLevel: string;
    subject: string;
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

    let prompt = `EDUCATIONAL VISUAL AID PROMPT
${'='.repeat(40)}

CONTEXT:
- Grade Level: ${ctx.gradeLevel}
- Subject: ${ctx.subject}

TEACHING PURPOSE (Why this matters):
${conceptualPurpose || 'Provide a visual aid for the concept.'}

PRIMARY VISUAL CONCEPT:
${primaryFocal}

VISUAL ELEMENTS (Concrete objects):
${subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${actions.length > 0 ? `ACTIONS / INTERACTIONS:\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n` : ''}
MUST INCLUDE (Critical details):
${mustInclude.map((m, i) => `${i + 1}. ${m}`).join('\n')}

COMPOSITION & LAYOUT:
- Layout: ${composition.layout}
- Viewpoint: ${composition.viewpoint}
- Whitespace: ${composition.whitespace} (keep clean for text overlay)
- Background: Minimal/Plain (standard educational style)

TEXT POLICY:
${textPolicy === 'NO_LABELS'
            ? '- No text, labels, or lettering in the image.'
            : `- Include ONLY these labels: ${allowedLabels.join(', ')}.\n- Use large, legible font.`}

COLORS (Semantic & High Contrast):
${colors.length > 0
            ? `- Use this palette: ${colors.join(', ')}`
            : '- Use high-contrast primary colors suitable for classroom projection.'}

AVOID (Distractions):
${avoid.map((a, i) => `${i + 1}. ${a}`).join('\n')}

NEGATIVE PROMPT (Prevent these errors):
${negativePrompt.join(', ')}

STYLE & TONE:
- Educational illustration, suitable for textbooks or classroom slides.
- Prioritize CLARITY over decorative flair.
- Use clean lines and distinct shapes.
`;

    return prompt;
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
export async function hashPrompt(prompt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(prompt);

    // Universal crypto check (Node 19+, Browser, or polyfill)
    const subtle = globalThis.crypto?.subtle || (globalThis as any).crypto?.webcrypto?.subtle;

    if (subtle) {
        const hashBuffer = await subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // Fallback for simple unique ID if crypto is missing (less robust, but keeps app working)
    // In a real Node environment we'd import 'crypto', but this file might be shared in browser bundle
    console.warn("Crypto API not available, using simple fallback hash");
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
        const char = prompt.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
}
