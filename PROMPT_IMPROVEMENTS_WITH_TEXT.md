# Improved Prompts WITH Text/Labels Support

## Where Text Instructions Belong

### CONTENT Generation Prompt = WHAT Labels/Text to Include
Specify **semantic content**: What should be labeled, what text should appear, where it should be located.

### STYLE Guidelines = HOW Text Should Look
Specify **visual appearance**: Typography, font size, placement rules, readability requirements.

---

## 1. Enhanced Content Generation Prompt (WITH Text)

### Updated Function:

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
  
  TEXT AND LABELS:
  - Include explanatory text, labels, and annotations where they enhance understanding.
  - Specify which elements should be labeled (e.g., "Label the nucleus, mitochondria, and 
    chloroplasts in the cell diagram").
  - Include descriptive text that helps explain the concept (e.g., "Add arrows with labels 
    showing the flow of water from ocean to clouds").
  - Text should be clear, concise, and directly support the educational purpose.
  - Only include labels/text when they add educational value - avoid decorative or unnecessary text.
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}
```

---

## 2. Enhanced Style Guidelines (WITH Text Typography)

### Updated Constant:

```typescript
const STYLE_GUIDELINES = `
PURPOSE: This image will be displayed in a teacher's presentation slide for classroom use.

VISUAL STYLE:
Front view, sharp focus throughout. Neutral, uniform technical lighting with no shadows. 
Clean, flat vector illustration style on a pure-white invisible background. 
Minimalist palette of 3–5 solid, high-contrast colors without gradients.

TEXT AND LABEL STYLING:
- Typography: Use large, bold, sans-serif fonts (e.g., Arial, Helvetica) for all text and labels.
- Font Size: Text must be large enough to be clearly readable from a distance (suitable for classroom 
  projection). Minimum font size equivalent to 18pt for body text, larger for headings/labels.
- Label Placement: Position labels clearly next to or near the elements they identify. Use straight, 
  clear lines (leader lines) connecting labels to elements when needed. Avoid overlapping text with 
  visual elements.
- Contrast: Ensure text has high contrast against the background (dark text on light backgrounds, 
  light text on dark elements). Text should never blend into the background.
- Legibility: All text must be crisp, clear, and easy to read. Avoid decorative fonts or styles that 
  reduce readability.
- Text Integration: Text should integrate naturally with the visual design without cluttering or 
  overwhelming the educational content.

OPTIMIZATION:
Optimized for classroom projection - high contrast, clear visibility from a distance, suitable for 
students viewing on a screen or whiteboard. All visual elements and text must be clearly visible 
from the back of a classroom.
`;
```

---

## 3. Alternative: More Detailed Text Guidance in Content

If you want the LLM to be more specific about what to label, use this version:

```typescript
function buildImagePromptInstructionsSection(gradeLevel: string): string {
  return `
  IMAGE PROMPT GENERATION
  
  PURPOSE & CONTEXT:
  These images will be used by teachers in classroom presentations. Each image must be a 
  standalone educational resource that visually explains the concept to students.
  
  [... structure instructions ...]
  
  TEXT AND LABELS REQUIREMENTS:
  When describing the image, specify what text and labels should appear:
  
  1. **Essential Labels**: Identify key elements that need labels (e.g., parts of a cell, 
     steps in a process, components of a system). Specify what each label should say.
  
  2. **Explanatory Text**: Include brief explanatory text when it helps understanding 
     (e.g., "Label the arrow 'Water Cycle'", "Add text 'Photosynthesis' next to the 
     plant", "Include a legend explaining the color coding").
  
  3. **Process Flow Text**: For diagrams showing processes, include directional labels 
     and step indicators (e.g., "Arrow labeled 'Step 1: Input'", "Text 'Output' at 
     the end of the process").
  
  4. **Educational Value**: Only include text/labels that directly support learning. 
     Avoid decorative text or labels that don't add educational value.
  
  Example: Instead of just "A plant cell diagram", say "A plant cell diagram with labels 
  identifying: cell wall (outer boundary), nucleus (central control center), chloroplasts 
  (green structures for photosynthesis), and mitochondria (energy production)."
  
  [... rest of instructions ...]
  `;
}
```

---

## 4. Version 1 Approach (What Worked Well)

Looking back at Version 1, here's what made it work:

### CONTENT Generation (Version 1):
```
**Content Requirements:**
- **INCLUDE TEXT AND LABELS:** The illustration SHOULD include explanatory text, 
  labels, and annotations where appropriate to enhance understanding.
```

### API Call (Version 1):
```
REQUIREMENTS:
- **INCLUDE TEXT:** The illustration SHOULD include clear, legible explanatory text, 
  labels, and annotations where appropriate to enhance understanding.

PURPOSE: This illustration will be used by a teacher in a presentation slide. It should 
be a standalone educational resource that visually explains the concept to students.
```

**Key Insight**: Version 1 had it in BOTH places:
- CONTENT: Policy/instruction (SHOULD include text/labels)
- STYLE: Visual requirements (clear, legible, appropriate)

---

## Recommended Implementation

### Best Approach: Combine Both

**CONTENT Generation:**
- Specify WHAT to label (semantic content)
- Provide examples of good label usage
- Emphasize educational value

**STYLE Guidelines:**
- Specify HOW text should look (typography)
- Set readability requirements
- Define placement rules

This gives you:
1. ✅ Clear guidance on what text/labels to include (content)
2. ✅ Consistent visual appearance of text (style)
3. ✅ High-quality, educational images (purpose-driven)
4. ✅ Readable text for classroom use (style optimization)

---

## Complete Updated Code

### `functions/src/shared/promptBuilders.ts`:

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
  
  TEXT AND LABELS:
  - Include explanatory text, labels, and annotations where they enhance understanding.
  - Specify which elements should be labeled and what the labels should say (e.g., "Label the 
    nucleus, mitochondria, and chloroplasts in the cell").
  - Include descriptive text that helps explain the concept (e.g., "Add arrows with labels 
    showing 'Water Cycle: Ocean → Evaporation → Clouds → Rain'").
  - Text should be clear, concise, and directly support the educational purpose.
  - Only include labels/text when they add educational value - avoid decorative or unnecessary text.
  
  OUTPUT FORMAT:
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}
```

### `functions/src/services/imageGeneration.ts`:

```typescript
const STYLE_GUIDELINES = `
PURPOSE: This image will be displayed in a teacher's presentation slide for classroom use.

VISUAL STYLE:
Front view, sharp focus throughout. Neutral, uniform technical lighting with no shadows. 
Clean, flat vector illustration style on a pure-white invisible background. 
Minimalist palette of 3–5 solid, high-contrast colors without gradients.

TEXT AND LABEL STYLING:
- Typography: Use large, bold, sans-serif fonts (e.g., Arial, Helvetica) for all text and labels.
- Font Size: Text must be large enough to be clearly readable from a distance (suitable for 
  classroom projection). Minimum font size equivalent to 18pt for body text, larger for headings.
- Label Placement: Position labels clearly next to or near the elements they identify. Use straight, 
  clear leader lines connecting labels to elements when needed. Avoid overlapping text with visuals.
- Contrast: Ensure text has high contrast against the background (dark text on light, light text 
  on dark elements). Text should never blend into the background.
- Legibility: All text must be crisp, clear, and easy to read. Avoid decorative fonts that reduce 
  readability. Ensure sufficient spacing between text elements.

OPTIMIZATION:
Optimized for classroom projection - high contrast, clear visibility from a distance, suitable for 
students viewing on a screen or whiteboard. All visual elements and text must be clearly visible 
from the back of a classroom.
`;

export async function generateImage(
    imagePrompt: string,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string }> {

    const finalPrompt = `${imagePrompt}\n\n${STYLE_GUIDELINES}`;
    // ... rest unchanged
}
```

---

## Summary: Where Text Instructions Belong

| Aspect | Location | Why |
|--------|----------|-----|
| **Policy**: "Include labels/text" | CONTENT Generation | Shapes WHAT the LLM describes |
| **What to label**: Specific elements | CONTENT Generation | Semantic content decisions |
| **Typography**: Font size, style | STYLE Guidelines | Visual appearance |
| **Placement**: Where text goes | STYLE Guidelines | Visual layout |
| **Readability**: Contrast, legibility | STYLE Guidelines | Visual optimization |
| **Purpose reminder**: "For classroom" | BOTH | Reinforces context |

**Answer**: Both places, but different roles:
- **CONTENT**: WHAT labels/text (semantic)
- **STYLE**: HOW text looks (visual)

This matches Version 1's successful approach!
