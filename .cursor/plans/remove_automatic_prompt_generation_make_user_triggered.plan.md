# Remove Automatic Prompt Generation - Make User-Triggered

## Context

The automatic image prompt generation feature has been failing consistently due to:

1. Firestore eventual consistency issues (querying immediately after batch.commit())
2. Rate limiter bottlenecks (max 5 concurrent, causing cascading failures)
3. Error handling gaps in parallel processing
4. Sequencing problems with Firestore writes

**Solution:** Remove automatic prompt generation entirely and make it a user-triggered action per slide. This eliminates all the timing, consistency, and concurrency issues.

## Scope and Goal

**Goal:** Remove automatic prompt generation after slide creation and replace it with a user-triggered button/action in the UI.

**Scope:**

- Remove automatic call to `generateImagePromptsForAllSlides()` after batch commit
- Update UI to show "Generate Visual Idea" button when no prompt exists
- Repurpose/rename retry endpoint to handle both initial generation and retries
- Remove loading states for automatic generation
- Clean up unused parallel processing code

## Files to Modify

### Backend Files:

1. `functions/src/services/slideGeneration.ts` - Remove automatic prompt generation call
2. `functions/src/index.ts` - Update/rename retry endpoint to handle initial generation
3. `functions/src/services/slideGeneration.ts` - Remove `generateImagePromptsForAllSlides()` function (or keep for batch operations if needed)

### Frontend Files:

1. `src/components/SlideCard.tsx` - Add "Generate Visual Idea" button, remove auto-loading state
2. `src/services/geminiService.ts` - Update function name/behavior if needed
3. `src/components/Editor.tsx` - No changes needed (already has real-time listener)

## Implementation Plan

### Phase 1: Remove Automatic Prompt Generation from Backend

**File:** `functions/src/services/slideGeneration.ts`

**Changes:**

1. **Remove automatic prompt generation call** (lines 305-311):

            - Remove the `await generateImagePromptsForAllSlides()` call after `batch.commit()`
            - Keep the batch commit and project status updates

2. **Keep or Remove `generateImagePromptsForAllSlides()` function:**

            - **Option A (Recommended):** Remove the function entirely (lines 345-384) since it's no longer used
            - **Option B:** Keep it for potential future batch operations, but don't call it automatically

3. **Keep `generateImagePromptsForSingleSlide()` function:**

            - This is still used by the retry/initial generation endpoint
            - No changes needed

**Code Changes:**

```typescript
// BEFORE (lines 303-311):
await batch.commit();

// New: Generate image prompts in parallel for all slides
await generateImagePromptsForAllSlides(projectRef, {
    topic,
    gradeLevel,
    subject,
    ...result
} as any);

// New: Calculate and increment project cost using pricing service

// AFTER:
await batch.commit();

// Note: Image prompt generation is now user-triggered per slide
// No automatic generation after slide creation

// New: Calculate and increment project cost using pricing service
```

**Remove Function (if Option A):**

```typescript
// DELETE entire function (lines 345-384):
// async function generateImagePromptsForAllSlides(...) { ... }
```

---

### Phase 2: Update Backend Endpoint for Initial Generation

**File:** `functions/src/index.ts`

**Changes:**

1. **Rename endpoint** from `/retry-prompt-generation` to `/generate-prompt` (or keep name but update behavior)

2. **Update endpoint logic** to handle both:

            - Initial generation (when slide has no prompt)
            - Retry generation (when slide failed or user wants to regenerate)

3. **Update validation:**

            - Allow generation even if `promptGenerationState` is not 'failed'
            - Check if prompt already exists (skip if exists, unless user explicitly wants to regenerate)

**Current Endpoint (lines 254-343):**

```typescript
app.post('/retry-prompt-generation', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    // ... existing code
});
```

**Updated Endpoint:**

