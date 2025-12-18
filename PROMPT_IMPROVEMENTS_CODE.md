# Improved Prompt Code - Ready to Implement

## 1. Enhanced Content Generation Prompt

### Current Code (to replace):
File: `functions/src/shared/promptBuilders.ts`
Function: `buildImagePromptInstructionsSection()`

### Improved Version:

```typescript
function buildImagePromptInstructionsSection(gradeLevel: string): string {
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by teachers in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students. The image 
  should help teachers convey information clearly and effectively.
  
  For each slide, generate a detailed visual narrative for an educational image that 
  illustrates the key information on this slide.
  
  Construct the narrative flow in this order:
  1. Start by describing the main Subject (the central visual element)
  2. Next, describe the Action (the active process, movement, or behavior)
  3. Finally, describe the Setting (the specific environment or context)
  
  CONTENT REQUIREMENTS:
  - The narrative must be vivid and factual, ensuring the image serves as a clear visual aid.
  - Focus on visual elements that directly explain or demonstrate the concept being taught.
  - Describe concrete, visible objects and processes that students can observe and understand.
  - Ensure the visual complexity is appropriate for ${gradeLevel} students (but do not mention 
    style or artistic rendering - that is handled separately).
  - DO NOT include any text, labels, words, or annotations in your description.
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}
```

### Update the function signature in `buildSlideGenerationPrompt()`:

```typescript
export function buildSlideGenerationPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  totalSlides: number,
  numSlides: number,
  sourceMaterial: string,
  useWebSearch: boolean,
  bulletsPerSlide: number,
  additionalInstructions?: string,
  includeOutputFormat?: boolean
): string {
  const sections = [
    buildSystemRoleSection(),
    buildInputContextSection(topic, subject, gradeLevel, totalSlides, numSlides, additionalInstructions),
    buildSourceMaterialSection(sourceMaterial, useWebSearch),
    buildContentStandardsSection(),
    buildStructureRequirementsSection(totalSlides, subject, gradeLevel),
    buildFormattingConstraintsSection(bulletsPerSlide),
    buildImagePromptInstructionsSection(gradeLevel), // ← Pass gradeLevel here
  ];

  if (includeOutputFormat) {
    sections.push(buildOutputFormatSection());
  }

  return sections.filter(section => section.trim().length > 0).join('\n');
}
```

---

## 2. Enhanced Style Guidelines

### Current Code (to replace):
File: `functions/src/services/imageGeneration.ts`
Constant: `STYLE_GUIDELINES`

### Improved Version:

```typescript
const STYLE_GUIDELINES = `
PURPOSE: This image will be displayed in a teacher's presentation slide for classroom use.

VISUAL STYLE:
Front view, sharp focus throughout. Neutral, uniform technical lighting with no shadows. 
Clean, flat vector illustration style on a pure-white invisible background. 
Minimalist palette of 3–5 solid, high-contrast colors without gradients.

TEXT POLICY:
No text, labels, words, or annotations anywhere in the image. The pure white background 
provides no space for text overlay.

OPTIMIZATION:
Optimized for classroom projection - high contrast, clear visibility from a distance, 
suitable for students viewing on a screen or whiteboard.
`;
```

---

## 3. Optional: Add Examples (Alternative Version)

If you want to include examples for even better quality:

```typescript
function buildImagePromptInstructionsSection(gradeLevel: string): string {
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by teachers in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students. The image 
  should help teachers convey information clearly and effectively.
  
  For each slide, generate a detailed visual narrative for an educational image that 
  illustrates the key information on this slide.
  
  Construct the narrative flow in this order:
  1. Start by describing the main Subject (the central visual element)
  2. Next, describe the Action (the active process, movement, or behavior)
  3. Finally, describe the Setting (the specific environment or context)
  
  CONTENT REQUIREMENTS:
  - The narrative must be vivid and factual, ensuring the image serves as a clear visual aid.
  - Focus on visual elements that directly explain or demonstrate the concept being taught.
  - Describe concrete, visible objects and processes that students can observe and understand.
  - Ensure the visual complexity is appropriate for ${gradeLevel} students (but do not mention 
    style or artistic rendering - that is handled separately).
  - DO NOT include any text, labels, words, or annotations in your description.
  
  EXAMPLES OF GOOD PROMPTS:
  - (Science): "A plant cell with a large central nucleus, green chloroplasts scattered throughout, 
    and a rigid cell wall surrounding the entire structure. The organelles are clearly visible and 
    distinct in shape and color."
  - (History): "A group of colonial figures in period clothing gathered around a wooden table, 
    with quill pens and parchment documents visible. The setting is a formal meeting room with 
    natural light from windows."
  
  EXAMPLES TO AVOID:
  - "Abstract representation of concepts" (too vague, not educational)
  - "Simple icon or minimalist graphic" (not detailed enough for teaching)
  - "Image showing [concept] with labels" (we do not use text or labels)
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}
```

