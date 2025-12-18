import type { ImageSpec } from '../types';
import {
    formatImageSpec,
    extractVisualSceneDescription
} from '../../shared/utils/imageUtils';

export { formatImageSpec, extractVisualSceneDescription }; // Re-export for client usage

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