```typescript
/**
 * Generate or regenerate image prompt for a specific slide.
 * Handles both initial generation and retry scenarios.
 */
app.post('/generate-prompt', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { projectId, slideId, regenerate = false } = req.body;

        if (!projectId || !slideId) {
            res.status(400).json({ error: "Missing required fields: projectId, slideId" });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        // Verify project exists and belongs to user
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found or unauthorized" });
            return;
        }

        const slideRef = projectRef.collection('slides').doc(slideId);
        const slideDoc = await slideRef.get();

        if (!slideDoc.exists) {
            res.status(404).json({ error: "Slide not found" });
            return;
        }

        const slideData = slideDoc.data() as Slide;
        const projectData = projectDoc.data() as ProjectData;

        // Check if prompt already exists
        const hasPrompt = (slideData.imagePrompts || []).length > 0;
        if (hasPrompt && !regenerate) {
            res.status(400).json({ 
                error: "Slide already has a prompt. Set regenerate=true to create a new one." 
            });
            return;
        }

        // Check if already generating (prevent duplicate requests)
        if (slideData.promptGenerationState === 'generating') {
            res.status(409).json({ 
                error: "Prompt generation already in progress for this slide." 
            });
            return;
        }

        // Atomically claim by setting to 'generating'
        await slideRef.update({
            promptGenerationState: 'generating',
            promptGenerationError: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Process in background (fire and forget)
        generateImagePromptsForSingleSlide(slideRef, projectRef, projectData, slideData).catch(error => {
            console.error(`[PROMPT_GEN] Error processing prompt for slide ${slideId}:`, error);
        });

        res.json({ 
            success: true, 
            message: `Prompt generation started for slide ${slideId}.` 
        });
    } catch (error: any) {
        console.error("Generate Prompt Error:", error);
        res.status(500).json({ error: "Failed to start prompt generation" });
    }
});
```

**Note:** Keep the old `/retry-prompt-generation` endpoint for backward compatibility (or remove after frontend is updated). If keeping, it can call the same logic.

---

### Phase 3: Update Frontend Service

**File:** `src/services/geminiService.ts`

**Changes:**

1. **Add new function** for initial generation (or update existing):

            - Create `generatePrompt()` function that calls `/generate-prompt` endpoint
            - Keep `retryPromptGeneration()` for backward compatibility (or remove after UI update)

**New Function:**

```typescript
/**
 * Generates an image prompt for a specific slide.
 * Can be used for initial generation or regeneration.
 */
export const generatePrompt = async (
  projectId: string,
  slideId: string,
  regenerate: boolean = false
): Promise<{ success: boolean; message: string }> => {
  return authenticatedRequest<{ success: boolean; message: string }>('/generate-prompt', {
    projectId,
    slideId,
    regenerate
  });
};
```

**Update Existing Function (Optional - for backward compatibility):**

```typescript
/**
 * Retries image prompt generation for a specific slide.
 * @deprecated Use generatePrompt() instead
 */
export const retryPromptGeneration = async (
  projectId: string,
  slideId?: string
): Promise<{ success: boolean; message: string }> => {
  if (!slideId) {
    throw new Error('slideId is required');
  }
  return generatePrompt(projectId, slideId, true);
};
```

---

### Phase 4: Update UI Component - Add Generate Button

**File:** `src/components/SlideCard.tsx`

**Changes:**

1. **Import new service function:**
   ```typescript
   import { generatePrompt } from '../services/geminiService';
   ```

2. **Add state for generating prompt:**
   ```typescript
   const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
   ```

3. **Add handler function:**
   ```typescript
   const handleGeneratePrompt = async () => {
       if (!projectId || isGeneratingPrompt) return;
       setIsGeneratingPrompt(true);
       try {
           await generatePrompt(projectId, slide.id, false);
           // State will update via Firestore listener
       } catch (error: any) {
           console.error('Error generating prompt:', error);
           const message = error?.response?.data?.error || 'Failed to generate prompt. Please try again.';
           alert(message);
       } finally {
           setIsGeneratingPrompt(false);
       }
   };
   ```

4. **Update footer UI logic:**

            - Remove the automatic loading state (lines 300-311)
            - Add "Generate Visual Idea" button when no prompt exists and not in failed state
            - Keep the failed state UI with retry button
            - Keep the existing prompt display UI

**Updated Footer Logic:**

