import type { ImageSpec } from '../types';
import {
    formatImageSpec
} from '../../shared/utils/imageUtils';

export { formatImageSpec }; // Re-export for client usage

/**
 * Prepares an ImageSpec for saving by formatting it into a prompt.
 * Returns the spec as-is along with the formatted prompt string.
 */
export function prepareSpecForSave(
    spec: ImageSpec,
    gradeLevel: string,
    subject: string
): { imageSpec: ImageSpec; renderedImagePrompt: string } {
    // Format the spec into a prompt (uses internal defaults for missing fields)
    const rendered = formatImageSpec(spec, { gradeLevel, subject });

    return {
        imageSpec: spec,  // Return spec exactly as received
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
