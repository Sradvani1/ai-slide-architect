---
name: Refine Image Generation Prompting
overview: "Refine the image generation workflow based on feedback: update output format examples, improve narrative prose generation, enhance verb handling instructions, refine location/lighting descriptions, add educational safety terms, and improve overall prompt readability."
todos:
  - id: update-output-format
    content: "Update buildOutputFormatSection() in shared/promptBuilders.ts to include all new fields: visualizationDynamics, environment, contextualDetails, lighting object, depthOfField, framingRationale, labelPlacement, labelFont, requiresGrounding"
    status: pending
  - id: enhance-instructions-grounding
    content: "Enhance buildImageSpecInstructionsSection() in shared/promptBuilders.ts: Add gerund instruction for visualizationDynamics, expand grounding section with specific examples (maps, charts, timelines, scientific diagrams)"
    status: pending
  - id: improve-location-grammar
    content: Update buildLocationNarrative() in shared/utils/imageUtils.ts to use "featuring" instead of "with" for contextual details
    status: pending
  - id: simplify-grade-detection
    content: "Simplify buildLightingNarrative() in shared/utils/imageUtils.ts: Remove elementary grade filtering since app focuses on 6th-12th grade"
    status: pending
  - id: remove-fstop-jargon
    content: "Update formatCompositionSection() in shared/utils/imageUtils.ts: Replace f-stop (f/1.8) with descriptive language about blurred background and sharp focus"
    status: pending
  - id: create-narrative-helper
    content: Create buildFullNarrativeScene() helper function in shared/utils/imageUtils.ts to weave all 5 Core Components into cohesive prose paragraph
    status: pending
  - id: enhance-framing-rationale
    content: "Enhance formatCompositionSection() in shared/utils/imageUtils.ts: Add separate PEDAGOGICAL FRAMING section when framingRationale is present"
    status: pending
  - id: add-safety-terms
    content: "Update formatImageSpec() in shared/utils/imageUtils.ts: Add educational safety terms (blurry, low-resolution, etc.) to negative prompt regardless of text policy"
    status: pending
  - id: improve-separators
    content: "Update formatImageSpec() return statement in shared/utils/imageUtils.ts: Add horizontal rule separators (---) between major sections for better readability"
    status: pending
  - id: simplify-verb-conjugation
    content: "Simplify buildActionNarrative() in shared/utils/imageUtils.ts: Remove conjugation logic since LLM is instructed to provide gerunds"
    status: pending
---

# Refine Image Generation Prompting - Implementation Plan

## Overview

This plan implements feedback recommendations to refine the image generation prompting system. The changes focus on improving prompt clarity, narrative quality, and ensuring all new fields are properly documented and utilized.

## Part 1: Update buildOutputFormatSection() - Include All New Fields

### File: `shared/promptBuilders.ts`

**Current Issue**: The example JSON structure in `buildOutputFormatSection()` (lines 126-149) only shows basic fields and doesn't include the new 5 Core Components fields.

**Changes Required**:

Update the `imageSpec` example in `buildOutputFormatSection()` to include:

- `visualizationDynamics` (array)
- `environment` (string)
- `contextualDetails` (array)
- `lighting` (object with quality, direction, colorTemperature, mood)
- `composition.depthOfField` (string)
- `composition.framingRationale` (string)
- `labelPlacement` (string)
- `labelFont` (string)
- `requiresGrounding` (boolean)

**Implementation**:

```typescript
function buildOutputFormatSection(): string {
  return `
  OUTPUT FORMAT
  Return a valid JSON array of objects. Do not include markdown code fences (like \`\`\`json).
  JSON Structure:
  [
    {
      "title": "string",
      "content": ["string", "string", ...], 
      "layout": "Title Slide" | "Content",
      "imageSpec": {
        "primaryFocal": "string",
        "conceptualPurpose": "string",
        "subjects": ["string"],
        "visualizationDynamics": ["string"],
        "environment": "string",
        "contextualDetails": ["string"],
        "mustInclude": ["string"],
        "avoid": ["string"],
        "composition": {
          "layout": "string",
          "viewpoint": "string",
          "whitespace": "string",
          "depthOfField": "shallow" | "deep",
          "framingRationale": "string"
        },
        "lighting": {
          "quality": "string",
          "direction": "string",
          "colorTemperature": "string",
          "mood": "string"
        },
        "textPolicy": "string",
        "allowedLabels": ["string"],
        "labelPlacement": "string",
        "labelFont": "string",
        "requiresGrounding": boolean,
        "colors": ["string"],
        "negativePrompt": ["string"]
      }, 
      "speakerNotes": "string (Script only)",
      "sources": ["url1", "url2"]
    }
  ]
  `;
}
```

## Part 2: Enhance buildImageSpecInstructionsSection() - Add Grounding Examples

### File: `shared/promptBuilders.ts`

**Current Issue**: The grounding section (line 117-118) mentions `requiresGrounding` but doesn't provide clear examples of when to use it.

**Changes Required**:

1. Expand the Grounding section with specific examples
2. Add instruction for LLM to always provide `visualizationDynamics` as gerunds

**Implementation**:

Update `buildImageSpecInstructionsSection()` around lines 89-120:

```typescript
function buildImageSpecInstructionsSection(): string {
  return `
  IMAGE VISUAL SPECIFICATION (imageSpec)
  You must output an \`imageSpec\` object for each slide. This object will be converted into a rich narrative AI image generation prompt.

  TEACHING GOAL:
  - The image must teach a specific concept, not just decorate the slide.
  - Define a \`conceptualPurpose\`: What should the student understand from this image?

  INSTRUCTIONS: Use descriptive adjectives and verbs (narrative style) rather than single keywords.
  EXAMPLE: Instead of "robot", use "a translucent glass robot barista with LED eyes".
  EXAMPLE: Instead of "evaporating", use "water molecules evaporating from the surface, rising as visible steam".

  CRITICAL: When specifying \`visualizationDynamics\`, always use the gerund (verb+ing) form:
  - "evaporating" (not "evaporate")
  - "colliding" (not "collide")
  - "flowing" (not "flow")
  - "dividing" (not "divide")
  - "reacting" (not "react")
  This ensures the narrative flows naturally.

  5 CORE COMPONENTS (Required):
  1. SUBJECT: \`primaryFocal\` and \`subjects\`. The main visual elements.
  2. ACTION/DYNAMICS: \`visualizationDynamics\`. Describe processes (e.g., "evaporating", "colliding", "flowing"). Static images do not teach processes; describe the action!
  3. ENVIRONMENT: \`environment\` (setting) and \`contextualDetails\`. Where is this happening?
  4. LIGHTING: \`lighting\` object. Set the mood, quality (e.g. "soft", "dramatic"), and direction.
  5. COMPOSITION: \`composition\` object. Layout and viewpoint.

  imageSpec rules details:
  - \`conceptualPurpose\`: REQUIRED. explicit pedagogical goal.
  - \`visualizationDynamics\`: Array of strings describing movement/change. MUST be gerunds (ending in -ing).
  - \`environment\`: The specific setting.
  - \`contextualDetails\`: Additional environmental details that enhance the scene.
  - \`mustInclude\`: 2–6 critical details to include.
  - \`avoid\`: List distracting elements to exclude.
  - Composition:
    - \`layout\`: "single-focal-subject-centered", "balanced-pair", "comparison-split-screen", "diagram-with-flow", "simple-sequence-2-panel".
    - \`viewpoint\`: Use professional camera terminology:
      - "isometric-3d-cutaway" for structures (buildings, molecules, organs)
      - "side-profile" for layers/geology (rock layers, atmospheric layers)
      - "macro-close-up" for details (cells, textures) - specify "shallow depth of field"
      - "overhead" or "bird's-eye-view" for maps, diagrams, top-down views
      - "dutch-angle" for tension, dynamics, or dramatic effect
      - "child-eye-level" for relatable perspectives in elementary content
    - \`depthOfField\`: "shallow" (focus on subject) or "deep" (context).
    - \`framingRationale\`: Briefly explain why this viewpoint helps the educational goal.
  - Text policy:
    - Default: "NO_LABELS". Choose this unless text labels improve learning.
    - "LIMITED_LABELS_1_TO_3": For simple diagrams. Requires \`allowedLabels\`.
    - "DIAGRAM_LABELS_WITH_LEGEND": For complex charts. Requires \`allowedLabels\`.
    - When labels are used, specify \`labelPlacement\` (e.g., "next to arrows", "below each element") and \`labelFont\` (e.g., "bold sans-serif", "Arial").
  - Grounding:
    - \`requiresGrounding\`: Set to true ONLY for images that represent specific factual data requiring verification:
      * Maps that must show current/accurate geography
      * Charts with specific data (election results, weather forecasts, stock prices)
      * Timeline visualizations with factual dates
      * Scientific diagrams with current research accuracy
    - Examples:
      * "Visualize the 2025 solar cycle" → requiresGrounding: true
      * "A fantasy dragon in a medieval castle" → requiresGrounding: false
      * "Current population density map of Africa" → requiresGrounding: true
      * "Abstract representation of photosynthesis" → requiresGrounding: false
  - Colors: 3–5 high-contrast colors.
  - negativePrompt: list failure modes (e.g., "blur", "text", "complex background").

  Output a valid JSON object.
  `;
}
```

## Part 3: Improve buildLocationNarrative() Grammar

### File: `shared/utils/imageUtils.ts`

**Current Issue**: Line 43 uses `parts.join(' with ')` which produces awkward grammar like "inside ocean with temperature gradients and pressure zones".

**Changes Required**:

Improve the grammar to use "featuring" for contextual details, producing more natural prose.

**Implementation**:

Replace `buildLocationNarrative()` function (lines 37-44):

```typescript
function buildLocationNarrative(spec: ImageSpec): string {
    const parts = [];
    if (spec.environment) parts.push(spec.environment);
    if (spec.contextualDetails && spec.contextualDetails.length > 0) {
        parts.push(`featuring ${spec.contextualDetails.join(', ')}`);
    }
    return parts.length > 0 ? parts.join(', ') : '';
}
```

This produces: "ocean, featuring temperature gradients and pressure zones" instead of "ocean with temperature gradients and pressure zones".

## Part 4: Simplify Grade Level Detection (6th-12th Grade Focus)

### File: `shared/utils/imageUtils.ts`

**Current Issue**: The grade level detection (lines 51-68) includes elementary grade logic, but the app focuses on 6th-12th grade.

**Changes Required**:

Simplify the logic since we don't need to filter out complex lighting terms for elementary grades. However, keep the detection logic for potential future use, but remove the filtering of `colorTemperature` for elementary grades.

**Implementation**:

Update `buildLightingNarrative()` function (lines 46-87):

```typescript
function buildLightingNarrative(spec: ImageSpec, gradeLevel: string): string {
    if (!spec.lighting) return '';
    const l = spec.lighting;
    const parts = [];

    // Note: App focuses on 6th-12th grade, so all lighting details are appropriate
    if (l.quality && l.direction) {
        parts.push(`${l.quality} ${l.direction} lighting`);
    } else if (l.quality) {
        parts.push(`${l.quality} lighting`);
    } else if (l.direction) {
        parts.push(`${l.direction} lighting`);
    }

    if (l.colorTemperature) {
        parts.push(`${l.colorTemperature} color temperature`);
    }

    if (l.mood) {
        parts.push(`creating a ${l.mood} atmosphere`);
    }

    return parts.length > 0 ? `Illuminated by ${parts.join(', ')}.` : '';
}
```

## Part 5: Remove Technical F-Stop Jargon

### File: `shared/utils/imageUtils.ts`

**Current Issue**: Line 105 includes "(f/1.8)" which is technical photography jargon not helpful for image generation models.

**Changes Required**:

Replace f-stop reference with descriptive language about the visual effect.

**Implementation**:

Update `formatCompositionSection()` function (lines 91-114):

```typescript
function formatCompositionSection(spec: ImageSpec): string {
    const c = spec.composition;
    let description = `${c.viewpoint.replace(/-/g, ' ')} shot`;

    if (c.layout !== 'single-focal-subject-centered') {
        description += `, ${c.layout.replace(/-/g, ' ')} composition`;
    }

    if (c.whitespace === 'generous') {
        description += ', generous negative space for text overlay';
    }

    if (c.depthOfField) {
        if (c.depthOfField === 'shallow') {
            description += ', shallow depth of field with blurred background to emphasize the subject';
        } else {
            description += ', deep depth of field with sharp focus throughout';
        }
    }

    if (c.framingRationale) {
        description += `. ${c.framingRationale}`;
    }

    return `COMPOSITION & CAMERA ANGLE:
${description}.`;
}
```

## Part 6: Create buildFullNarrativeScene() Helper

### File: `shared/utils/imageUtils.ts`

**Current Issue**: The current approach concatenates components, but could produce more sophisticated prose.

**Changes Required**:

Create a new helper function that weaves all 5 Core Components into a single cohesive prose paragraph.

**Implementation**:

Add new function after `buildLightingNarrative()` (around line 88):

```typescript
/**
 * Builds a cohesive narrative scene description weaving all 5 Core Components
 * into a single flowing prose paragraph.
 */
