
import { ImageSpec, ImageLayout, Viewpoint, Whitespace, ImageTextPolicy } from '../types';

/**
 * Validates an ImageSpec object at runtime.
 * Returns an array of error messages. Empty array means valid.
 */
export function validateImageSpec(spec: ImageSpec): string[] {
    const errors: string[] = [];

    if (!spec) {
        return ['ImageSpec is null or undefined'];
    }

    if (!spec.primaryFocal || typeof spec.primaryFocal !== 'string' || spec.primaryFocal.trim() === '') {
        errors.push('imageSpec.primaryFocal is required');
    }

    if (!Array.isArray(spec.subjects) || spec.subjects.length < 2 || spec.subjects.length > 5) {
        errors.push('imageSpec.subjects must have 2–5 items');
    }

    if (!Array.isArray(spec.mustInclude) || spec.mustInclude.length < 2 || spec.mustInclude.length > 6) {
        errors.push('imageSpec.mustInclude must have 2–6 items');
    }

    if (!Array.isArray(spec.avoid) || spec.avoid.length < 2) {
        errors.push('imageSpec.avoid must have at least 2 items');
    }

    if (!spec.composition) {
        errors.push('imageSpec.composition is required');
    } else {
        // Runtime Enum Validation
        const validLayouts: ImageLayout[] = ['single-focal-subject-centered', 'balanced-pair', 'simple-sequence-2-panel'];
        const validViewpoints: Viewpoint[] = ['front', 'three-quarter', 'side', 'overhead', 'child-eye-level'];
        const validWhitespaces: Whitespace[] = ['generous', 'moderate'];

        if (!validLayouts.includes(spec.composition.layout)) {
            errors.push(`Invalid layout: ${spec.composition.layout}`);
        }
        if (spec.composition.viewpoint && !validViewpoints.includes(spec.composition.viewpoint)) {
            // Viewpoint might be undefined before sanitization, so check only if present? 
            // Actually validate is usually called AFTER generation or BEFORE usage. 
            // Let's assume strictness only if value exists, or undefined might be allowed raw?
            errors.push(`Invalid viewpoint: ${spec.composition.viewpoint}`);
        }
        if (!validWhitespaces.includes(spec.composition.whitespace)) {
            errors.push(`Invalid whitespace: ${spec.composition.whitespace}`);
        }
    }

    if (spec.textPolicy) {
        const validPolicies: ImageTextPolicy[] = ['NO_LABELS', 'LIMITED_LABELS_1_TO_3'];
        if (!validPolicies.includes(spec.textPolicy)) {
            errors.push(`Invalid textPolicy: ${spec.textPolicy}`);
        }
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
    // 1. Shallow clone + explicit normalization (avoid JSON.parse/stringify to keep undefineds)
    const clone: ImageSpec = { ...spec };

    // Deep clone specific objects/arrays we intend to mutate
    clone.subjects = [...(spec.subjects || [])].slice(0, 5);
    clone.mustInclude = [...(spec.mustInclude || [])].slice(0, 6);
    clone.avoid = [...(spec.avoid || [])].slice(0, 10);
    clone.actions = spec.actions ? [...spec.actions].slice(0, 3) : [];
    clone.colors = spec.colors ? [...spec.colors].slice(0, 5) : [];
    clone.negativePrompt = spec.negativePrompt ? [...spec.negativePrompt].slice(0, 10) : [];
    clone.allowedLabels = spec.allowedLabels ? [...spec.allowedLabels].slice(0, 3) : [];

    // Composition requires careful handling of sub-object
    clone.composition = spec.composition ? { ...spec.composition } : {
        layout: 'single-focal-subject-centered',
        viewpoint: undefined as any,
        whitespace: 'generous'
    };

    // Ensure negativePrompt defaults
    if (clone.negativePrompt.length === 0) {
        clone.negativePrompt = [
            'misspelled text',
            'gibberish',
            'confusing details',
            'watermarks',
            'blurry'
        ];
    }

    // Defaults for Composition
    if (!clone.composition.layout) clone.composition.layout = 'single-focal-subject-centered';
    if (!clone.composition.whitespace) clone.composition.whitespace = 'generous';

    // Smart Viewpoint Default
    const gradeNum = parseGradeLevel(gradeLevel);
    if (!clone.composition.viewpoint) {
        // Younger kids (K-2) benefit from simple front/eye-level views
        clone.composition.viewpoint = gradeNum <= 2 ? 'child-eye-level' : 'front';
    }

    // Text Policy Defaults
    if (!clone.textPolicy) {
        clone.textPolicy = 'NO_LABELS';
    }

    if (clone.textPolicy === 'NO_LABELS') {
        clone.allowedLabels = [];
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

    const actionsStr = actions.length
        ? `Actions: ${actions.join(', ')}.`
        : '';

    const colorsStr = colors.length
        ? `Primary colors: ${colors.join(', ')}.`
        : '';

    const textPolicyStr =
        textPolicy === 'NO_LABELS'
            ? 'No text, letters, or labels in the image.'
            : allowedLabels.length > 0
                ? `Include at most these labels: ${allowedLabels.join(', ')}. Labels must be simple, legible, and large.`
                : 'At most 1–3 simple labels if absolutely needed for clarity.';

    const rawAvoidList = [
        ...avoid,
        ...negativePrompt,
        'watermarks or signatures in the focal area',
        'dense, distracting background patterns',
        'tiny unreadable details',
    ];
    // Dedupe
    const avoidList = Array.from(new Set(rawAvoidList));

    // We intentionally format this with explicit headers to guide the model
    return `EDUCATIONAL VISUAL AID PROMPT
Audience: ${ctx.gradeLevel} grade
Subject: ${ctx.subject}

Primary focus:
${primaryFocal}

Show:
- ${mustInclude.join('\n- ')}

Objects:
- ${subjects.join('\n- ')}
${actionsStr ? '\n' + actionsStr : ''}

Composition:
- Layout: ${composition.layout}
- Viewpoint: ${composition.viewpoint}
- Background: plain white
- Whitespace: ${composition.whitespace} (leave room for slide text)

Text in image:
- ${textPolicyStr}

Style:
- Flat vector educational illustration, clean lines, classroom-friendly
- High contrast, simple shapes, no photorealism

${colorsStr}

Avoid:
- ${avoidList.join('\n- ')}
`;
}

/**
 * Generates a SHA-256 hash of the prompt string.
 * Used to detect if the prompt has changed since the last generation.
 */
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
