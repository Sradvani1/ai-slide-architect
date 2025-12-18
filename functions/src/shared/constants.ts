export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_BULLETS_PER_SLIDE = 4;
export const DEFAULT_NUM_SLIDES = 5;

// Model Constants
export const MODEL_SLIDE_GENERATION = "gemini-3-flash-preview";
export const MODEL_REPAIR_PASS = "gemini-3-flash-preview";
export const MODEL_IMAGE_GENERATION = "gemini-3-pro-image-preview";
export const MODEL_SPEC_REGENERATION = "gemini-3-flash-preview";

// Image Generation Style Guidelines
export const STYLE_GUIDELINES = `
VISUAL STYLE (Classroom Educational Standard):
- Goal: Create a pedagogical visual aid for presentation slides. Prioritize clarity, simplicity, and readability.
- Composition: Front view, sharp focus throughout. No blur or depth effects.
- Lighting: Neutral, uniform technical lighting. No shadows.
- Style: Clean, flat vector illustration. Professional, simple lines.
- Background: Pure-white invisible background. No texture.
- Colors: Minimalist palette of 3–5 solid, high-contrast colors. No gradients.

TEXT AND LABELING:
- Typography: Large, bold, sans-serif fonts (Arial-style).
- Readability: High contrast against background. Maximize legibility.
- Placement: Clearly connected to elements with straight leader lines.
`;
