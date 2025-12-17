---
name: Simplify ImageSpec to Single Spec with Direct Editing
overview: Refactor the image generation system from a complex prompt history model to a simple single-imageSpec-per-slide model with direct structured editing capabilities, removing ~300 lines of history management code while maintaining all core functionality.
todos:
  - id: update-types
    content: "Update src/types.ts: Remove promptHistory, selectedPromptId, renderedImagePromptHash from Slide interface. Add generatedImages array."
    status: pending
  - id: create-editor
    content: "Create src/components/ImageSpecEditor.tsx: Structured form component with fields for all ImageSpec properties (text inputs, arrays, selects, radio buttons)."
    status: pending
  - id: simplify-slidecard
    content: "Simplify src/components/SlideCard.tsx: Remove history state/navigation (~250 lines), add Edit mode with ImageSpecEditor, change New Idea to Regenerate (overwrites), simplify image generation to use slide.generatedImages directly."
    status: pending
  - id: update-gemini-service
    content: "Update src/services/geminiService.ts: Remove promptHistory initialization code (lines 875-892), remove renderedImagePromptHash generation."
    status: pending
  - id: optional-cleanup
    content: (Optional) Remove hashPrompt function from src/utils/imageUtils.ts if unused, or keep for potential future use.
    status: pending
  - id: test-migration
    content: (Optional) Create migration helper function to convert existing slides with promptHistory to new simple format, test with existing data.
    status: pending
---

# ImageSpec Simplification Refactor - Implementation Plan

## Executive Summary

This refactor simplifies the image generation system by removing the prompt history architecture and replacing it with a single `imageSpec` per slide that users can edit directly through a structured form. This reduces complexity by ~300 lines while maintaining schema-based quality and giving users full control.

## Current Architecture Analysis

### Current Data Model

- **Slide** contains `promptHistory: ImagePromptRecord[]` array
- Each **ImagePromptRecord** has: `id`, `spec`, `renderedPrompt`, `promptHash`, `generatedImages[]`
- `selectedPromptId` tracks which history entry is active
- Navigation UI allows switching between historical prompts
- Hash-based deduplication prevents duplicate prompts in history

### Current User Flow

1. Slide generation creates initial `imageSpec` → stored in `promptHistory[0]`
2. User clicks "New Idea" → AI generates new spec → appended to `promptHistory[]`
3. User navigates between ideas using prev/next buttons
4. User generates images → stored in active prompt's `generatedImages[]`
5. User can view rendered prompt (read-only) but cannot edit `imageSpec` directly

### Complexity Issues

- ~200 lines in SlideCard.tsx for history navigation and state management
- ~50 lines for hash-based deduplication logic
- ~50 lines for history initialization in geminiService.ts
- Complex state synchronization between history array and selected prompt
- Users cannot directly edit the structured spec fields

## New Architecture

### Simplified Data Model

```typescript
interface Slide {
  // ... existing fields
  imageSpec?: ImageSpec;              // Single spec (Source of Truth)
  renderedImagePrompt?: string;       // Derived from spec (for display)
  generatedImages?: GeneratedImage[]; // Simple array (not nested in history)
  backgroundImage?: string;           // Currently selected image URL
}
```

**Removed:**

- `promptHistory?: ImagePromptRecord[]`
- `selectedPromptId?: string`
- `renderedImagePromptHash?: string` (no longer needed for deduplication)

### New User Flow

1. Slide generation creates initial `imageSpec` → stored directly on slide
2. User sees friendly summary via `getVisualIdeaSummary(imageSpec)`
3. User clicks "Edit" → opens structured `ImageSpecEditor` form
4. User edits fields directly (primaryFocal, subjects, composition, etc.)
5. User clicks "Regenerate" → AI generates new spec → **overwrites** current `imageSpec`
6. User clicks "Generate Image" → uses current `imageSpec` → adds to `generatedImages[]` array
7. All generated images stored in simple array regardless of how many times spec was edited

## Implementation Details

### Phase 1: Type System Updates

#### File: `src/types.ts`

**Changes:**