```typescript
<footer className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
    {slide.promptGenerationState === 'failed' ? (
        // Keep existing failed state UI (lines 280-299)
        <div className="flex flex-col items-center justify-center p-6 bg-red-50/50 rounded-xl border border-red-100 shadow-sm animate-fade-in">
            {/* ... existing failed state UI ... */}
            <button
                onClick={handleRetryPromptGeneration}
                disabled={isRetrying}
                className={/* ... existing styles ... */}
            >
                {isRetrying ? 'Retrying...' : 'Retry Generation'}
            </button>
        </div>
    ) : imagePrompts.length === 0 ? (
        // NEW: Show generate button when no prompt exists
        <div className="flex flex-col items-center justify-center p-8 bg-white/50 rounded-xl border border-slate-100 shadow-sm w-full">
            {slide.promptGenerationState === 'generating' ? (
                // Show loading state if generation is in progress
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-bold text-secondary-text uppercase tracking-widest">
                        Generating Visual Idea...
                    </span>
                </div>
            ) : (
                // Show generate button
                <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <ImageIcon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-secondary-text uppercase tracking-widest text-center">
                        No Visual Idea Yet
                    </span>
                    <p className="text-xs text-secondary-text text-center max-w-[200px]">
                        Generate a visual idea for this slide
                    </p>
                    <button
                        onClick={handleGeneratePrompt}
                        disabled={isGeneratingPrompt}
                        className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isGeneratingPrompt && (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isGeneratingPrompt ? 'Generating...' : 'Generate Visual Idea'}
                    </button>
                </div>
            )}
        </div>
    ) : (
        // Keep existing prompt display UI (lines 312+)
        // ... existing code for displaying prompts ...
    )}
</footer>
```

5. **Update `handleRetryPromptGeneration` to use new function:**
   ```typescript
   const handleRetryPromptGeneration = async () => {
       if (!projectId || isRetrying) return;
       setIsRetrying(true);
       try {
           await generatePrompt(projectId, slide.id, true); // regenerate = true
           // State will update via Firestore listener
       } catch (error: any) {
           console.error('Error retrying prompt generation:', error);
           const message = error?.response?.data?.error || 'Failed to retry prompt generation. Please try again.';
           alert(message);
       } finally {
           setIsRetrying(false);
       }
   };
   ```


---

### Phase 5: Clean Up Unused Code (Optional)

**File:** `functions/src/services/slideGeneration.ts`

**If removing `generateImagePromptsForAllSlides()` function:**

1. Remove the function definition (lines 345-384)
2. Remove any imports that are only used by this function (if any)
3. Keep `generateImagePromptsForSingleSlide()` as it's still used

**File:** `functions/src/index.ts`

**If removing old retry endpoint:**

1. Remove the `/retry-prompt-generation` endpoint (lines 254-343)
2. Or keep it for backward compatibility and have it call the new endpoint logic

---

## Data Model Changes

**No changes to Firestore data model.** The existing fields remain:

- `imagePrompts`: Array of prompts (0 or 1 item)
- `currentPromptId`: ID of current prompt
- `promptGenerationState`: 'generating' | 'completed' | 'failed'
- `promptGenerationError`: Error message if failed

**Behavior Changes:**

- Slides will be created with `imagePrompts: []` and no `promptGenerationState` initially
- `promptGenerationState` will only be set when user triggers generation
- No automatic state transitions

---

## API Contract Changes

### New Endpoint: `/generate-prompt`

**Request:**

```typescript
POST /generate-prompt
Body: {
    projectId: string;
    slideId: string;
    regenerate?: boolean; // Optional, default: false
}
```

**Response (Success):**

```typescript
{
    success: true;
    message: string;
}
```

**Response (Error):**

```typescript
{
    error: string;
}
```

**Error Cases:**

- `400`: Missing required fields, prompt already exists (unless regenerate=true), already generating
- `401`: Unauthorized
- `404`: Project or slide not found
- `409`: Generation already in progress
- `500`: Server error

### Deprecated Endpoint: `/retry-prompt-generation`

**Status:** Can be kept for backward compatibility or removed after frontend update.

---

## Edge Cases and Failure Modes

### 1. **User Clicks Generate Multiple Times**

- **Solution:** Check `promptGenerationState === 'generating'` before allowing new request
- **Backend:** Returns 409 Conflict if already generating
- **Frontend:** Disable button while `isGeneratingPrompt` is true

### 2. **Network Failure During Generation**

- **Solution:** Firestore state will show 'failed' with error message
- **UI:** Shows retry button with error message
- **User:** Can click retry to try again

### 3. **Slide Deleted While Generating**

- **Solution:** Backend checks slide exists before processing
- **Error Handling:** If slide doesn't exist, generation fails gracefully
- **UI:** Real-time listener will remove slide from UI

### 4. **Project Deleted While Generating**

- **Solution:** Backend verifies project exists and belongs to user
- **Error Handling:** Returns 404 if project not found
- **UI:** Real-time listener will navigate away or show error

