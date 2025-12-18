# Complete Image Prompt History - geminiService.ts Evolution

This document contains the complete history of image prompt structures from the very first commit (145019b) until the file was moved to the backend (commit ea1051e was the last version in `src/services/geminiService.ts`).

---

## Version 1: Original Simple Prompt (Commit 145019b)
**Date:** First commit with geminiService.ts  
**Structure:** Simple string prompt with style requirements appended

### Main Prompt for Slide Generation (extracted from prompt):
```
**CRITICAL REQUIREMENT FOR IMAGE PROMPTS:**

For each slide, you must generate an imagePrompt by analyzing the slide's title and content to determine the best visual representation of the concept. The imagePrompt should describe what visual elements would best help a teacher explain the concept to students.

**Style Requirements:**
- The style must be appropriate for the **Grade Level** and **Subject**.
- For younger students (e.g., K-5), use styles like "colorful illustration", "simple diagram", or "cartoon style".
- For older students (e.g., 6-12, University), use styles like "detailed diagram", "realistic illustration", "infographic", or "educational chart".
- The visual should be clear, accurate, and educational.

**Content Requirements:**
- The prompt should describe a visual representation that clearly explains the concept from the slide.
- It must be detailed enough to be educational and helpful.
- **INCLUDE TEXT AND LABELS:** The illustration SHOULD include explanatory text, labels, and annotations where appropriate to enhance understanding.

**Examples of Good Prompts:**
- (For 1st Grade Science): "A colorful, simple illustration showing the water cycle. A smiling sun shines on a blue ocean. Fluffy white clouds are in the sky. Rain falls from a grey cloud onto green grass. Arrows show the water going up and down."
- (For University Biology): "A detailed, scientifically accurate cross-section diagram of a plant cell. Key structures like the cell wall, nucleus, chloroplasts, and large central vacuole are clearly illustrated and labeled. The style is educational and suitable for a textbook."
- (For High School History): "A realistic historical illustration depicting the signing of the Declaration of Independence. The room is filled with colonial figures in period clothing. The atmosphere is serious and momentous."

**Examples of Bad Prompts:**
- "Abstract representation of concepts" (too abstract)
- "Minimalist icon of [concept]" (too simple, not educational)
- "Simple decorative graphic" (not educational)
```

### Prompt Sent to Image Generation API:
```javascript
const enhancedPrompt = `${prompt}

REQUIREMENTS:
- Create a high-quality illustration based on the description above.
- Ensure the style matches the description (e.g., cartoon, realistic, diagram).
- **INCLUDE TEXT:** The illustration SHOULD include clear, legible explanatory text, labels, and annotations where appropriate to enhance understanding.

PURPOSE: This illustration will be used by a teacher in a presentation slide. It should be a standalone educational resource that visually explains the concept to students.`;
```

**Model:** `gemini-3-pro-image-preview`  
**Note:** This version encouraged text/labels in images.

---

## Version 2: Simplified Style Guidelines (Commit 99f5567)
**Date:** Update Gemini model and refine image generation guidelines to explicitly forbid text and diagrams  
**Change:** Removed text/labels requirement, simplified guidelines

### Main Prompt for Slide Generation:
```
**Image Prompting Guidelines:**
1. **Visual Description ONLY:** Focus strictly on visible objects, actions, and settings.
2. **NO Diagrams:** Do not request diagrams that require text labels. Images are supplementary visual aids.
3. **Target Audience:** Ensure visual complexity is appropriate for ${gradeLevel} students.
4. **NO Style Instructions:** Do not include words like "vector", "style", "photorealistic".
5. **Content Alignment:** The image must directly illustrate the "Content" provided above.
```

### Prompt Sent to Image Generation API:
```javascript
const IMAGE_STYLE_GUIDE = `
**Visual Style Guidelines:**
- **Art Style:** Flat vector-style educational illustration. Professional, clean lines.
- **Background:** Clean, solid, or white background. No scenic backgrounds or visual clutter.
- **Color & Contrast:** High contrast, distinct colors optimized for classroom projection.
- **Typography:** Use LARGE, BOLD, Sans-Serif fonts for all text. Ensure maximum readability from a distance.
- **Labeling:** Connect labels with clear, straight lines. No floating text.
`;

const enhancedPrompt = `
**Image Subject:**
${prompt}

**Target Audience:**
${gradeLevel} Grade Students

${IMAGE_STYLE_GUIDE}`;
```

**Model:** `gemini-2.5-flash-image`  
**Note:** Still mentions typography/labeling despite "NO Diagrams" rule - contradiction present.

