---
name: Refactor Image Generation Workflow
overview: Refactor the Image Generation Workflow to align with the "5 Core Components" framework from SlidesEdu-Prompt-Optimization.md. This includes updating types, enhancing the prompt builder instructions, and completely refactoring the formatter to use narrative descriptions instead of structured lists for better Gemini 3 Pro compatibility.
todos:
  - id: verify-types
    content: Verify ImageSpec type in shared/types.ts has all required fields (visualizationDynamics, environment, contextualDetails, lighting, depthOfField, framingRationale, labelPlacement, labelFont, requiresGrounding, DIAGRAM_LABELS_WITH_LEGEND)
    status: pending
  - id: verify-schemas
    content: Verify IMAGE_SPEC_SCHEMA in shared/schemas.ts matches the type definition exactly
    status: pending
  - id: enhance-prompt-builder
    content: Update buildImageSpecInstructionsSection() in shared/promptBuilders.ts to strengthen narrative instructions, enhance 5 Components enforcement, add viewpoint guidance, clarify text policy logic, and explain grounding
    status: pending
  - id: create-narrative-helpers
    content: "Create helper functions in shared/utils/imageUtils.ts: buildSubjectNarrative(), buildActionNarrative(), buildLocationNarrative(), buildLightingNarrative()"
    status: pending
  - id: refactor-composition-section
    content: Refactor formatCompositionSection() to include framingRationale and depthOfField in narrative format
    status: pending
  - id: refactor-text-policy-section
    content: Refactor formatTextPolicySection() to handle all three text policies (NO_LABELS, LIMITED_LABELS_1_TO_3, DIAGRAM_LABELS_WITH_LEGEND) with labelPlacement and labelFont
    status: pending
  - id: refactor-must-include-avoid
    content: Refactor formatMustIncludeSection() and formatAvoidSection() to use narrative sentences instead of lists
    status: pending
  - id: refactor-main-formatter
    content: Refactor formatImageSpec() to use narrative format with VISUAL SCENE DESCRIPTION section combining all helper outputs
    status: pending
  - id: update-actions-reference
    content: Replace old 'actions' field reference with 'visualizationDynamics' in formatImageSpec()
    status: pending
---

# Refactor Image Generation Workflow (Types, Prompts, and Formatting)

## Overview

This refactor aligns the image generation workflow with the "5 Core Components" framework from `SlidesEdu-Prompt-Optimization.md`. The key changes are:

1. **Type System**: Already mostly complete, but needs verification
2. **Prompt Builder**: Enhance instructions to enforce narrative style and 5 Core Components
3. **Formatter**: Complete refactor from structured lists to narrative descriptions (most critical change)

## Part 1: Verify and Update Type System

### File: `shared/types.ts`

**Current State**: The `ImageSpec` interface already includes most required fields:

- ✅ `visualizationDynamics?: string[]` (Action/Dynamics)
- ✅ `environment?: string` and `contextualDetails?: string[]` (Environment)
- ✅ `lighting?: { quality?, direction?, colorTemperature?, mood? }` (Lighting)
- ✅ `composition.depthOfField?: 'shallow' | 'deep'` and `framingRationale?: string`
- ✅ `textPolicy` includes `'DIAGRAM_LABELS_WITH_LEGEND'`
- ✅ `labelPlacement?: string` and `labelFont?: string`
- ✅ `requiresGrounding?: boolean`

**Action Required**: Verify all fields are present and correctly typed. No changes needed if already complete.

### File: `shared/schemas.ts`

**Current State**: The schema already includes most fields in `IMAGE_SPEC_SCHEMA`.

**Action Required**: Verify schema matches the type definition exactly, including all optional fields.

## Part 2: Refactor Prompt Builder Instructions

### File: `shared/promptBuilders.ts`

**Function**: `buildImageSpecInstructionsSection()`

**Current State**: Already includes some 5 Core Components guidance, but needs enhancement.

**Required Changes**:

