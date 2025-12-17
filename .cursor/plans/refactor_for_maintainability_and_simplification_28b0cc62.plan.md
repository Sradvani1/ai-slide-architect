---
name: Refactor for Maintainability and Simplification
overview: Refactor the slide and image generation codebase to improve maintainability by extracting reusable functions, consolidating duplicate code, and breaking down complex functions into smaller, testable units. All changes maintain backward compatibility and do not alter functionality.
todos:
  - id: extract-schema
    content: Extract IMAGE_SPEC_SCHEMA constant at module level in geminiService.ts, replace both duplicate definitions (lines 455 and 996) with references to the constant
    status: pending
  - id: create-normalize
    content: Create normalizeImageSpec() function in imageUtils.ts that combines sanitize and validate, returning spec + warnings
    status: pending
  - id: update-prepareSpecForSave
    content: Update prepareSpecForSave() in imageUtils.ts to use normalizeImageSpec() instead of separate sanitize/validate calls
    status: pending
  - id: update-generateSlides
    content: Update generateSlidesFromDocument() to use normalizeImageSpec() for processing slides (around line 815-836)
    status: pending
  - id: update-regenerateSpec
    content: Update regenerateImageSpec() to use normalizeImageSpec() (around line 1061-1069)
    status: pending
  - id: extract-prompt-builders
    content: Create build*Section() functions and buildSlideGenerationPrompt() in geminiService.ts, extract all prompt building logic from generateSlidesFromDocument()
    status: pending
  - id: refactor-prompt-usage
    content: Replace string concatenation in generateSlidesFromDocument() (lines 360-449) with call to buildSlideGenerationPrompt(), remove duplicate output format section
    status: pending
  - id: extract-format-sections
    content: Create format*Section() helper functions in imageUtils.ts for each section of the image prompt (header, teaching purpose, visual elements, etc.)
    status: pending
  - id: refactor-formatImageSpec
    content: Refactor formatImageSpec() in imageUtils.ts to use the extracted format*Section() functions instead of large template string
    status: pending
  - id: extract-model-constants
    content: Extract model name strings to constants (MODEL_SLIDE_GENERATION, MODEL_IMAGE_GENERATION, MODEL_SPEC_REGENERATION) and update all model references
    status: pending
---

# Codebase Simplification and Maintainability Refactor

## Executive Summary

This refactor improves code maintainability by extracting reusable functions, eliminating code duplication, and breaking down complex monolithic functions into smaller, testable units. All changes are non-breaking and maintain existing functionality.

## Goals

1. **Eliminate Code Duplication**: Consolidate duplicate schema definitions
2. **Improve Modularity**: Extract prompt building into reusable functions
3. **Enhance Testability**: Break down large functions into smaller, testable units
4. **Maintain Backward Compatibility**: No breaking changes to APIs or behavior
5. **Preserve Functionality**: All existing behavior remains unchanged

---

## Phase 1: Extract and Consolidate Schema Definitions

### Problem

The `imageSpecSchema` is defined twice in `geminiService.ts`:

- Line 455: Used in `generateSlidesFromDocument()` with string type values
- Line 996: Used in `regenerateImageSpec()` with `SchemaType` enum values

These duplicate definitions can drift apart and are harder to maintain.

### Solution

Extract schema definitions to module-level constants at the top of `geminiService.ts`, using a format compatible with both use cases.

### Implementation

#### File: `src/services/geminiService.ts`

**Location:** Add schema constants near the top, after imports and before function definitions (around line 95, after `rateLimiter`)

**Changes:**

