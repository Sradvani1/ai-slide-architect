import type { ImageSpec } from '../types';
import {
    normalizeImageSpec,
    formatImageSpec
} from '../../shared/utils/imageUtils';

export { normalizeImageSpec, formatImageSpec }; // Re-export for client usage

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