1. **Strengthen Narrative Instruction**:

   - Add explicit instruction: "When filling out the JSON, use descriptive adjectives and verbs (narrative style) rather than single keywords. For example, use 'a translucent glass robot barista with LED eyes' instead of 'robot'."

2. **Enhance 5 Components Enforcement**:

   - Make it clear that `visualizationDynamics` is critical for teaching processes
   - Emphasize that static images don't teach processes - action must be described
   - Clarify that `environment` and `contextualDetails` create the setting
   - Explain that `lighting` sets mood and visual hierarchy

3. **Viewpoint Guidance**:

   - Expand recommendations with specific examples:
     - "Use 'isometric-3d-cutaway' for structures (buildings, molecules, organs)"
     - "Use 'side-profile' for layers/geology (rock layers, atmospheric layers)"
     - "Use 'macro-close-up' for details (cells, textures, small objects)"
     - "Use 'overhead' for maps, diagrams, and top-down views"
     - "Use 'dutch-angle' for tension, dynamics, or dramatic effect"
     - "Use 'child-eye-level' for relatable perspectives in elementary content"

4. **Text Policy Logic**:

   - Clarify when to use each option:
     - `NO_LABELS`: Default for most educational images
     - `LIMITED_LABELS_1_TO_3`: For simple diagrams where 1-3 labels improve clarity
     - `DIAGRAM_LABELS_WITH_LEGEND`: For complex charts, maps, or diagrams requiring multiple labels with a legend

5. **Grounding Instructions**:

   - Explain: "Set `requiresGrounding: true` when the image represents specific factual data (maps, charts, current events) that needs Google Search verification."

## Part 3: Refactor Formatter (Critical Change)

### File: `shared/utils/imageUtils.ts`

**Function**: `formatImageSpec()`

**Current State**: Uses structured list format with section headers (e.g., "VISUAL ELEMENTS:\n1. item1\n2. item2")

**Required Change**: Transform to narrative description format suitable for Gemini 3 Pro.

### Implementation Strategy

#### 3.1 Create Helper Functions

Replace existing section formatters with narrative builders:

1. **`buildSubjectNarrative(spec: ImageSpec): string`**

   - Combines `primaryFocal` and `subjects` into a cohesive sentence
   - Example: "A translucent glass robot barista with LED eyes, featuring a ceramic cup and latte art tools"

2. **`buildActionNarrative(spec: ImageSpec): string`**

   - Converts `visualizationDynamics` array into a descriptive sentence
   - Example: "The barista is pouring latte art into a ceramic cup, with steam rising and milk swirling"
   - Returns empty string if no dynamics provided

3. **`buildLocationNarrative(spec: ImageSpec): string`**

   - Combines `environment` and `contextualDetails` into setting description
   - Example: "Inside a cozy, cyberpunk coffee shop with neon pink and teal signage, Edison bulbs casting warm light"
   - Returns empty string if no environment provided

4. **`buildLightingNarrative(spec: ImageSpec, gradeLevel: string): string`**

   - Constructs lighting description based on `lighting` object and grade level
   - Incorporates quality, direction, colorTemperature, and mood
   - Adjusts tone based on grade level (simpler for elementary, more sophisticated for high school)
   - Example: "Illuminated by soft, golden hour light streaming through a window, creating a warm and inviting atmosphere"

#### 3.2 Main Formatting Function Structure

The new `formatImageSpec()` should:

1. **Header Section** (keep existing `formatHeaderSection`)

   - Context: Grade Level and Subject

2. **Teaching Purpose Section** (keep existing `formatTeachingPurposeSection`)

   - Educational intent

3. **VISUAL SCENE DESCRIPTION** (NEW - Main Narrative Section)

   - Start with header: "VISUAL SCENE DESCRIPTION"
   - Concatenate outputs from:
     - `buildSubjectNarrative()`
     - `buildActionNarrative()` (if present)
     - `buildLocationNarrative()` (if present)
     - `buildLightingNarrative()`
   - Format as a cohesive paragraph, not a list