1. **Extract ImageSpec Schema Constant** (new section after line 94):
```typescript
/**
 * ImageSpec JSON Schema for Gemini structured output
 * Used for both slide generation and spec regeneration
 */
const IMAGE_SPEC_SCHEMA = {
  type: "object",
  properties: {
    primaryFocal: { 
      type: "string", 
      description: "One-sentence description of the main visual subject." 
    },
    conceptualPurpose: { 
      type: "string", 
      description: "The educational goal: what concept should the student understand from this image?" 
    },
    subjects: {
      type: "array",
      items: { type: "string" },
      description: "2-5 concrete visual elements.",
    },
    actions: {
      type: "array",
      items: { type: "string" },
      description: "0-3 interactions or movements.",
    },
    mustInclude: {
      type: "array",
      items: { type: "string" },
      description: "2-6 essential details.",
    },
    avoid: {
      type: "array",
      items: { type: "string" },
      description: "Elements to exclude to prevent confusion.",
    },
    composition: {
      type: "object",
      properties: {
        layout: {
          type: "string",
          enum: [
            "single-focal-subject-centered",
            "balanced-pair",
            "simple-sequence-2-panel",
            "comparison-split-screen",
            "diagram-with-flow",
          ],
        },
        viewpoint: {
          type: "string",
          enum: [
            "front",
            "three-quarter",
            "side",
            "overhead",
            "child-eye-level",
            "side-profile",
            "isometric-3d-cutaway",
          ],
        },
        whitespace: {
          type: "string",
          enum: ["generous", "moderate"],
        },
      },
      required: ["layout", "viewpoint", "whitespace"],
    },
    textPolicy: {
      type: "string",
      enum: ["NO_LABELS", "LIMITED_LABELS_1_TO_3"],
    },
    allowedLabels: {
      type: "array",
      items: { type: "string" },
    },
    colors: {
      type: "array",
      items: { type: "string" },
      description: "3-5 key colors.",
    },
    negativePrompt: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "primaryFocal",
    "conceptualPurpose",
    "subjects",
    "mustInclude",
    "avoid",
    "composition",
    "textPolicy",
  ],
};
```

2. **Update `generateSlidesFromDocument()`** (around line 454-539):

**Remove:** The entire `const imageSpecSchema = { ... }` definition (lines 455-539)

**Replace with:** Direct reference to `IMAGE_SPEC_SCHEMA`

   ```typescript
   const slidesSchema = {
     type: "array",
     items: {
       type: "object",
       properties: {
         title: { type: "string" },
         content: {
           type: "array",
           items: { type: "string" }
         },
         layout: {
           type: "string",
           enum: ["Title Slide", "Content"]
         },
         imageSpec: IMAGE_SPEC_SCHEMA,  // Use extracted constant
         speakerNotes: {
           type: "string",
           description: "Conversational script explaining the slide content. **IMPORTANT:** At the very end, add a section titled 'Sources:'. List full URLs of websites used or filenames of uploaded documents. If only general knowledge is used, omit this section."
         },
         sources: {
           type: "array",
           items: { type: "string" },
           description: "List of source URLs used for this slide if web search was enabled."
         },
       },
       required: ["title", "content", "layout", "speakerNotes"],
     },
   };
   ```

3. **Update `regenerateImageSpec()`** (around line 996-1020):

**Remove:** The entire `const imageSpecSchema = { ... }` definition and `SchemaType` enum (lines 984-1020)

**Replace with:** Direct reference to `IMAGE_SPEC_SCHEMA`

   ```typescript
   try {
     const result = await ai.models.generateContent({
       model: "gemini-2.5-pro",
       contents: [{ role: 'user', parts: [{ text: prompt }] }],
       config: {
         responseMimeType: "application/json",
         responseSchema: IMAGE_SPEC_SCHEMA,  // Use extracted constant
         temperature: safeTemp,
       } as any
     });
   ```

**Benefits:**

- Single source of truth for ImageSpec schema
- Easier to maintain and update
- Reduces ~65 lines of duplicate code
- Prevents schema drift between functions

---

## Phase 2: Extract Prompt Building Functions

### Problem

The prompt building in `generateSlidesFromDocument()` (lines 360-449) is a large string concatenation that's hard to maintain, test, and modify.

### Solution