1. Keep `ImagePromptRecord` interface (for backwards compatibility during migration) but mark as deprecated
2. Update `Slide` interface:

   - Remove: `promptHistory`, `selectedPromptId`, `renderedImagePromptHash`
   - Add: `generatedImages?: GeneratedImage[]`

**Code Changes:**

```typescript
export interface Slide {
  id: string;
  sortOrder: number;
  title: string;
  content: string[];
  
  imageSpec?: ImageSpec;
  renderedImagePrompt?: string;
  generatedImages?: GeneratedImage[];  // NEW: Simple array
  backgroundImage?: string;
  speakerNotes: string;
  sources?: string[];
  layout?: 'Title Slide' | 'Content' | string;
  updatedAt?: any;
  
  // REMOVED:
  // promptHistory?: ImagePromptRecord[];
  // selectedPromptId?: string;
  // renderedImagePromptHash?: string;
}
```

---

### Phase 2: Create ImageSpecEditor Component

#### File: `src/components/ImageSpecEditor.tsx` (NEW)

**Purpose:** Structured form component for editing ImageSpec fields directly

**Features:**

- Editable fields for all ImageSpec properties:
  - Text inputs: `primaryFocal`, `conceptualPurpose`
  - Array inputs: `subjects`, `actions`, `mustInclude`, `avoid`, `colors`, `negativePrompt`, `allowedLabels`
  - Select dropdowns: `composition.layout`, `composition.viewpoint`, `composition.whitespace`
  - Radio buttons: `textPolicy` (NO_LABELS vs LIMITED_LABELS_1_TO_3)
- Conditional UI: `allowedLabels` only shows when `textPolicy === 'LIMITED_LABELS_1_TO_3'`
- Array management: Add/remove items for array fields
- Validation feedback: Show errors from `validateImageSpec()` if needed
- Auto-save or manual save button (based on UX preference)

**Component Structure:**

```typescript
interface ImageSpecEditorProps {
  spec: ImageSpec;
  onSave: (updatedSpec: ImageSpec) => void;
  onCancel: () => void;
  gradeLevel: string;
  subject: string;
}

export const ImageSpecEditor: React.FC<ImageSpecEditorProps>
```

**UI Sections:**

1. **Semantic Content** (primaryFocal, conceptualPurpose, subjects, actions, mustInclude, avoid)
2. **Composition** (layout, viewpoint, whitespace dropdowns)
3. **Text Policy** (radio buttons + conditional allowedLabels array)
4. **Colors** (array of color inputs/pickers)
5. **Negative Prompt** (array of text inputs)

---

### Phase 3: Simplify SlideCard Component

#### File: `src/components/SlideCard.tsx`

**Major Simplifications:**

1. **Remove History State Management** (~80 lines)

   - Remove: `prompts`, `activePrompt`, `activeIndex`, `selectedPromptIndex` logic
   - Replace with: Direct access to `slide.imageSpec`

2. **Remove Navigation UI** (~50 lines)

   - Remove: History navigation buttons (prev/next, "1/3" counter)
   - Remove: `handleNavigateHistory()` function

3. **Simplify "New Idea" → "Regenerate"** (~30 lines)

   - Rename `handleNewVisualIdea` → `handleRegenerateSpec`
   - Remove hash deduplication logic
   - Change from append-to-history to overwrite `slide.imageSpec`
   - Update: `onUpdateSlide({ imageSpec: newSpec, renderedImagePrompt: rendered })`

4. **Add Edit Mode** (~20 lines)

   - Add state: `const [isEditingSpec, setIsEditingSpec] = useState(false)`
   - Add "Edit" button next to "View Prompt"
   - Render `ImageSpecEditor` when `isEditingSpec === true`

5. **Simplify Image Generation** (~40 lines)

   - Remove: History array manipulation
   - Change: Use `slide.imageSpec` directly instead of `activePrompt.spec`
   - Change: Append to `slide.generatedImages[]` instead of `activePrompt.generatedImages[]`
   - Simplify: `onUpdateSlide({ generatedImages: [...slide.generatedImages || [], newImage] })`