function buildFullNarrativeScene(spec: ImageSpec, ctx: FormatContext): string {
    const subjectPart = buildSubjectNarrative(spec);
    const actionPart = buildActionNarrative(spec);
    const locationPart = buildLocationNarrative(spec);
    const lightingPart = buildLightingNarrative(spec, ctx.gradeLevel);

    // Start with subject
    let narrative = subjectPart;

    // Integrate action naturally
    if (actionPart) {
        // If subject doesn't already imply action, add it
        narrative += ` ${actionPart}`;
    }

    // Add location context
    if (locationPart) {
        narrative += ` inside ${locationPart}`;
    }

    // Ensure proper punctuation before lighting
    if (!narrative.endsWith('.')) {
        narrative += '.';
    }

    // Add lighting as a separate sentence for clarity
    if (lightingPart) {
        narrative += ` ${lightingPart}`;
    } else if (!narrative.endsWith('.')) {
        narrative += '.';
    }

    return narrative;
}
```

Then update `formatImageSpec()` to use this helper (replace lines 165-188):

```typescript
// 2. Build Narrative Scene (Cohesive Paragraph)
const visualSceneDescription = buildFullNarrativeScene(spec, ctx);
```

## Part 7: Enhance FramingRationale Prominence

### File: `shared/utils/imageUtils.ts`

**Current Issue**: `framingRationale` is just appended to the composition description, but for educational images it should be more prominent.

**Changes Required**:

Add a dedicated "PEDAGOGICAL FRAMING" section when `framingRationale` is present.

**Implementation**:

Update `formatCompositionSection()` to include a separate section for framing rationale:

```typescript
function formatCompositionSection(spec: ImageSpec): string {
    const c = spec.composition;
    let description = `${c.viewpoint.replace(/-/g, ' ')} shot`;

    if (c.layout !== 'single-focal-subject-centered') {
        description += `, ${c.layout.replace(/-/g, ' ')} composition`;
    }

    if (c.whitespace === 'generous') {
        description += ', generous negative space for text overlay';
    }

    if (c.depthOfField) {
        if (c.depthOfField === 'shallow') {
            description += ', shallow depth of field with blurred background to emphasize the subject';
        } else {
            description += ', deep depth of field with sharp focus throughout';
        }
    }

    let compositionSection = `COMPOSITION & CAMERA ANGLE:
${description}.`;

    // Add pedagogical framing as separate section if present
    if (c.framingRationale) {
        compositionSection += `\n\nPEDAGOGICAL FRAMING:
This ${c.viewpoint.replace(/-/g, ' ')} viewpoint is chosen because: ${c.framingRationale}`;
    }

    return compositionSection;
}
```

## Part 8: Add Educational Safety Terms to Negative Prompt

### File: `shared/utils/imageUtils.ts`

**Current Issue**: Only text suppression terms are added for `NO_LABELS` policy, but educational content should always avoid common failure modes.

**Changes Required**:

Add educational safety terms to the negative prompt regardless of text policy.

**Implementation**:

Update `formatImageSpec()` function (lines 148-163):

```typescript
export function formatImageSpec(spec: ImageSpec, ctx: FormatContext): string {
    // 1. Negative Prompt Logic (Strict Text Suppression + Educational Safety)
    let negativePrompt = spec.negativePrompt ? [...spec.negativePrompt] : [];
    const isNoLabels = spec.textPolicy === 'NO_LABELS';

    // Add text suppression terms if NO_LABELS
    if (isNoLabels) {
        const textSuppressionTerms = [
            'text', 'labels', 'words', 'lettering', 'typography',
            'annotations', 'watermark', 'signature', 'caption',
            'numbers', 'legends', 'text overlay', 'written text'
        ];

        textSuppressionTerms.forEach(term => {
            if (!negativePrompt.includes(term)) negativePrompt.push(term);
        });
    }

    // Always add educational safety terms (regardless of textPolicy)
    const educationalSafetyTerms = [
        'blurry', 'low-resolution', 'pixelated', 'distorted',
        'overexposed', 'completely dark', 'confusing', 'cluttered'
    ];

    educationalSafetyTerms.forEach(term => {
        if (!negativePrompt.includes(term)) negativePrompt.push(term);
    });

    // ... rest of function
}
```

## Part 9: Improve Output Formatting Readability

### File: `shared/utils/imageUtils.ts`

**Current Issue**: Section separation uses `\n\n` which works but could be clearer.

**Changes Required**:

Add visual separators between major sections for better readability.

**Implementation**:

Update the final return statement in `formatImageSpec()` (line 232):

```typescript
return sections
    .filter(section => section.trim().length > 0)
    .map((section, idx) => idx > 0 ? `\n\n---\n\n${section}` : section)
    .join('');