Extract prompt building into separate, well-named functions that can be tested independently.

### Implementation

#### File: `src/services/geminiService.ts`

**Location:** Add prompt building functions after the schema constants, before `generateSlidesFromDocument()` (around line 540)

**Changes:**

1. **Create Prompt Building Functions** (new section):
```typescript
/**
 * Prompt building functions for slide generation
 * Each function builds a specific section of the prompt
 */

function buildSystemRoleSection(): string {
  return `
    You are an expert educational content creator and curriculum designer.
    Your goal is to generate a professional, engaging slide deck that is perfectly tailored to the specified grade level.
  `;
}

function buildInputContextSection(
  topic: string,
  subject: string,
  gradeLevel: string,
  totalSlides: number,
  numSlides: number,
  additionalInstructions?: string
): string {
  return `
  PRESENTATION CONTEXT
  Topic: "${topic}"
  Subject: ${subject}
  Target Audience: ${gradeLevel}
  Length: ${totalSlides} slides (1 Title + ${numSlides} Content)
  ${additionalInstructions ? `- Additional Instructions: "${additionalInstructions}"` : ''}
  `;
}

function buildSourceMaterialSection(sourceMaterial: string, useWebSearch: boolean): string {
  if (sourceMaterial) {
    return `
    SOURCE MATERIAL (GROUND TRUTH)
      You must derive your content ENTIRELY from the following text. Do not contradict it.
    
    SOURCE BEGIN:
    ${sourceMaterial}
    SOURCE END
  `;
  } else if (useWebSearch) {
    return `
    RESEARCH PHASE (REQUIRED)
    Since no source material is provided, you MUST use Google Search to act as the primary content researcher.
    
    INSTRUCTIONS
    1. Find Content: Search for high-quality, age-appropriate information to build the core content of these slides.
    2. Curate Sources: Select the best, most reliable references (URLs) that a teacher would value.
    3. Synthesize: Use these search results as the SOLE source of truth for the presentation.
    `;
  }
  return '';
}

function buildContentStandardsSection(): string {
  return `
  CONTENT STANDARDS
    1. Educational Value: Content must be accurate, age-appropriate, and pedagogically sound.
    2. Clarity: Use clear, concise language.
    3. Engagement: Speaker notes should be engaging and conversational (script format).
    4. Citations: You MUST include a "Sources:" section at the very end of the speaker notes. List all used URLs (if Web Search) or filenames (if uploaded text).
  `;
}

function buildStructureRequirementsSection(totalSlides: number, subject: string, gradeLevel: string): string {
  return `
  STRUCTURE REQUIREMENTS
    - Slide 1: Title Slide. "title": Presentation Title. "content" array must be: ["<tagline>", "${subject}", "${gradeLevel}"]. (No imageSpec required).
    - Slides 2-${totalSlides}: Content Slides (Title, Content, ImageSpec, Speaker Notes, Sources).
  `;
}

function buildFormattingConstraintsSection(bulletsPerSlide: number): string {
  return `
  FORMATTING CONSTRAINTS(CRITICAL)
    - Bullets: Exactly ${bulletsPerSlide} bullet points per content slide.
    - No Markdown: Bullet points must be plain strings. NO bold (**), italics (*), or bullet characters (-) in the string itself.
  `;
}

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
    - Default: "NO_LABELS". Choose this unless text labels significantly improve learning.
    - "LIMITED_LABELS_1_TO_3": Use for diagrams where parts need names.
      - CONTRACT: If you choose this, you MUST provide 1-3 distinct strings in \`allowedLabels\`.
      - If \`allowedLabels\` is empty, the system will FORCE "NO_LABELS".
  - Colors: 3–5 high-contrast colors.
  - negativePrompt: list failure modes (e.g., "blur", "text", "complex background").

  Output a valid JSON object.
  `;
}