6. **Update Display Logic** (~30 lines)

   - Remove: Conditional logic for `activePrompt?.spec`
   - Replace: Direct use of `slide.imageSpec` for `getVisualIdeaSummary()`
   - Update: Image strip to use `slide.generatedImages` instead of `activePrompt.generatedImages`

**Key Function Changes:**

```typescript
// OLD: Complex history navigation
const activePrompt = prompts[activeIndex];

// NEW: Direct access
const imageSpec = slide.imageSpec;

// OLD: Generate image with history
const updatedPrompts = [...prompts];
updatedPrompts[activeIndex].generatedImages.push(newImage);
onUpdateSlide({ promptHistory: updatedPrompts, selectedPromptId: ... });

// NEW: Simple array append
onUpdateSlide({ 
  generatedImages: [...(slide.generatedImages || []), newImage],
  backgroundImage: newImage.url 
});

// OLD: New Idea adds to history
const newPromptRecord = { id, spec, ... };
const updatedPrompts = [...(slide.promptHistory || []), newPromptRecord];
onUpdateSlide({ promptHistory: updatedPrompts, selectedPromptId: newPromptRecord.id });

// NEW: Regenerate overwrites
const newSpec = await regenerateImageSpec(...);
const renderedPrompt = formatImageSpec(newSpec, { gradeLevel, subject });
onUpdateSlide({ imageSpec: newSpec, renderedImagePrompt: renderedPrompt });
```

**Estimated Reduction:** ~250 lines removed, ~100 lines added (ImageSpecEditor integration) = **Net ~150 lines reduction**

---

### Phase 4: Update Gemini Service

#### File: `src/services/geminiService.ts`

**Changes in `generateSlidesFromDocument()`:**

1. **Remove Prompt History Initialization** (lines 875-892)

   - Remove: `promptHistory` array creation
   - Remove: `selectedPromptId` assignment
   - Remove: `renderedImagePromptHash` generation (no longer needed)
   - Keep: `renderedImagePrompt` generation via `formatImageSpec()` for display

**Code Changes:**

```typescript
// REMOVE THIS ENTIRE BLOCK:
await Promise.all(slides.map(async (slide) => {
  if (slide.renderedImagePrompt) {
    slide.renderedImagePromptHash = await hashPrompt(slide.renderedImagePrompt);
    if (slide.imageSpec) {
      slide.promptHistory = [{ ... }];
      slide.selectedPromptId = slide.promptHistory[0].id;
    }
  }
}));

// KEEP: Just the renderedImagePrompt generation (already exists at line 838)
// slide.renderedImagePrompt = formatImageSpec(cleanSpec, { gradeLevel, subject });
```

**Estimated Reduction:** ~20 lines removed

---

### Phase 5: Update Utilities (Optional Simplification)

#### File: `src/utils/imageUtils.ts`

**Optional Changes:**

- Keep `validateImageSpec()` - still needed for editor validation
- Keep `sanitizeImageSpec()` - still needed when AI generates specs
- Keep `formatImageSpec()` - still needed to generate rendered prompt
- **Remove `hashPrompt()`** - no longer needed (or keep for potential future use)
- Keep `getVisualIdeaSummary()` - still used for friendly display

**Decision:** Keep all functions for now, remove `hashPrompt` only if confirmed unused elsewhere.

---

### Phase 6: Update Firestore Rules (If Needed)

#### File: `firestore.rules`

**Current rule** (line 41) validates `promptHistory` as list if present:

```javascript
&& (!data.keys().hasAny(['promptHistory']) || data.promptHistory is list);
```

**Change:** Remove this validation since `promptHistory` will no longer exist on new slides. However, **keep it for backwards compatibility** - existing slides may still have it, and we don't want to break reads.

**Recommendation:** No change needed - rule is permissive enough to allow missing `promptHistory`.

---

## Migration Strategy

### Backwards Compatibility

**Challenge:** Existing slides in Firestore have `promptHistory` arrays that need to be handled.

**Solution:** Write migration helper function (optional, can be run manually):