---

## 4. Complete Updated Files

### `functions/src/shared/promptBuilders.ts` - Complete Updated Function:

```typescript
function buildImagePromptInstructionsSection(gradeLevel: string): string {
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by teachers in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students. The image 
  should help teachers convey information clearly and effectively.
  
  For each slide, generate a detailed visual narrative for an educational image that 
  illustrates the key information on this slide.
  
  Construct the narrative flow in this order:
  1. Start by describing the main Subject (the central visual element)
  2. Next, describe the Action (the active process, movement, or behavior)
  3. Finally, describe the Setting (the specific environment or context)
  
  CONTENT REQUIREMENTS:
  - The narrative must be vivid and factual, ensuring the image serves as a clear visual aid.
  - Focus on visual elements that directly explain or demonstrate the concept being taught.
  - Describe concrete, visible objects and processes that students can observe and understand.
  - Ensure the visual complexity is appropriate for ${gradeLevel} students (but do not mention 
    style or artistic rendering - that is handled separately).
  - DO NOT include any text, labels, words, or annotations in your description.
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}

// ... rest of file ...

export function buildSlideGenerationPrompt(
  topic: string,
  subject: string,
  gradeLevel: string,
  totalSlides: number,
  numSlides: number,
  sourceMaterial: string,
  useWebSearch: boolean,
  bulletsPerSlide: number,
  additionalInstructions?: string,
  includeOutputFormat?: boolean
): string {
  const sections = [
    buildSystemRoleSection(),
    buildInputContextSection(topic, subject, gradeLevel, totalSlides, numSlides, additionalInstructions),
    buildSourceMaterialSection(sourceMaterial, useWebSearch),
    buildContentStandardsSection(),
    buildStructureRequirementsSection(totalSlides, subject, gradeLevel),
    buildFormattingConstraintsSection(bulletsPerSlide),
    buildImagePromptInstructionsSection(gradeLevel), // ← Updated to pass gradeLevel
  ];

  if (includeOutputFormat) {
    sections.push(buildOutputFormatSection());
  }

  return sections.filter(section => section.trim().length > 0).join('\n');
}
```

### `functions/src/services/imageGeneration.ts` - Updated Constant:

```typescript
const STYLE_GUIDELINES = `
PURPOSE: This image will be displayed in a teacher's presentation slide for classroom use.

VISUAL STYLE:
Front view, sharp focus throughout. Neutral, uniform technical lighting with no shadows. 
Clean, flat vector illustration style on a pure-white invisible background. 
Minimalist palette of 3–5 solid, high-contrast colors without gradients.

TEXT POLICY:
No text, labels, words, or annotations anywhere in the image. The pure white background 
provides no space for text overlay.

OPTIMIZATION:
Optimized for classroom projection - high contrast, clear visibility from a distance, 
suitable for students viewing on a screen or whiteboard.
`;

export async function generateImage(
    imagePrompt: string,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string }> {

    const finalPrompt = `${imagePrompt}\n\n${STYLE_GUIDELINES}`;
    // ... rest of function unchanged
}
```

---

## Summary of Changes

### Content Generation Prompt:
1. ✅ Added **PURPOSE & CONTEXT** section (teacher presentations, standalone resource)
2. ✅ Added explicit **"DO NOT include text/labels"** constraint
3. ✅ Added **grade level** mention (for complexity guidance)
4. ✅ Enhanced **CONTENT REQUIREMENTS** with clearer guidance
5. ✅ (Optional) Added examples section

### Style Guidelines:
1. ✅ Added **PURPOSE** statement
2. ✅ Added explicit **TEXT POLICY** section
3. ✅ Added **OPTIMIZATION** section (classroom projection)
4. ✅ Better structured with clear sections

### Key Benefits:
- **Quality**: Purpose statement helps LLM understand WHY (produces better content)
- **Clarity**: Explicit "NO TEXT" in both places eliminates confusion
- **Context**: Grade level helps adapt complexity while maintaining uniform style
- **Consistency**: Style remains uniform (enforced by STYLE_GUIDELINES)

---

## Testing Recommendations

1. Test with different grade levels (K-5, 6-12) to ensure complexity adapts appropriately
2. Verify no text/labels appear in generated images
3. Compare quality before/after - should see more educational, teacher-focused content
4. Ensure style remains consistent across all grades
5. Check that prompts are more detailed and appropriate for teaching