function buildOutputFormatSection(): string {
  return `
  OUTPUT FORMAT
  Return a valid JSON array of objects.Do not include markdown code fences(like \`\`\`json).
  JSON Structure:
  [
    {
      "title": "string",
      "content": ["string", "string", ...], 
      "layout": "Title Slide" | "Content",
      "imageSpec": {
        "primaryFocal": "string",
        "subjects": ["string"],
        "mustInclude": ["string"],
        "avoid": ["string"],
        "composition": { "layout": "string", "viewpoint": "string", "whitespace": "string" },
        "textPolicy": "string"
      }, 
      "speakerNotes": "string (Script + 'Sources:' section at the end with URLs/filenames)",
      "sources": ["url1", "url2"]
    }
  ]
  `;
}

/**
 * Builds the complete prompt for slide generation
 */
function buildSlideGenerationPrompt(
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
    buildImageSpecInstructionsSection(),
  ];

  if (includeOutputFormat) {
    sections.push(buildOutputFormatSection());
  }

  return sections.filter(section => section.trim().length > 0).join('\n');
}
```

2. **Refactor `generateSlidesFromDocument()`** (replace lines 360-449):

**Replace:**

   ```typescript
   // 1. SYSTEM ROLE & OBJECTIVE
   let prompt = `...`;
   
   // 2. INPUT CONTEXT
   prompt += `...`;
   
   // ... (all the string concatenation)
   ```

**With:**

   ```typescript
   // Build the complete prompt using extracted functions
   const prompt = buildSlideGenerationPrompt(
     topic,
     subject,
     gradeLevel,
     totalSlides,
     numSlides,
     sourceMaterial,
     useWebSearch,
     bulletsPerSlide,
     additionalInstructions,
     isUsingWebSearchTool // Include output format instructions for web search mode
   );
   ```

3. **Update output format handling** (around line 588-610):

**Current code:**

   ```typescript
   if (isUsingWebSearchTool) {
     prompt += `
     OUTPUT FORMAT
     ...
     `;
   }
   ```

**Replace with:** The `includeOutputFormat` parameter already handles this in `buildSlideGenerationPrompt()`, so this section can be removed entirely.

**Benefits:**

- Each prompt section is independently testable
- Easier to modify individual sections
- Clearer code organization
- Reusable prompt building logic

---

## Phase 3: Break Down formatImageSpec Function

### Problem

The `formatImageSpec()` function (lines 278-380 in `imageUtils.ts`) is a large template string with complex conditional logic, making it hard to maintain and test individual sections.

### Solution

Break down the function into smaller, focused functions that format individual sections.

### Implementation

#### File: `src/utils/imageUtils.ts`

**Location:** Add helper functions before `formatImageSpec()`, around line 275

**Changes:**

1. **Create Section Formatting Functions** (new section before `formatImageSpec()`):
```typescript
/**
 * Helper functions for formatting ImageSpec prompt sections
 */

function formatHeaderSection(ctx: FormatContext): string {
  return `EDUCATIONAL VISUAL AID PROMPT
${'='.repeat(40)}

CONTEXT:
- Grade Level: ${ctx.gradeLevel}
- Subject: ${ctx.subject}`;
}

function formatTeachingPurposeSection(conceptualPurpose?: string): string {
  return `
TEACHING PURPOSE (Why this matters):
${conceptualPurpose || 'Provide a visual aid for the concept.'}`;
}

function formatPrimaryVisualConceptSection(primaryFocal: string): string {
  return `
PRIMARY VISUAL CONCEPT:
${primaryFocal}`;
}

