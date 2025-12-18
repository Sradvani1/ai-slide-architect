---
name: Store Narrative and Simplify UI
overview: Generate and store narrative prompts during initial slide generation, remove regenerate spec functionality, keep ImageSpecEditor for editing JSON fields, and update UI to show Visual Scene Description with a "Full Prompt" toggle. Users see the Visual Scene Description by default, can click "Full Prompt" to see the complete prompt, and can edit the spec via ImageSpecEditor which updates the database.
todos:
  - id: generate-narrative-on-creation
    content: Update functions/src/services/slideGeneration.ts to generate and store renderedImagePrompt during initial slide normalization
    status: pending
  - id: create-extract-helper
    content: Add extractVisualSceneDescription() helper function to shared/utils/imageUtils.ts to extract just the Visual Scene Description from full prompt
    status: pending
  - id: remove-regenerate-client
    content: Remove regenerateImageSpec import, state, refs, handleRegenerateSpec function, and all UI buttons from src/components/SlideCard.tsx
    status: pending
  - id: remove-regenerate-service
    content: Remove regenerateImageSpec function from src/services/geminiService.ts
    status: pending
  - id: remove-regenerate-endpoint
    content: Remove /regenerate-spec endpoint and import from functions/src/index.ts
    status: pending
  - id: delete-spec-regeneration-file
    content: Delete entire file functions/src/services/specRegeneration.ts
    status: pending
  - id: add-full-prompt-button
    content: Add "Full Prompt" button in src/components/SlideCard.tsx that toggles between Visual Scene Description and Full Prompt view, keep "Edit Spec" button separate
    status: pending
  - id: enhance-image-spec-editor
    content: "Add missing fields to ImageSpecEditor.tsx: depthOfField in composition section and background object (style and texture)"
    status: pending
  - id: remove-visual-summary-utils
    content: Remove getVisualIdeaSummary function and VisualIdeaSummary interface from src/utils/imageUtils.ts
    status: pending
  - id: update-slidecard-ui
    content: Replace visual summary UI with editable Visual Scene Description display and Full Prompt toggle in src/components/SlideCard.tsx
    status: pending
  - id: update-copy-button
    content: Update CopyButton in SlideCard to copy Visual Scene Description (or full prompt if in full prompt view)
    status: pending
  - id: clean-imports
    content: Remove unused imports from SlideCard.tsx (getVisualIdeaSummary, regenerateImageSpec) but keep prepareSpecForSave and ImageSpecEditor
    status: pending
  - id: update-exports
    content: Add extractVisualSceneDescription to exports in shared/utils/imageUtils.ts and src/utils/imageUtils.ts
    status: pending
---

# Store Narrative and Simplify UI - Implementation Plan

## Overview

This plan implements:

1. Generate and store `renderedImagePrompt` during initial slide generation
2. Remove all regenerate spec functionality (client + server)
3. Remove all edit spec functionality (ImageSpecEditor component)
4. Update UI to show only Visual Scene Description paragraph
5. Add "Full Prompt" toggle to show complete prompt
6. Make Visual Scene Description editable
7. Update copy button to copy Visual Scene Description only

## Part 1: Generate and Store Narrative During Initial Slide Generation

### File: `functions/src/services/slideGeneration.ts`

**Current Issue**: Slides are normalized (lines 117-125) but `renderedImagePrompt` is never generated or stored.

**Changes Required**:

1. Import `formatImageSpec` at the top:
```typescript
import { formatImageSpec } from '@shared/utils/imageUtils';
```

2. Update the normalization logic (lines 117-125) to generate and store the narrative:
```typescript
// Normalize slides (add IDs, etc) AND generate rendered prompts
const normalizedSlides: Slide[] = slides.map((s, i) => {
    const slide: Slide = {
        ...s,
        id: `slide-${Date.now()}-${i}`,
        sortOrder: i,
        // Ensure compatibility
        content: Array.isArray(s.content) ? s.content : [String(s.content)],
        speakerNotes: cleanSpeakerNotes(s.speakerNotes || ''),
        sources: getUniqueSources(sources, uploadedFileNames, sourceMaterial, s.sources)
    };
    
    // Generate narrative prompt if imageSpec exists
    if (slide.imageSpec) {
        slide.renderedImagePrompt = formatImageSpec(slide.imageSpec, {
            gradeLevel,
            subject
        });
    }
    
    return slide;
});
```


**Result**: Every slide with an `imageSpec` will now have a stored `renderedImagePrompt` in Firebase.

## Part 2: Extract Visual Scene Description Helper

### File: `shared/utils/imageUtils.ts`

