---
name: Simplify Image Generation Workflow
overview: "Refactor the image generation workflow from a complex nested JSON schema (imageSpec) to a simple two-step process: (1) Generate a simple narrative image prompt during slide creation, (2) Append static style guidelines when calling the image generation API."
todos:
  - id: update_types
    content: "Update type definitions: Remove ImageSpec interface and related types, update Slide interface to use imagePrompt string"
    status: pending
  - id: update_prompt_builder
    content: Replace buildImageSpecInstructionsSection with simple image prompt instruction in promptBuilders.ts
    status: pending
  - id: update_slide_generation
    content: Remove formatImageSpec usage from slideGeneration.ts, handle imagePrompt directly from AI response
    status: pending
  - id: update_image_generation
    content: Update imageGeneration.ts to accept string prompt and append static style guidelines
    status: pending
  - id: update_api_endpoint
    content: Update /generate-image endpoint to accept imagePrompt string instead of spec object
    status: pending
  - id: update_client_service
    content: Update geminiService.ts to use generateImageFromPrompt with string parameter
    status: pending
  - id: update_slide_card_ui
    content: Replace ImageSpecEditor with simple text editor in SlideCard.tsx
    status: pending
  - id: delete_imagespec_editor
    content: Delete ImageSpecEditor.tsx component file
    status: pending
  - id: delete_image_utils
    content: Delete imageUtils.ts files (both shared and src versions)
    status: pending
  - id: update_schemas
    content: Remove IMAGE_SPEC_SCHEMA and update SLIDES_SCHEMA to use imagePrompt string
    status: pending
  - id: update_validation
    content: Update validation.ts to validate imagePrompt string instead of imageSpec
    status: pending
  - id: cleanup_imports
    content: Remove all imports of ImageSpec, formatImageSpec, ImageSpecEditor across codebase
    status: pending
---

# Simplify Image Generation Workflow

## Overview

This refactor simplifies the image generation workflow by replacing the complex `ImageSpec` JSON schema with a simple narrative prompt string. The new workflow has two parts:

1. **Part 1**: During slide generation, the AI creates a simple narrative image prompt following the Subject → Action → Setting structure. This prompt is stored directly in the database.

2. **Part 2**: When calling the image generation API, static style guidelines are appended to the user-generated prompt.

## Current Architecture Analysis

### Current Flow

```
Slide Generation Prompt
  └─> buildImageSpecInstructionsSection() 
      └─> AI generates complex ImageSpec JSON object
          └─> formatImageSpec() converts to renderedImagePrompt
              └─> Stored in Slide.renderedImagePrompt
                  └─> Used directly in image generation API call
```

### New Flow

```
Slide Generation Prompt
  └─> Simple instruction to generate narrative prompt
      └─> AI generates simple string prompt
          └─> Stored in Slide.imagePrompt
              └─> Append style guidelines when calling API
                  └─> Final prompt sent to image generation API
```

## Implementation Plan

### Phase 1: Update Type Definitions

#### File: `functions/src/shared/types.ts`

**Changes:**

1. Remove `ImageSpec` interface (lines 53-101)
2. Remove related type definitions: `ImageTextPolicy`, `ImageLayout`, `Viewpoint`, `Whitespace`, `IllustrationStyle`, `LightingApproach`
3. Update `Slide` interface:

                        - Remove: `imageSpec?: ImageSpec`
                        - Remove: `renderedImagePrompt?: string`
                        - Add: `imagePrompt?: string` (the simple narrative prompt)

**New Slide interface:**

```typescript
export interface Slide {
    id: string;
    sortOrder: number;
    title: string;
    content: string[];
    imagePrompt?: string;              // NEW: Simple narrative prompt
    generatedImages?: GeneratedImage[];
    backgroundImage?: string;
    speakerNotes: string;
    sources?: string[];
    layout?: 'Title Slide' | 'Content' | string;
    aspectRatio?: '16:9' | '1:1';
    updatedAt?: any;
}
```

**Keep:**

- `GeneratedImage` interface (still needed)

### Phase 2: Update Prompt Builder

#### File: `functions/src/shared/promptBuilders.ts`

**Changes:**