function formatVisualElementsSection(subjects: string[]): string {
  return `
VISUAL ELEMENTS (Concrete objects):
${subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

function formatActionsSection(actions: string[]): string {
  if (actions.length === 0) return '';
  return `
ACTIONS / INTERACTIONS:
${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}
`;
}

function formatMustIncludeSection(mustInclude: string[]): string {
  return `
MUST INCLUDE (Critical details):
${mustInclude.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
}

function formatCompositionSection(composition: ImageSpec['composition']): string {
  return `
COMPOSITION & LAYOUT:
- Layout: ${composition.layout}
- Viewpoint: ${composition.viewpoint}
- Whitespace: ${composition.whitespace} (keep clean for text overlay)
- Background: Minimal/Plain (standard educational style)`;
}

function formatTextPolicySection(
  textPolicy: ImageTextPolicy,
  allowedLabels: string[],
  isNoLabels: boolean
): string {
  const section = `
TEXT POLICY:`;
  
  if (isNoLabels) {
    return `${section}
- STRICTLY NO TEXT: No letters, numbers, labels, legends, or watermarks anywhere in the image.`;
  } else {
    return `${section}
- Include ONLY these labels: ${allowedLabels.join(', ')}.
- Use large, legible font.`;
  }
}

function formatColorsSection(colors: string[]): string {
  const section = `
COLORS (Semantic & High Contrast):`;
  
  if (colors.length > 0) {
    return `${section}
- Use this palette: ${colors.join(', ')}`;
  } else {
    return `${section}
- Use high-contrast primary colors suitable for classroom projection.`;
  }
}

function formatAvoidSection(avoid: string[]): string {
  return `
AVOID (Distractions):
${avoid.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
}

function formatNegativePromptSection(finalNegativePrompt: string[]): string {
  return `
NEGATIVE PROMPT (Prevent these errors):
${finalNegativePrompt.join(', ')}`;
}

function formatStyleToneSection(): string {
  return `
STYLE & TONE:
- Educational illustration, suitable for textbooks or classroom slides.
- Prioritize CLARITY over decorative flair.
- Use clean lines and distinct shapes.`;
}
```

2. **Refactor `formatImageSpec()` function** (replace lines 278-380):

**Replace the entire function body with:**

   ```typescript
   export function formatImageSpec(spec: ImageSpec, ctx: FormatContext): string {
       const {
           primaryFocal,
           conceptualPurpose,
           subjects,
           actions = [],
           mustInclude,
           avoid,
           composition,
           textPolicy,
           allowedLabels = [],
           colors = [],
           negativePrompt = [],
       } = spec;
   
       // Detect if we need strong text suppression
       const effectivePolicy = (textPolicy === 'LIMITED_LABELS_1_TO_3' && (!allowedLabels || allowedLabels.length === 0))
           ? 'NO_LABELS'
           : textPolicy;
   
       const isNoLabels = effectivePolicy === 'NO_LABELS';
   
       // Build negative prompt with text suppression logic
       const textSuppressionTerms = [
           'text', 'labels', 'words', 'lettering', 'typography',
           'annotations', 'watermark', 'signature', 'caption', 'numbers', 'legends'
       ];
   
       let finalNegativePrompt: string[];
       if (isNoLabels) {
           finalNegativePrompt = [...new Set([...negativePrompt, ...textSuppressionTerms])];
       } else {
           finalNegativePrompt = negativePrompt.filter(term => !textSuppressionTerms.includes(term.toLowerCase()));
       }
   
       // Build prompt sections
       const sections = [
           formatHeaderSection(ctx),
           formatTeachingPurposeSection(conceptualPurpose),
           formatPrimaryVisualConceptSection(primaryFocal),
           formatVisualElementsSection(subjects),
           formatActionsSection(actions),
           formatMustIncludeSection(mustInclude),
           formatCompositionSection(composition),
           formatTextPolicySection(textPolicy, allowedLabels, isNoLabels),
           formatColorsSection(colors),
           formatAvoidSection(avoid),
           formatNegativePromptSection(finalNegativePrompt),
           formatStyleToneSection(),
       ];
   
       return sections.filter(section => section.trim().length > 0).join('\n');
   }
   ```

**Benefits:**

- Each section can be tested independently
- Easier to modify individual sections
- Clearer code organization
- Easier to add/remove sections

---

## Phase 4: Simplify Spec Normalization Pattern

### Problem

The pattern of validate → sanitize → validate again appears in multiple places, and the logic is scattered between `prepareSpecForSave()` and individual call sites.

### Solution

Create a single `normalizeImageSpec()` function that handles both validation and sanitization, returning both the normalized spec and any warnings.

### Implementation

#### File: `src/utils/imageUtils.ts`

**Location:** Add new function after `sanitizeImageSpec()`, around line 268

**Changes:**

1. **Create `normalizeImageSpec()` function** (new function):
```typescript
/**
 * Normalizes an ImageSpec by sanitizing and validating it.
 * Returns the normalized spec along with any validation warnings.
 * This is the single entry point for spec normalization.
 */
export function normalizeImageSpec(
  spec: ImageSpec,
  gradeLevel: string
): {
  spec: ImageSpec;
  warnings: string[];
} {
  // Sanitize first (clamps arrays, fills defaults, enforces contracts)
  const sanitized = sanitizeImageSpec(spec, gradeLevel);
  
  // Validate the sanitized spec
  const errors = validateImageSpec(sanitized);
  
  // Return sanitized spec with any validation warnings
  return {
    spec: sanitized,
    warnings: errors,
  };
}
```

2. **Update `prepareSpecForSave()`** (replace lines 8-29):

**Replace with:**

   ```typescript
   export function prepareSpecForSave(
     spec: ImageSpec,
     gradeLevel: string,
     subject: string
   ): { imageSpec: ImageSpec; renderedImagePrompt: string } {
     // Normalize the spec (sanitize + validate)
     const { spec: normalizedSpec, warnings } = normalizeImageSpec(spec, gradeLevel);
     
     // Log warnings if any (but don't block)
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
   ```

3. **Update `generateSlidesFromDocument()`** (around lines 815-836):

**Current code:**

   ```typescript
   if (slide.imageSpec) {
     try {
       const specErrors = validateImageSpec(slide.imageSpec);
       if (specErrors.length > 0) {
         warnings.push(`Slide ${idx + 1} ImageSpec warnings: ${specErrors.join('; ')}`);
       }
       const cleanSpec = sanitizeImageSpec(slide.imageSpec, gradeLevel);
       slide.imageSpec = cleanSpec;
       slide.renderedImagePrompt = formatImageSpec(cleanSpec, { gradeLevel, subject });
     } catch (e) {
       // error handling
     }
   }
   ```

**Replace with:**

   ```typescript
   if (slide.imageSpec) {
     try {
       const { spec: normalizedSpec, warnings: specWarnings } = normalizeImageSpec(slide.imageSpec, gradeLevel);
       
       if (specWarnings.length > 0) {
         warnings.push(`Slide ${idx + 1} ImageSpec warnings: ${specWarnings.join('; ')}`);
       }
       
       slide.imageSpec = normalizedSpec;
       slide.renderedImagePrompt = formatImageSpec(normalizedSpec, { gradeLevel, subject });
     } catch (e) {
       console.error("Image Spec processing failed", e);
       warnings.push(`Slide ${idx + 1}: Failed to process image spec.`);
     }
   }
   ```

4. **Update `regenerateImageSpec()`** (around lines 1061-1069):

**Current code:**

   ```typescript
   const spec = JSON.parse(text) as ImageSpec;
   const sanitized = sanitizeImageSpec(spec, gradeLevel);
   const errors = validateImageSpec(sanitized);
   if (errors.length > 0) {
     console.warn("Regenerated spec validation failed, attempting auto-fix", errors);
   }
   return sanitized;
   ```

**Replace with:**

   ```typescript
   const spec = JSON.parse(text) as ImageSpec;
   const { spec: normalizedSpec, warnings } = normalizeImageSpec(spec, gradeLevel);
   
   if (warnings.length > 0) {
     console.warn("Regenerated spec validation warnings:", warnings);
   }
   
   return normalizedSpec;
   ```

**Benefits:**

- Single entry point for spec normalization
- Clearer intent (normalize = sanitize + validate)
- Consistent behavior across all code paths
- Easier to maintain and test

---

## Phase 5: Extract Constants for Reusability

### Problem

Magic strings and repeated values are scattered throughout the code.

### Solution

Extract commonly used values to module-level constants.

### Implementation

#### File: `src/services/geminiService.ts`

**Location:** Add constants section near the top, after schema definitions (around line 620)

**Changes:**

1. **Add Model Name Constants**:
```typescript
/**
 * Gemini model identifiers
 */
const MODEL_SLIDE_GENERATION = "gemini-2.5-pro";
const MODEL_IMAGE_GENERATION = "gemini-3-pro-image-preview";
const MODEL_SPEC_REGENERATION = "gemini-2.5-pro";
```

2. **Update model references**:

                                                - Line 619: `model: "gemini-2.5-pro"` → `model: MODEL_SLIDE_GENERATION`
                                                - Line 910: `model: "gemini-3-pro-image-preview"` → `model: MODEL_IMAGE_GENERATION`
                                                - Line 1048: `model: "gemini-2.5-pro"` → `model: MODEL_SPEC_REGENERATION`

**Benefits:**

- Single place to update model names
- Easier to experiment with different models
- Reduces risk of typos

---

## Testing Strategy

### Unit Tests to Add

1. **Prompt Building Functions** (`geminiService.ts`):

                                                - Test each `build*Section()` function individually
                                                - Test `buildSlideGenerationPrompt()` with various inputs
                                                - Verify sections are properly concatenated

2. **ImageSpec Formatting Functions** (`imageUtils.ts`):

                                                - Test each `format*Section()` function
                                                - Test `formatImageSpec()` with various spec configurations
                                                - Verify text policy logic (NO_LABELS vs LIMITED_LABELS)

3. **Normalization Function** (`imageUtils.ts`):

                                                - Test `normalizeImageSpec()` with valid specs
                                                - Test with invalid specs (should sanitize and return warnings)
                                                - Test with edge cases (empty arrays, missing fields)

### Integration Tests

1. Verify end-to-end slide generation still works
2. Verify image generation still works
3. Verify spec regeneration still works
4. Verify spec editing still works

---

## Migration Notes

### Backward Compatibility

All changes are internal refactorings that don't change:

- Function signatures
- API contracts
- Data structures
- External behavior

### Risk Assessment

- **Low Risk**: Schema extraction (type-only change)
- **Low Risk**: Prompt building extraction (string manipulation only)
- **Low Risk**: Format function breakdown (output format unchanged)
- **Low Risk**: Normalization function (same logic, reorganized)

### Rollback Plan

If issues arise, all changes can be reverted individually:

1. Revert schema extraction (restore duplicate definitions)
2. Revert prompt building (restore string concatenation)
3. Revert format breakdown (restore monolithic function)
4. Revert normalization (restore separate validate/sanitize calls)

---

## Implementation Order

1. **Phase 1**: Extract schema definitions (foundational, affects other phases)
2. **Phase 4**: Create normalization function (used by other phases)
3. **Phase 2**: Extract prompt building functions
4. **Phase 3**: Break down formatImageSpec function
5. **Phase 5**: Extract model constants

**Estimated Time:** 3-4 hours for experienced developer

---

## Success Metrics

### Code Quality

- Reduced code duplication (schema definitions)
- Improved modularity (extracted functions)
- Enhanced testability (smaller units)
- Better maintainability (clearer organization)

### Functionality

- All existing tests pass
- No breaking changes
- Same output quality
- Same performance characteristics

### Metrics

- **Lines of Code**: Slight increase due to function extraction (acceptable for maintainability)
- **Cyclomatic Complexity**: Reduced (smaller functions)
- **Code Duplication**: Eliminated (schema, normalization pattern)