**Purpose**: Create a helper function to extract just the Visual Scene Description section from the full prompt.

**Implementation**:

Add this function after `formatImageSpec()` (around line 243):

```typescript
/**
 * Extracts just the Visual Scene Description paragraph from a full rendered prompt.
 * Returns empty string if not found.
 */
export function extractVisualSceneDescription(renderedPrompt: string): string {
    if (!renderedPrompt) return '';
    
    // Match the VISUAL SCENE DESCRIPTION section
    const match = renderedPrompt.match(/VISUAL SCENE DESCRIPTION:\s*\n(.*?)(?=\n\n---\n\n|$)/s);
    
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // Fallback: if format doesn't match, return empty
    return '';
}
```

## Part 3: Remove Regenerate Spec Functionality

### File: `src/components/SlideCard.tsx`

**Remove**:

1. Import: `regenerateImageSpec` from `geminiService` (line 5)
2. State: `isRegeneratingSpec` (line 51)
3. Ref: `isRegeneratingSpecRef` (line 62)
4. Function: `handleRegenerateSpec()` (lines 158-194)
5. UI elements: All buttons/calls to `handleRegenerateSpec` (lines 310, 330-336)

**Specific Changes**:

1. **Remove imports** (line 5):
```typescript
// REMOVE: import { generateImageFromSpec, regenerateImageSpec } from '../services/geminiService';
// KEEP: import { generateImageFromSpec } from '../services/geminiService';
```

2. **Remove state and refs** (lines 51, 62):
```typescript
// REMOVE these lines:
const [isRegeneratingSpec, setIsRegeneratingSpec] = useState(false);
const isRegeneratingSpecRef = useRef(false);
```

3. **Remove function** (lines 158-194):
```typescript
// DELETE entire handleRegenerateSpec function
```

4. **Remove UI elements** - Find and remove:

                                                - The "Regenerate Idea" button (around line 310)
                                                - The "Create Visual Idea" button in the empty state (around line 330-336)

### File: `src/services/geminiService.ts`

**Remove**:

1. Function: `regenerateImageSpec()` (lines 147-161)
2. Export if present

**Changes**:

```typescript
// DELETE entire regenerateImageSpec function (lines 147-161)
```

### File: `functions/src/index.ts`

**Remove**:

1. Endpoint: `/regenerate-spec` (lines 100-117)
2. Import: `regenerateImageSpec` from services (line 14)

**Changes**:

1. **Remove import** (line 14):
```typescript
// REMOVE: import { regenerateImageSpec } from './services/specRegeneration';
```

2. **Remove endpoint** (lines 100-117):
```typescript
// DELETE entire /regenerate-spec endpoint
```


### File: `functions/src/services/specRegeneration.ts`

**Action**: Delete entire file

**Reason**: No longer needed since regenerate functionality is removed.

## Part 4: Update Edit Spec to Full Prompt Toggle

### File: `src/components/SlideCard.tsx`

**Changes Required**:

1. **Update imports** (line 6):
```typescript
// REMOVE: getVisualIdeaSummary
// KEEP: prepareSpecForSave (needed for handleSaveSpec)
// KEEP: ImageSpecEditor import (line 8)
// ADD: extractVisualSceneDescription
import { formatImageSpec, extractVisualSceneDescription, prepareSpecForSave } from '../utils/imageUtils';
import { ImageSpecEditor } from './ImageSpecEditor';
```

2. **Add new state for view toggle** (after line 52):
```typescript
const [showFullPrompt, setShowFullPrompt] = useState(false);
```

3. **Keep existing state and functions**:
- KEEP: `isEditingSpec` state (line 52)
- KEEP: `handleSaveSpec()` function (lines 196-200) - this already updates DB via `prepareSpecForSave` and `onUpdateSlide`

4. **Update button layout** (around line 299-321):
   - Keep "Edit Spec" button but ensure it opens ImageSpecEditor
   - Add new "Full Prompt" button that toggles the view
   - Remove "Regenerate" button

```typescript
{/* Actions */}
<div className="flex items-center space-x-1">
    {!isEditingSpec && (
        <>
            <button
                onClick={() => setShowFullPrompt(!showFullPrompt)}
                className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-200 rounded"
                title={showFullPrompt ? "Show Visual Scene Description" : "Show Full Prompt"}
            >
                {showFullPrompt ? 'Show Scene' : 'Full Prompt'}
            </button>
            <button
                onClick={() => setIsEditingSpec(true)}
                disabled={!imageSpec}
                className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-slate-200 rounded disabled:opacity-30"
                title="Edit Image Specification"
            >
                Edit Spec
            </button>
        </>
    )}
</div>
```