```typescript
// src/utils/migrateSlide.ts (NEW - optional)
export function migrateSlideToSimple(slide: Slide): Slide {
  // If slide has promptHistory, extract the selected one (or last one)
  if (slide.promptHistory && slide.promptHistory.length > 0) {
    const selectedId = slide.selectedPromptId;
    const selectedPrompt = slide.promptHistory.find(p => p.id === selectedId) 
                        || slide.promptHistory[slide.promptHistory.length - 1];
    
    return {
      ...slide,
      imageSpec: selectedPrompt.spec,
      renderedImagePrompt: selectedPrompt.renderedPrompt,
      generatedImages: selectedPrompt.generatedImages || [],
      // Remove old fields (TypeScript will ignore, but clean for Firestore)
      promptHistory: undefined,
      selectedPromptId: undefined,
      renderedImagePromptHash: undefined,
    };
  }
  
  return slide;
}
```

**Usage:** Can be called in `getProject()` when loading slides, or run as a one-time migration script.

**Recommendation:** Implement but make it non-blocking - if migration fails, fall back to trying to read `slide.imageSpec` directly.

---

## Testing Considerations

### Unit Tests Needed

1. **ImageSpecEditor Component**

   - Renders all fields correctly
   - Handles array add/remove operations
   - Conditional rendering of `allowedLabels` based on `textPolicy`
   - Calls `onSave` with updated spec
   - Validation error display

2. **SlideCard Simplification**

   - "Regenerate" overwrites `imageSpec` (not appends to history)
   - "Generate Image" appends to `generatedImages` array
   - "Edit" opens `ImageSpecEditor`
   - Image display uses `slide.generatedImages` correctly

3. **Migration Function** (if implemented)

   - Correctly extracts selected prompt from history
   - Handles missing `promptHistory` gracefully
   - Preserves all generated images

### Integration Tests

1. End-to-end flow: Generate slides → Edit spec → Generate image → Verify image in array
2. Regenerate flow: Generate spec → Regenerate → Verify overwrite (not append)
3. Multiple images: Generate multiple images → Verify all stored in array

---

## Risk Assessment

### Low Risk

- Type system changes (compile-time safety)
- Component simplification (removing code, not adding complexity)
- Utility functions remain mostly unchanged

### Medium Risk

- **Migration of existing data** - Need to handle slides with `promptHistory`
- **User workflow change** - "New Idea" behavior changes from "add to history" to "overwrite"
- **UI change** - Users lose ability to navigate between historical ideas

### Mitigation

- Keep migration function backwards-compatible
- Add clear UI messaging: "Regenerate will replace current idea" (if needed)
- Consider keeping "View Prompt" button to show rendered prompt (read-only)

---

## Success Metrics

### Code Reduction

- **Target:** ~250-300 lines removed
- **Measure:** Compare line counts before/after

### Functionality Maintained

- ✅ Users can still generate new visual ideas
- ✅ Users can still generate images
- ✅ Schema quality maintained
- ✅ All generated images preserved

### New Capabilities Added

- ✅ Users can edit `imageSpec` fields directly
- ✅ Simpler data model (easier to understand/maintain)
- ✅ No complex state synchronization

---

## Implementation Order

1. **Phase 1:** Update types.ts (foundational change)
2. **Phase 2:** Create ImageSpecEditor.tsx (new component)
3. **Phase 3:** Simplify SlideCard.tsx (main refactor)
4. **Phase 4:** Update geminiService.ts (remove history init)
5. **Phase 5:** (Optional) Remove unused hashPrompt utility
6. **Phase 6:** (Optional) Add migration helper for existing data

**Estimated Total Time:** 4-6 hours for experienced developer

---

## Rollback Plan

If issues arise, rollback is straightforward:

1. Revert Slide interface to include `promptHistory` fields
2. Revert SlideCard.tsx to previous version (Git history)
3. Revert geminiService.ts history initialization
4. Keep ImageSpecEditor component (can be useful even with history system)

No data loss risk - old slides with `promptHistory` will continue to work if we keep migration logic backwards-compatible.