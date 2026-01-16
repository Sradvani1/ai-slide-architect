export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_BULLETS_PER_SLIDE = 4;
export const DEFAULT_NUM_SLIDES = 5;

// Model Constants
export const MODEL_SLIDE_GENERATION = "gemini-2.0-flash";
export const MODEL_REPAIR_PASS = "gemini-3-flash-preview";
export const MODEL_IMAGE_GENERATION = "gemini-3-pro-image-preview";
export const MODEL_SPEC_REGENERATION = "gemini-3-flash-preview";

// Image Generation Style Guidelines
export const STYLE_GUIDELINES = `
VISUAL STYLE:
- Goal: Create a pedagogical visual aid. Prioritize clarity, simplicity, and readability.
- Composition: Canonical 2D instructional view. No perspective.
- Lighting: Neutral, uniform technical lighting. No shadows.
- Style: Clean, flat vector illustration. Simple lines.
- Background: Pure-white solid background. No texture.
- Colors: Minimalist palette of solid, high-contrast colors. No gradients.

TEXT AND LABELING:
- Appearance: Simple, sans-serif font; high contrast, prominently scaled.
- Positioning: Adjacent to or visually connected to specific elements.
`;