5. **Keep ImageSpecEditor usage** (lines 337-344) - no changes needed, it already works correctly

## Part 5: Enhance ImageSpecEditor with Missing Fields

### File: `src/components/ImageSpecEditor.tsx`

**Current Issue**: ImageSpecEditor is missing some fields from the ImageSpec type:
- `composition.depthOfField` (optional field)
- `background` object (style and texture)

**Changes Required**:

1. **Add depthOfField to Composition section** (after line 283, in the composition section):

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Framing Rationale</label>
        <input
            type="text"
            value={editedSpec.composition.framingRationale || ''}
            onChange={(e) => handleCompositionChange('framingRationale', e.target.value)}
            className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Why this angle?"
        />
    </div>
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Depth of Field</label>
        <select
            value={editedSpec.composition.depthOfField || ''}
            onChange={(e) => handleCompositionChange('depthOfField', e.target.value || undefined)}
            className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
        >
            <option value="">Default (Sharp Throughout)</option>
            <option value="sharp-throughout">Sharp Throughout</option>
        </select>
    </div>
</div>
```

2. **Add Background section** (after Composition section, before Text Policy section, around line 285):

```typescript
{/* Background */}
<section>
    <h4 className="text-md uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">Background</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Background Style</label>
            <select
                value={editedSpec.background?.style || 'pure-white'}
                onChange={(e) => handleChange('background', {
                    ...editedSpec.background,
                    style: e.target.value as 'pure-white' | 'light-gray'
                })}
                className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="pure-white">Pure White</option>
                <option value="light-gray">Light Gray</option>
            </select>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Background Texture</label>
            <select
                value={editedSpec.background?.texture || 'flat'}
                onChange={(e) => handleChange('background', {
                    ...editedSpec.background,
                    texture: e.target.value as 'flat' | 'subtle-texture'
                })}
                className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="flat">Flat</option>
                <option value="subtle-texture">Subtle Texture</option>
            </select>
        </div>
    </div>
</section>
```

### File: `src/utils/imageUtils.ts`

**Remove**:

1. Function: `getVisualIdeaSummary()` (lines 37-58)
2. Function: `prepareSpecForSave()` (lines 12-24) - OR keep if needed elsewhere, check first
3. Type: `VisualIdeaSummary` interface (lines 27-31)

**Changes**:

1. **Remove getVisualIdeaSummary** (lines 37-58):
```typescript
// DELETE entire function
```

2. **Remove VisualIdeaSummary type** (lines 27-31):
```typescript
// DELETE entire interface
```

3. **Check if prepareSpecForSave is used elsewhere**:

                                                - If only used in SlideCard for editing, DELETE it
                                                - If used elsewhere, KEEP it but remove from SlideCard imports

**Add**:

```typescript
// Add export for extractVisualSceneDescription
export { extractVisualSceneDescription } from '../../shared/utils/imageUtils';
```

## Part 6: Update UI to Show Visual Scene Description

### File: `src/components/SlideCard.tsx`

**Current State**: Lines 346-361 show `visualSummary` (title, subtitle, elements)

**New State**: Show Visual Scene Description by default, with "Full Prompt" toggle and "Edit Spec" button

**Implementation**:

1. **Extract Visual Scene Description** (replace line 58):
```typescript
// Get full rendered prompt
const renderedPrompt = slide.renderedImagePrompt || (imageSpec ? formatImageSpec(imageSpec, { gradeLevel, subject }) : '');

// Extract just the Visual Scene Description
const visualSceneDescription = renderedPrompt 
    ? extractVisualSceneDescription(renderedPrompt)
    : '';