1. Replace `buildImageSpecInstructionsSection()` (lines 76-168) with a simple instruction:
```typescript
function buildImagePromptInstructionsSection(): string {
  return `
  IMAGE PROMPT GENERATION
  For each slide, generate a detailed visual narrative for an educational image that illustrates the key information on this slide.
  
  Construct the narrative flow in this order:
 1. Start by describing the main Subject (the central visual element)
 2. Next, describe the Action (the active process, movement, or behavior)
 3. Finally, describe the Setting (the specific environment or context)
  
  The narrative must be vivid and factual, ensuring the image serves as a clear visual aid for the topic being presented.
  
  Output the image prompt as a simple string in the \`imagePrompt\` field.
  `;
}
```

2. Update `buildOutputFormatSection()` (lines 170-218):

                        - Remove the entire `imageSpec` object from the JSON schema
                        - Replace with: `"imagePrompt": "string"`

**New output format:**

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
      "imagePrompt": "string",
      "speakerNotes": "string (Script only)",
      "sources": ["url1", "url2"]
    }
  ]
  `;
}
```

3. Update `buildSlideGenerationPrompt()` (line 253):

                        - Replace `buildImageSpecInstructionsSection()` with `buildImagePromptInstructionsSection()`

4. Remove `buildSpecRegenerationPrompt()` (lines 266-293) - no longer needed

### Phase 3: Update Slide Generation Service

#### File: `functions/src/services/slideGeneration.ts`

**Changes:**

1. Remove import: `formatImageSpec` from `@shared/utils/imageUtils`
2. Update `generateSlides()` function (lines 118-139):

                        - Remove the code that generates `renderedImagePrompt` from `imageSpec`
                        - The `imagePrompt` field will come directly from the AI response

**Before:**

```typescript
const normalizedSlides: Slide[] = slides.map((s, i) => {
    let renderedPrompt = undefined;
    if (s.imageSpec) {
        try {
            renderedPrompt = formatImageSpec(s.imageSpec, { gradeLevel, subject });
        } catch (e) {
            console.warn(`Failed to format image spec for slide ${i}:`, e);
        }
    }
    return {
        ...s,
        id: `slide-${Date.now()}-${i}`,
        sortOrder: i,
        content: Array.isArray(s.content) ? s.content : [String(s.content)],
        speakerNotes: cleanSpeakerNotes(s.speakerNotes || ''),
        sources: getUniqueSources(sources, uploadedFileNames, sourceMaterial, s.sources),
        renderedImagePrompt: renderedPrompt
    };
});
```

**After:**

```typescript
const normalizedSlides: Slide[] = slides.map((s, i) => {
    return {
        ...s,
        id: `slide-${Date.now()}-${i}`,
        sortOrder: i,
        content: Array.isArray(s.content) ? s.content : [String(s.content)],
        speakerNotes: cleanSpeakerNotes(s.speakerNotes || ''),
        sources: getUniqueSources(sources, uploadedFileNames, sourceMaterial, s.sources),
        imagePrompt: s.imagePrompt || undefined  // Already a string from AI
    };
});
```

### Phase 4: Update Image Generation Service

#### File: `functions/src/services/imageGeneration.ts`

**Changes:**

1. Update function signature to accept `imagePrompt` string instead of `ImageSpec`:

**Before:**

```typescript
export async function generateImage(
    spec: ImageSpec,
    gradeLevel: string,
    subject: string,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string }>
```

**After:**

```typescript
export async function generateImage(
    imagePrompt: string,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string }>
```

2. Add static style guidelines constant:
```typescript
const STYLE_GUIDELINES = "Front view, sharp focus throughout. Neutral, uniform technical lighting with no shadows. Clean, flat vector illustration style on a pure-white invisible background. Minimalist palette of 3–5 solid, high-contrast colors without gradients.";
```

3. Update the function body to append style guidelines:
```typescript
export async function generateImage(
    imagePrompt: string,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string }> {
    const finalPrompt = `${imagePrompt}\n\n${STYLE_GUIDELINES}`;
    const aspectRatio = options.aspectRatio || '16:9';
    const temperature = options.temperature || 0.7;

    const generateFn = async () => {
        // ... existing API call code ...
        const response = await getAiClient().models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
            config: config
        });
        // ... rest of function ...
        return {
            base64Data: inlineData.data || "",
            mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
            renderedPrompt: finalPrompt
        };
    };
    // ... rest of function ...
}
```

4. Remove `requiresGrounding` logic (no longer part of spec):

                        - Remove the grounding check: `if (spec.requiresGrounding)`

### Phase 5: Update API Endpoint

#### File: `functions/src/index.ts`

**Changes:**

1. Update `/generate-image` endpoint (lines 77-98):

                        - Change request body to accept `imagePrompt` string instead of `spec`
                        - Update function call signature

**Before:**

```typescript
app.post('/generate-image', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { spec, gradeLevel, subject, options } = req.body;
        if (!spec || !gradeLevel || !subject) {
            res.status(400).json({ error: "Missing required fields: spec, gradeLevel, subject" });
            return;
        }
        const result = await generateImage(spec, gradeLevel, subject, options || {});
        res.json(result);
    } catch (error: any) {
        // ... error handling ...
    }
});
```

**After:**

```typescript
app.post('/generate-image', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { imagePrompt, options } = req.body;
        if (!imagePrompt || typeof imagePrompt !== 'string') {
            res.status(400).json({ error: "Missing required field: imagePrompt (string)" });
            return;
        }
        const result = await generateImage(imagePrompt, options || {});
        res.json(result);
    } catch (error: any) {
        // ... error handling ...
    }
});
```

### Phase 6: Update Client-Side Services

#### File: `src/services/geminiService.ts`

**Changes:**

1. Update `generateImageFromSpec()` function (lines 115-145):

                        - Rename to `generateImageFromPrompt()`
                        - Change signature to accept `imagePrompt: string` instead of `ImageSpec`
                        - Remove `formatImageSpec` import and usage
                        - Update API call to send `imagePrompt` instead of `spec`

**Before:**

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
  // ... rest of function ...
};
```