### 5. **User Triggers Generation, Then Edits Slide Content**

- **Solution:** Generation uses slide data at time of trigger
- **Behavior:** Prompt is generated based on content at generation time
- **User:** Can regenerate prompt after editing if desired

### 6. **Concurrent Requests from Multiple Tabs**

- **Solution:** Firestore state check prevents duplicate generation
- **Backend:** Atomic update to 'generating' prevents race conditions
- **UI:** Real-time listener updates all tabs simultaneously

### 7. **Rate Limiter Still Applies**

- **Note:** Rate limiter (max 5 concurrent) still applies to API calls
- **Impact:** If user generates prompts for 10+ slides rapidly, some may queue
- **User Experience:** Still much better than automatic generation failing
- **Future:** Could add client-side queuing or disable button during rate limit

---

## Testing Plan

### Unit Tests

1. **Backend:**

            - Test `/generate-prompt` endpoint with valid/invalid inputs
            - Test duplicate request prevention (409 error)
            - Test regeneration flag behavior
            - Test error handling for missing project/slide

2. **Frontend:**

            - Test `handleGeneratePrompt` function
            - Test button states (disabled, loading, etc.)
            - Test error message display

### Integration Tests

1. **End-to-End Flow:**

            - Create slide deck
            - Verify no prompts are generated automatically
            - Click "Generate Visual Idea" button
            - Verify prompt appears in UI
            - Verify Firestore state updates correctly

2. **Error Scenarios:**

            - Test network failure during generation
            - Test duplicate click prevention
            - Test retry after failure

### Manual Testing Checklist

- [ ] Create new slide deck - verify no automatic prompt generation
- [ ] Click "Generate Visual Idea" button - verify prompt generates
- [ ] Verify loading state shows during generation
- [ ] Verify prompt appears after generation completes
- [ ] Test retry button on failed generation
- [ ] Test multiple rapid clicks (should prevent duplicates)
- [ ] Test regeneration (if implemented)
- [ ] Verify Firestore state updates correctly
- [ ] Test with multiple slides (generate prompts individually)
- [ ] Verify real-time updates work across tabs

---

## Rollout Strategy

### Phase 1: Backend Changes (Non-Breaking)

1. Deploy backend changes (remove automatic generation, add new endpoint)
2. Keep old `/retry-prompt-generation` endpoint for backward compatibility
3. Verify backend works correctly

### Phase 2: Frontend Changes

1. Deploy frontend changes (add generate button, remove auto-loading)
2. Test thoroughly in staging
3. Monitor for errors

### Phase 3: Cleanup (Optional)

1. Remove old `/retry-prompt-generation` endpoint after frontend is updated
2. Remove `generateImagePromptsForAllSlides()` function if not needed
3. Update documentation

---

## Rollback Plan

If issues occur:

1. **Backend Rollback:**

            - Re-add automatic `generateImagePromptsForAllSlides()` call after batch.commit()
            - Keep new endpoint for manual generation (optional)

2. **Frontend Rollback:**

            - Revert to showing loading state when `promptGenerationState !== 'completed'`
            - Keep generate button as additional option (hybrid approach)

3. **Full Rollback:**

            - Revert all changes to previous state
            - Automatic generation resumes

---

## Success Criteria

1. ✅ No automatic prompt generation after slide creation
2. ✅ User can trigger prompt generation per slide via button
3. ✅ UI shows appropriate states (no prompt, generating, completed, failed)
4. ✅ Error handling works correctly
5. ✅ No Firestore consistency issues
6. ✅ No rate limiter bottlenecks (user controls when to generate)
7. ✅ Real-time updates work correctly
8. ✅ Build succeeds with no errors

---

## Notes

- **User Experience:** Users now have control over when prompts are generated
- **Performance:** No parallel processing bottlenecks
- **Reliability:** Eliminates Firestore consistency issues
- **Cost:** Users only generate prompts for slides they want images for
- **Future:** Could add "Generate All" button if batch generation is desired later

---

## Implementation Order

1. **Phase 1:** Remove automatic generation from backend
2. **Phase 2:** Add/update backend endpoint
3. **Phase 3:** Update frontend service
4. **Phase 4:** Update UI component
5. **Phase 5:** Clean up unused code (optional)
6. **Testing:** Manual and automated testing
7. **Deployment:** Backend first, then frontend

---

**Plan Created:** [Date]

**Status:** Ready for Implementation