```

2. **Replace the visual summary UI** (lines 346-361) with:
```typescript
{!imageSpec ? (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
        <p className="text-sm text-slate-500">No visual idea generated for this slide yet.</p>
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
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-primary-text uppercase tracking-wide">
                {showFullPrompt ? 'Full Prompt' : 'Visual Scene Description'}
            </h4>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowFullPrompt(!showFullPrompt)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                    {showFullPrompt ? 'Show Scene' : 'Full Prompt'}
                </button>
                <button
                    onClick={() => setIsEditingSpec(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                    Edit Spec
                </button>
            </div>
        </div>
        
        {showFullPrompt ? (
            <div className="mt-2">
                <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200 max-h-96 overflow-y-auto">
                    {renderedPrompt}
                </pre>
            </div>
        ) : (
            <div className="mt-2">
                <p className="text-xs text-secondary-text whitespace-pre-wrap">
                    {visualSceneDescription || 'No visual scene description available.'}
                </p>
            </div>
        )}
    </div>
)}
```


## Part 7: Update Copy Button

### File: `src/components/SlideCard.tsx`

**Current**: Copy button copies `renderedPrompt` (line 431)

**New**: Copy button should copy Visual Scene Description only (or full prompt if in full prompt view)

**Changes**:

Update the CopyButton usage (line 431):

```typescript
<CopyButton textToCopy={showFullPrompt ? renderedPrompt : visualSceneDescription} />
```

## Part 8: Clean Up Unused Imports and Code

### File: `src/components/SlideCard.tsx`

**Remove unused imports**:

- `getVisualIdeaSummary` (if still imported)
- `regenerateImageSpec` (already removed)

**Keep imports**:

- `prepareSpecForSave` - KEEP (needed for handleSaveSpec)
- `ImageSpecEditor` - KEEP (needed for editing)

**Add new imports**:

```typescript
import { formatImageSpec, extractVisualSceneDescription, prepareSpecForSave } from '../utils/imageUtils';
import { ImageSpecEditor } from './ImageSpecEditor';
```

## Part 9: Update Shared Utils Exports

### File: `shared/utils/imageUtils.ts`

**Add export** for the new helper:

```typescript
export { formatImageSpec, extractVisualSceneDescription };
```

### File: `src/utils/imageUtils.ts`

**Update exports**:

```typescript
export { formatImageSpec, extractVisualSceneDescription } from '../../shared/utils/imageUtils';
```

## Part 10: Remove Unused Server Endpoint

### File: `functions/src/index.ts`

**Verify removal**:

- Ensure `/regenerate-spec` endpoint is completely removed
- Ensure `regenerateImageSpec` import is removed
- No other code references this endpoint

## Part 11: Verify Database Update Flow

### File: `src/components/SlideCard.tsx`

**Verify**: `handleSaveSpec()` function (lines 196-200) correctly updates the database.

**Current Implementation**:
```typescript
const handleSaveSpec = (updatedSpec: ImageSpec) => {
    const patch = prepareSpecForSave(updatedSpec, gradeLevel, subject);
    onUpdateSlide(patch);
    setIsEditingSpec(false);
};
```

**How it works**:
1. `prepareSpecForSave()` formats the spec and generates new `renderedImagePrompt`
2. Returns `{ imageSpec: updatedSpec, renderedImagePrompt: newPrompt }`
3. `onUpdateSlide(patch)` saves both to Firebase via `updateSlide()` in projectService

**Verification**: This flow is already correct and will update both `imageSpec` and `renderedImagePrompt` in the database when user saves changes.

## Part 12: Update Type Definitions (if needed)

### File: `shared/types.ts`

**Verify**: `Slide` interface already has `renderedImagePrompt?: string` (line 99) - no changes needed.

## Summary of File Changes

### Files to Modify:

1. `functions/src/services/slideGeneration.ts` - Add narrative generation
2. `shared/utils/imageUtils.ts` - Add `extractVisualSceneDescription()` helper
3. `src/components/SlideCard.tsx` - Update UI to show Visual Scene Description, add Full Prompt toggle, change Edit Spec button
4. `src/components/ImageSpecEditor.tsx` - Add missing fields (depthOfField, background)
5. `src/utils/imageUtils.ts` - Remove `getVisualIdeaSummary`, add `extractVisualSceneDescription` export
6. `src/services/geminiService.ts` - Remove `regenerateImageSpec`
7. `functions/src/index.ts` - Remove `/regenerate-spec` endpoint

### Files to Delete:

1. `functions/src/services/specRegeneration.ts` - Entire file (regenerate functionality removed)

### Files to Verify (no changes expected):

1. `shared/types.ts` - Already has `renderedImagePrompt` field
2. `shared/promptBuilders.ts` - No changes needed

## Testing Checklist

After implementation, verify:

- [ ] New slides have `renderedImagePrompt` stored in Firebase
- [ ] Visual Scene Description displays correctly by default
- [ ] "Full Prompt" button toggles to show complete prompt
- [ ] "Edit Spec" button opens ImageSpecEditor
- [ ] ImageSpecEditor has all fields: depthOfField, background (style, texture)
- [ ] Saving changes in ImageSpecEditor updates both imageSpec and renderedImagePrompt in Firebase
- [ ] Copy button copies Visual Scene Description (or full prompt if in full prompt view)
- [ ] No regenerate buttons appear
- [ ] Regenerate endpoint returns 404 or is removed
- [ ] No console errors related to removed functions
- [ ] Visual Scene Description is extracted correctly from full prompt