**After:**

```typescript
export const generateImageFromPrompt = async (
  imagePrompt: string,
  options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ blob: Blob; renderedPrompt: string }> => {
  const result = await authenticatedRequest<{ base64Data: string; mimeType: string, renderedPrompt?: string }>('/generate-image', {
    imagePrompt,
    options
  });
  // ... rest of function ...
  return {
    blob: new Blob([bytes], { type: result.mimeType }),
    renderedPrompt: result.renderedPrompt || imagePrompt
  };
};
```

2. Remove `prepareSpecForSave` export (line 7) - no longer needed

### Phase 7: Update UI Components

#### File: `src/components/SlideCard.tsx`

**Changes:**

1. Remove imports:

                        - `ImageSpec` type
                        - `formatImageSpec` from `@shared/utils/imageUtils`
                        - `extractVisualSceneDescription` (no longer needed)
                        - `ImageSpecEditor` component

2. Update state and variables (lines 48-62):

                        - Remove `isEditingSpec` state
                        - Remove `showFullPrompt` state
                        - Replace `imageSpec` and `renderedPrompt` logic with simple `imagePrompt`

**Before:**

```typescript
const imageSpec = slide.imageSpec;
const renderedPrompt = slide.renderedImagePrompt || (imageSpec ? formatImageSpec(imageSpec, { gradeLevel, subject }) : '');
const visualSceneDescription = extractVisualSceneDescription(renderedPrompt) || (renderedPrompt ? 'Visual scene description not available' : '');
```

**After:**

```typescript
const imagePrompt = slide.imagePrompt || '';
```

3. Update `handleGenerateImage()` (lines 100-159):

                        - Change to use `generateImageFromPrompt()` instead of `generateImageFromSpec()`
                        - Pass `imagePrompt` directly

**Before:**

```typescript
const { blob } = await generateImageFromSpec(imageSpec, gradeLevel, subject, {
    aspectRatio,
    temperature: creativityLevel
});
```

**After:**

```typescript
if (!imagePrompt) {
    throw new Error("No image prompt available for this slide.");
}
const { blob } = await generateImageFromPrompt(imagePrompt, {
    aspectRatio,
    temperature: creativityLevel
});
```

4. Replace ImageSpecEditor UI (lines 284-306) with simple text editor:

**Before:**

```typescript
{!imageSpec ? (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
        <p className="text-sm text-slate-500 mb-3">No visual idea generated for this slide yet.</p>
    </div>
) : isEditingSpec ? (
    <ImageSpecEditor
        spec={imageSpec}
        gradeLevel={gradeLevel}
        subject={subject}
        onSave={handleSaveSpec}
        onCancel={() => setIsEditingSpec(false)}
    />
) : (
    <div className="relative group/prompt">
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-primary/30 transition-colors">
            <div className="prose prose-sm max-w-none text-secondary-text text-sm">
                <p className="whitespace-pre-wrap leading-relaxed">
                    {showFullPrompt ? renderedPrompt : visualSceneDescription}
                </p>
            </div>
        </div>
    </div>
)}
```

**After:**

```typescript
{!imagePrompt ? (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
        <p className="text-sm text-slate-500 mb-3">No image prompt generated for this slide yet.</p>
    </div>
) : isEditingPrompt ? (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="w-full p-3 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
            placeholder="Enter image prompt..."
        />
        <div className="flex justify-end space-x-2 mt-3">
            <button
                onClick={() => {
                    setIsEditingPrompt(false);
                    setEditedPrompt(imagePrompt);
                }}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
                Cancel
            </button>
            <button
                onClick={() => {
                    onUpdateSlide({ imagePrompt: editedPrompt });
                    setIsEditingPrompt(false);
                }}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
                Save
            </button>
        </div>
    </div>
) : (
    <div className="relative group/prompt">
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-primary/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-xs font-semibold text-primary-text uppercase tracking-wide">Image Prompt</h4>
                <button
                    onClick={() => {
                        setEditedPrompt(imagePrompt);
                        setIsEditingPrompt(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                    Edit
                </button>
            </div>
            <div className="prose prose-sm max-w-none text-secondary-text text-sm">
                <p className="whitespace-pre-wrap leading-relaxed">{imagePrompt}</p>
            </div>
        </div>
    </div>
)}
```