---

## Version 3: Further Refinement (Commit 2534e14)
**Date:** Refine image generation guidelines by removing markdown, clarifying text usage, and explicitly prohibiting background descriptions  
**Change:** More explicit about NO text

### Main Prompt for Slide Generation:
```
**REQUIREMENTS FOR IMAGE PROMPTS:**
For each slide, generate a clear, descriptive imagePrompt for an EDUCATIONAL ILLUSTRATION to explain the concept. Focus ONLY on the visible objects, actions, and diagrams. Ensuring the visual complexity is appropriate for ${gradeLevel} students. If a diagram is needed, explicitly specify "labeled diagram" and list key labels. DO NOT include any style, artistic, or rendering instructions (e.g., "detailed", "photorealistic", "illustration style").
```

### Prompt Sent to Image Generation API:
Same as Version 2 (IMAGE_STYLE_GUIDE)

**Model:** `gemini-3-pro-image-preview` (changed back from flash-image)

---

## Version 4: Centralized Style Guide (Commit 8219032)
**Date:** Refine slide structure and image prompt generation instructions for clarity and stricter adherence  
**Change:** Removed style instructions from generation, kept only in IMAGE_STYLE_GUIDE

### Main Prompt for Slide Generation:
```
**Formatting Constraints (CRITICAL):**
- **Bullets:** Exactly ${bulletsPerSlide} bullet points per content slide.
- **No Markdown:** Bullet points must be plain strings. NO bold (**), italics (*), or bullet characters (-) in the string itself.
- **Image Prompts:** Visual descriptions ONLY. No "Prompt:" prefix. Focus on the subject matter. Do NOT include style instructions.
```

### Prompt Sent to Image Generation API:
```javascript
const IMAGE_STYLE_GUIDE = `
**Visual Style Guidelines:**
- **Art Style:** Flat vector-style educational illustration. Professional, clean lines.
- **Background:** Clean, solid, or white background. No scenic backgrounds or visual clutter.
- **Color & Contrast:** High contrast, distinct colors optimized for classroom projection.
- **Typography:** Use LARGE, BOLD, Sans-Serif fonts for all text. Ensure maximum readability from a distance.
- **Labeling:** Connect labels with clear, straight lines. No floating text.
`;

const enhancedPrompt = `
**Image Subject:**
${prompt}

**Target Audience:**
${gradeLevel} Grade Students

${IMAGE_STYLE_GUIDE}`;
```

**Model:** `gemini-3-pro-image-preview`

---

## Version 5: Further Simplification (Commit 2b4d90f)
**Date:** Refine image prompt instructions to exclude style and artistic rendering details, and clarify bullet point count  
**Change:** Removed style guide mention from regenerateImagePrompt

### Main Prompt for Slide Generation:
Same as Version 4

### Regenerate Image Prompt Function:
```javascript
const prompt = `
Generate a clear, descriptive imagePrompt for an EDUCATIONAL ILLUSTRATION to explain the concept of the following presentation slide. Focus ONLY on the visible objects, actions, and diagrams. Ensuring the visual complexity is appropriate for ${gradeLevel} students. If a diagram is needed, explicitly specify "labeled diagram" and list key labels. DO NOT include any style, artistic, or rendering instructions (e.g., "detailed", "photorealistic", "illustration style").

**Slide Context:**
- Title: "${slideTitle}"
- Content: ${slideContent.join('; ')}
- Grade Level: "${gradeLevel}"
- Subject: "${subject}"

**Output:**
Return ONLY the prompt text for an educational illustration. Do not include any conversational text or labels like "Prompt:".
`;
```

---

## Version 6: Introduction of ImageSpec (Commit 0e15d71)
**Date:** Implement structured `imageSpec` for AI image generation, replacing `imagePrompt` with detailed specifications  
**MAJOR CHANGE:** Replaced simple string prompts with complex ImageSpec JSON schema

### Main Prompt for Slide Generation (BuildImageSpecInstructionsSection):
This version introduced the `buildImageSpecInstructionsSection()` function (similar to what we saw in the refactor plans), but let me extract the actual version from this commit:

The prompt structure changed to request an `imageSpec` object instead of `imagePrompt` string. The `formatImageSpec()` function was introduced to convert the ImageSpec to a rendered prompt.

