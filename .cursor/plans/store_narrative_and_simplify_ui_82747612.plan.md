---
name: Store Narrative and Simplify UI
overview: Generate and store narrative prompts during initial slide generation, remove regenerate/edit spec functionality, and update UI to show only the Visual Scene Description with a "Full Prompt" toggle. The Visual Scene Description will be editable, and users can toggle to see the complete prompt sent to the API.
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
  - id: remove-edit-spec-ui
    content: Remove ImageSpecEditor import, isEditingSpec state, handleSaveSpec function, and ImageSpecEditor component usage from src/components/SlideCard.tsx
    status: pending
  - id: delete-image-spec-editor
    content: Delete entire file src/components/ImageSpecEditor.tsx
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
    content: Remove all unused imports from SlideCard.tsx (getVisualIdeaSummary, prepareSpecForSave, ImageSpecEditor, regenerateImageSpec)
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

## Part 4: Remove Edit Spec Functionality

### File: `src/components/SlideCard.tsx`

**Remove**:

1. Import: `ImageSpecEditor` (line 8)
2. Import: `prepareSpecForSave` from utils (line 6)
3. Import: `getVisualIdeaSummary` from utils (line 6)
4. State: `isEditingSpec` (line 52)
5. Function: `handleSaveSpec()` (lines 196-200)
6. UI: `ImageSpecEditor` component usage (lines 337-344)
7. UI: "Edit Spec" button (find where it's called)

**Specific Changes**:

1. **Update imports** (line 6):
```typescript
// REMOVE: getVisualIdeaSummary, prepareSpecForSave
// REMOVE: ImageSpecEditor import (line 8)
// KEEP: formatImageSpec, extractVisualSceneDescription (new)
import { formatImageSpec, extractVisualSceneDescription } from '../utils/imageUtils';
```

2. **Remove state** (line 52):
```typescript
// REMOVE: const [isEditingSpec, setIsEditingSpec] = useState(false);
```

3. **Remove function** (lines 196-200):
```typescript
// DELETE entire handleSaveSpec function
```

4. **Remove ImageSpecEditor usage** (lines 337-344):
```typescript
// DELETE the entire conditional block:
// ) : isEditingSpec ? (
//     <ImageSpecEditor ... />
```


### File: `src/components/ImageSpecEditor.tsx`

**Action**: Delete entire file

**Reason**: No longer needed since edit functionality is removed.

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

## Part 5: Update UI to Show Visual Scene Description

### File: `src/components/SlideCard.tsx`

**Current State**: Lines 346-361 show `visualSummary` (title, subtitle, elements)

**New State**: Show editable Visual Scene Description with "Full Prompt" toggle

**Implementation**:

1. **Add new state for view toggle** (after line 52):
```typescript
const [showFullPrompt, setShowFullPrompt] = useState(false);
const [editedVisualScene, setEditedVisualScene] = useState('');
const [isEditingVisualScene, setIsEditingVisualScene] = useState(false);
```

2. **Extract Visual Scene Description** (replace line 58):
```typescript
// Get full rendered prompt
const renderedPrompt = slide.renderedImagePrompt || (imageSpec ? formatImageSpec(imageSpec, { gradeLevel, subject }) : '');

// Extract just the Visual Scene Description
const visualSceneDescription = renderedPrompt 
    ? extractVisualSceneDescription(renderedPrompt)
    : '';

// Initialize edited state
useEffect(() => {
    if (visualSceneDescription && !editedVisualScene) {
        setEditedVisualScene(visualSceneDescription);
    }
}, [visualSceneDescription]);
```

3. **Add handler for saving edited visual scene** (after handleSaveContent):
```typescript
const handleSaveVisualScene = () => {
    // When user edits the visual scene, we need to update the full prompt
    // For now, just update the visual scene part (in Phase 2, we'll rebuild full prompt)
    // For Phase 1, we'll store the edited text but note: this won't regenerate the full prompt
    // This is a placeholder for future multi-turn editing
    
    // TODO: In Phase 2, rebuild full prompt from edited visual scene
    // For now, we'll just note that it was edited
    setIsEditingVisualScene(false);
    
    // Optionally save to a new field like editedVisualSceneDescription
    // But for Phase 1, we'll keep it simple
};
```

4. **Replace the visual summary UI** (lines 346-361) with:
```typescript
{!imageSpec ? (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
        <p className="text-sm text-slate-500">No visual idea generated for this slide yet.</p>
    </div>
) : (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-primary-text uppercase tracking-wide">
                {showFullPrompt ? 'Full Prompt' : 'Visual Scene Description'}
            </h4>
            <button
                onClick={() => setShowFullPrompt(!showFullPrompt)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
                {showFullPrompt ? 'Show Scene Only' : 'Full Prompt'}
            </button>
        </div>
        
        {showFullPrompt ? (
            <div className="mt-2">
                <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200 max-h-96 overflow-y-auto">
                    {renderedPrompt}
                </pre>
            </div>
        ) : (
            <div className="mt-2">
                {isEditingVisualScene ? (
                    <div>
                        <textarea
                            value={editedVisualScene}
                            onChange={(e) => setEditedVisualScene(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] font-mono text-xs"
                            placeholder="Edit the visual scene description..."
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                onClick={() => {
                                    setIsEditingVisualScene(false);
                                    setEditedVisualScene(visualSceneDescription);
                                }}
                                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveVisualScene}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative group">
                        <p 
                            className="text-xs text-secondary-text whitespace-pre-wrap cursor-text hover:bg-slate-50 p-2 rounded transition-colors"
                            onClick={() => setIsEditingVisualScene(true)}
                            title="Click to edit"
                        >
                            {editedVisualScene || visualSceneDescription || 'No visual scene description available.'}
                        </p>
                        {editedVisualScene && (
                            <span className="absolute top-0 right-0 text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
                                Edited
                            </span>
                        )}
                    </div>
                )}
            </div>
        )}
    </div>
)}
```


## Part 6: Update Copy Button

### File: `src/components/SlideCard.tsx`

**Current**: Copy button copies `renderedPrompt` (line 431)

**New**: Copy button should copy Visual Scene Description only (or full prompt if in full prompt view)

**Changes**:

Update the CopyButton usage (line 431):

```typescript
<CopyButton textToCopy={showFullPrompt ? renderedPrompt : (editedVisualScene || visualSceneDescription)} />
```

## Part 7: Clean Up Unused Imports and Code

### File: `src/components/SlideCard.tsx`

**Remove unused imports**:

- `getVisualIdeaSummary` (if still imported)
- `prepareSpecForSave` (if still imported)
- `ImageSpecEditor` (already removed)
- `regenerateImageSpec` (already removed)

**Add new imports**:

```typescript
import { formatImageSpec, extractVisualSceneDescription } from '../utils/imageUtils';
```

## Part 8: Update Shared Utils Exports

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

## Part 9: Remove Unused Server Endpoint

### File: `functions/src/index.ts`

**Verify removal**:

- Ensure `/regenerate-spec` endpoint is completely removed
- Ensure `regenerateImageSpec` import is removed
- No other code references this endpoint

## Part 10: Update Type Definitions (if needed)

### File: `shared/types.ts`

**Verify**: `Slide` interface already has `renderedImagePrompt?: string` (line 99) - no changes needed.

## Summary of File Changes

### Files to Modify:

1. `functions/src/services/slideGeneration.ts` - Add narrative generation
2. `shared/utils/imageUtils.ts` - Add `extractVisualSceneDescription()` helper
3. `src/components/SlideCard.tsx` - Major UI refactor
4. `src/utils/imageUtils.ts` - Remove unused functions, add new export
5. `src/services/geminiService.ts` - Remove `regenerateImageSpec`
6. `functions/src/index.ts` - Remove `/regenerate-spec` endpoint

### Files to Delete:

1. `src/components/ImageSpecEditor.tsx` - Entire file
2. `functions/src/services/specRegeneration.ts` - Entire file

### Files to Verify (no changes expected):

1. `shared/types.ts` - Already has `renderedImagePrompt` field
2. `shared/promptBuilders.ts` - No changes needed

## Testing Checklist

After implementation, verify:

- [ ] New slides have `renderedImagePrompt` stored in Firebase
- [ ] Visual Scene Description displays correctly
- [ ] "Full Prompt" toggle works
- [ ] Visual Scene Description is editable
- [ ] Copy button copies correct content (scene or full prompt)
- [ ] No regenerate buttons appear
- [ ] No edit spec buttons appear
- [ ] ImageSpecEditor component is removed
- [ ] Regenerate endpoint returns 404 or is removed
- [ ] No console errors related to removed functions