4. **Composition & Technical Specs** (refactor `formatCompositionSection`)

   - Include `framingRationale` in the output
   - Format: "Viewpoint: [viewpoint] ([framingRationale]). [depthOfField] depth of field."
   - Example: "Viewpoint: Isometric-3d-cutaway (to show structural integrity and internal components). Shallow depth of field (f/1.8) focusing on the main subject."

5. **Text Strategy** (refactor `formatTextPolicySection`)

   - Handle three text policies:
     - `NO_LABELS`: "Strictly no text, labels, numbers, or legends anywhere in the image."
     - `LIMITED_LABELS_1_TO_3`: "Include ONLY these labels: [allowedLabels]. Position: [labelPlacement]. Font: [labelFont]."
     - `DIAGRAM_LABELS_WITH_LEGEND`: "Include labels: [allowedLabels] with a clear legend. Position: [labelPlacement]. Font: [labelFont]."

6. **Must Include Section** (refactor to narrative)

   - Convert from list to descriptive sentence
   - Example: "The image must prominently feature [item1], [item2], and [item3]."

7. **Colors Section** (keep but simplify)

   - Format as: "Color palette: [colors.join(', ')]."

8. **Avoid Section** (refactor to narrative)

   - Convert from list to descriptive sentence
   - Example: "Avoid including [item1], [item2], or [item3]."

9. **Negative Prompt Section** (keep existing logic)

   - Automatically add text suppression terms if `NO_LABELS`
   - Format as comma-separated list

10. **Style & Tone Section** (keep existing `formatStyleToneSection`)

#### 3.3 Final Assembly

The final prompt string should flow as a narrative description, with clear sections but written in prose rather than structured lists. The "VISUAL SCENE DESCRIPTION" section should read like a scene description from a screenplay or storyboard.

### Example Output Format

```
EDUCATIONAL VISUAL AID PROMPT
========================================

CONTEXT:
- Grade Level: 5th Grade
- Subject: Science

TEACHING PURPOSE (Why this matters):
Students will understand how water evaporates from the ocean and forms clouds.

VISUAL SCENE DESCRIPTION
A translucent glass beaker filled with blue-tinted water sits on a laboratory bench. Water molecules are evaporating from the surface, rising as visible steam particles that transform into wispy white clouds above. The scene is set in a bright, modern science classroom with large windows letting in natural daylight. The lighting is soft and even, creating clear visibility of the process while maintaining an educational, approachable atmosphere.

COMPOSITION & TECHNICAL SPECS
Viewpoint: Side-profile (to clearly show the vertical process of evaporation and cloud formation). Shallow depth of field (f/1.8) focusing on the beaker and rising steam.

TEXT STRATEGY
Strictly no text, labels, numbers, or legends anywhere in the image.

MUST INCLUDE
The image must prominently feature a glass beaker, visible water molecules, rising steam, and forming clouds.

COLORS
Color palette: Blue, white, light gray, transparent.

AVOID
Avoid including complex laboratory equipment, other students, or distracting background elements.

NEGATIVE PROMPT (Prevent these errors)
text, labels, words, lettering, typography, annotations, watermark, signature, caption, numbers, legends, blur, complex background

STYLE & TONE
- Educational illustration, suitable for textbooks or classroom slides.
- Prioritize CLARITY over decorative flair.
- Use clean lines and distinct shapes.
```

## Files to Modify

1. **`shared/types.ts`** - Verify all fields present (likely no changes)
2. **`shared/schemas.ts`** - Verify schema matches types (likely no changes)
3. **`shared/promptBuilders.ts`** - Enhance `buildImageSpecInstructionsSection()`
4. **`shared/utils/imageUtils.ts`** - Complete refactor of `formatImageSpec()` and helper functions

## Testing Considerations

- Verify that existing ImageSpec objects still format correctly
- Test with all three text policy options
- Test with and without optional fields (visualizationDynamics, environment, lighting)
- Ensure negative prompt logic still works for NO_LABELS policy
- Verify narrative flow reads naturally

## Migration Notes

- The formatter change is backward compatible - it will work with existing ImageSpec objects
- Old formatted prompts may look different, but should generate similar images
- No database migration needed - only formatting logic changes