### Prompt Sent to Image Generation API:
```javascript
// formatImageSpec() converts ImageSpec to a detailed prompt
// This function was in src/utils/imageUtils.ts
// The rendered prompt was a complex multi-section prompt similar to the versions in the plan files

export const generateImageFromSpec = async (
  spec: ImageSpec,
  gradeLevel: string,
  subject: string,
  options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ blob: Blob; renderedPrompt: string }> => {
  const renderedPrompt = formatImageSpec(spec, { gradeLevel, subject });
  // ... sends spec to server, receives base64 image
};
```

**Model:** Backend endpoint (file was moved to backend around this time)

---

## Version 7: Modularized Prompt Building (Commit dac705c)
**Date:** Modularize Gemini prompt generation, introduce `IMAGE_SPEC_SCHEMA` and `normalizeImageSpec`  
**Change:** Extracted prompt building into separate functions

### Main Prompt for Slide Generation:
```typescript
function buildImageSpecInstructionsSection(): string {
  return `
  IMAGE VISUAL SPECIFICATION (imageSpec)
  You must output an \`imageSpec\` object for each content slide. This object will be converted into an AI image generation prompt.

  TEACHING GOAL:
  - The image must teach a specific concept, not just decorate the slide.
  - Define a \`conceptualPurpose\`: What should the student understand from this image?

  imageSpec rules:
  - \`conceptualPurpose\`: REQUIRED. explicit pedagogical goal.
  - \`primaryFocal\`: The main visual subject.
  - \`subjects\`: 2–5 concrete objects to draw.
  - \`mustInclude\`: 2–6 critical details to include.
  - \`avoid\`: List distracting elements to exclude.
  - Composition:
    - \`layout\`: Choose best fit: "single-focal-subject-centered" (default), "balanced-pair" (comparisons), "comparison-split-screen" (before/after), "diagram-with-flow" (processes), "simple-sequence-2-panel" (steps).
    - \`viewpoint\`: "front", "side", "overhead", "isometric-3d-cutaway" (for structures), "side-profile" (for layers/processes).
    - \`whitespace\`: "generous" (default) or "moderate".
  - Text policy:
    - Default: "NO_LABELS". Choose this unless text labels improve learning.
    - "LIMITED_LABELS_1_TO_3": Use for diagrams where parts need names.
      - CONTRACT: If you choose this, you MUST provide 1-3 distinct strings in \`allowedLabels\`.
      - If \`allowedLabels\` is empty, the system will FORCE "NO_LABELS".
  - Colors: 3–5 high-contrast colors.
  - negativePrompt: list failure modes (e.g., "blur", "text", "complex background").

  Output a valid JSON object.
  `;
}
```

### Prompt Sent to Image Generation API:
The `formatImageSpec()` function converted the ImageSpec to a multi-section prompt (as shown in the plan files we reviewed earlier).

---

## Version 8: Last Version Before Backend Move (Commit ea1051e)
**Date:** Add shared schemas and install project dependencies  
**Note:** This was the LAST commit where the file existed in `src/services/geminiService.ts` before being moved to the backend.

The structure was similar to Version 7, but the file now made HTTP calls to backend endpoints:

```typescript
export const generateImageFromSpec = async (
  spec: ImageSpec,
  gradeLevel: string,
  subject: string,
  options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ blob: Blob; renderedPrompt: string }> => {
  const renderedPrompt = formatImageSpec(spec, { gradeLevel, subject });
  
  const result = await authenticatedRequest<{ base64Data: string; mimeType: string, renderedPrompt?: string }>('/generate-image', {
    spec,
    gradeLevel,
    subject,
    options
  });
  
  // Convert base64 to blob and return
  return {
    blob: new Blob([bytes], { type: result.mimeType }),
    renderedPrompt: result.renderedPrompt || renderedPrompt
  };
};
```

**Note:** At this point, the actual image generation logic had moved to `functions/src/services/imageGeneration.ts`, but the client still had the `formatImageSpec` function for generating the rendered prompt.

---

## Summary of Evolution

1. **Version 1 (145019b)**: Simple string prompt with style/grade level requirements + text/labels encouraged
2. **Version 2-3 (99f5567, 2534e14)**: Removed text requirement, added centralized IMAGE_STYLE_GUIDE constant
3. **Version 4-5 (8219032, 2b4d90f)**: Further simplified, removed style instructions from generation prompt
4. **Version 6 (0e15d71)**: MAJOR CHANGE - Introduced ImageSpec JSON schema with `formatImageSpec()` function
5. **Version 7 (dac705c)**: Modularized prompt building functions
6. **Version 8 (ea1051e)**: Last version in client - made HTTP calls to backend, still used `formatImageSpec` on client

After commit ea1051e, the file was moved to the backend (commit 275766a), and subsequent refactors happened in the backend codebase.