```

This adds a horizontal rule separator between sections for visual clarity.

## Part 10: Remove Verb Conjugation Logic (LLM Provides Gerunds)

### File: `shared/utils/imageUtils.ts`

**Current Issue**: The verb conjugation logic (lines 22-32) tries to handle various verb forms, but since we're instructing the LLM to provide gerunds, this logic is unnecessary.

**Changes Required**:

Simplify `buildActionNarrative()` to trust that the LLM provides gerunds as instructed.

**Implementation**:

Replace `buildActionNarrative()` function (lines 18-35):

```typescript
function buildActionNarrative(spec: ImageSpec): string {
    if (!spec.visualizationDynamics || spec.visualizationDynamics.length === 0) return '';
    
    // LLM is instructed to provide gerunds (ending in -ing), so we can trust the input
    // Just join them naturally
    return spec.visualizationDynamics.join(' and ');
}
```

## Summary of Changes

1. **buildOutputFormatSection()**: Add all new fields to example JSON structure
2. **buildImageSpecInstructionsSection()**: Add gerund instruction and grounding examples
3. **buildLocationNarrative()**: Improve grammar using "featuring" instead of "with"
4. **buildLightingNarrative()**: Simplify for 6th-12th grade focus (remove elementary filtering)
5. **formatCompositionSection()**: Remove f-stop jargon, add descriptive language, enhance framingRationale
6. **buildFullNarrativeScene()**: New helper for cohesive prose (optional - user selected this approach)
7. **formatImageSpec()**: Add educational safety terms, improve section separators
8. **buildActionNarrative()**: Simplify since LLM provides gerunds

## Files to Modify

1. `shared/promptBuilders.ts` - Update `buildImageSpecInstructionsSection()` and `buildOutputFormatSection()`
2. `shared/utils/imageUtils.ts` - Update multiple helper functions and main formatter

## Testing Considerations

- Verify narrative prose flows naturally
- Check that all new fields appear in output format example
- Confirm grounding examples are clear
- Test that educational safety terms are added
- Verify section separators improve readability