5. Add new state:
```typescript
const [isEditingPrompt, setIsEditingPrompt] = useState(false);
const [editedPrompt, setEditedPrompt] = useState(imagePrompt);
```

6. Remove `handleSaveSpec` function (if it exists)

7. Update copy button (if exists) to copy `imagePrompt` instead of `renderedPrompt`

### Phase 8: Remove ImageSpecEditor Component

#### File: `src/components/ImageSpecEditor.tsx`

**Action:** Delete this file entirely - no longer needed

### Phase 9: Remove Image Utilities

#### File: `functions/src/shared/utils/imageUtils.ts`

**Action:** Delete this file entirely - `formatImageSpec` and all related functions are no longer needed

#### File: `src/utils/imageUtils.ts` (if exists)

**Action:** Delete this file entirely

### Phase 10: Update Schema Definitions

#### File: `functions/src/shared/schemas.ts`

**Changes:**

1. Remove `IMAGE_SPEC_SCHEMA` (lines 1-139)
2. Update `SLIDES_SCHEMA` (lines 141-170):

                        - Remove `imageSpec: IMAGE_SPEC_SCHEMA`
                        - Add `imagePrompt: { type: "string" }`

**New schema:**

```typescript
export const SLIDES_SCHEMA = {
    type: "array",
    items: {
        type: "object",
        properties: {
            title: { type: "string" },
            content: {
                type: "array",
                items: { type: "string" },
            },
            layout: {
                type: "string",
                enum: ["Title Slide", "Content"],
            },
            imagePrompt: { type: "string" },
            speakerNotes: { type: "string" },
            sources: {
                type: "array",
                items: { type: "string" },
            },
        },
        required: [
            "title",
            "content",
            "layout",
            "speakerNotes",
        ],
    },
};
```

### Phase 11: Update Validation

#### File: `functions/src/shared/utils/validation.ts`

**Changes:**

1. Review `validateSlideStructure()` function
2. Remove any validation logic related to `imageSpec`
3. Add validation for `imagePrompt` (should be a string if present)

### Phase 12: Clean Up Imports

**Search and remove:**

- All imports of `ImageSpec` type
- All imports of `formatImageSpec`
- All imports of `ImageSpecEditor`
- All imports from `@shared/utils/imageUtils` or `src/utils/imageUtils`

**Files to check:**

- `src/components/Editor.tsx`
- `src/components/SlideDeck.tsx`
- Any other components that reference imageSpec

### Phase 13: Update Firestore Rules (if needed)

#### File: `firestore.rules`

**Review:** Ensure rules don't reference `imageSpec` or `renderedImagePrompt` fields. Rules should allow `imagePrompt` as a string.

## Migration Strategy

Since we're removing `imageSpec` entirely (no backwards compatibility), existing slides in the database will need to be handled:

1. **Option A**: Existing slides without `imagePrompt` will simply show "No image prompt generated"
2. **Option B**: Add a migration script to convert old `imageSpec` to `imagePrompt` (if needed)

For new slides, the AI will generate `imagePrompt` directly.

## Testing Checklist

1. Generate new slides - verify `imagePrompt` is created as a string
2. Display slides - verify `imagePrompt` shows in UI
3. Edit image prompt - verify text editor works
4. Generate image - verify style guidelines are appended
5. Verify no references to `imageSpec` remain in codebase
6. Test with slides that have no `imagePrompt` (graceful handling)

## Files Summary

### Files to Modify:

- `functions/src/shared/types.ts` - Update Slide interface, remove ImageSpec
- `functions/src/shared/promptBuilders.ts` - Replace imageSpec instructions with simple prompt instruction
- `functions/src/shared/schemas.ts` - Remove IMAGE_SPEC_SCHEMA, update SLIDES_SCHEMA
- `functions/src/services/slideGeneration.ts` - Remove formatImageSpec usage
- `functions/src/services/imageGeneration.ts` - Accept string prompt, append style guidelines
- `functions/src/index.ts` - Update API endpoint
- `src/services/geminiService.ts` - Update client service
- `src/components/SlideCard.tsx` - Replace ImageSpecEditor with text editor
- `functions/src/shared/utils/validation.ts` - Update validation

### Files to Delete:

- `src/components/ImageSpecEditor.tsx`
- `functions/src/shared/utils/imageUtils.ts`
- `src/utils/imageUtils.ts` (if exists)

### Files to Review:

- `src/components/Editor.tsx` - Check for imageSpec references
- `src/components/SlideDeck.tsx` - Check for imageSpec references
- Any other components that might reference imageSpec