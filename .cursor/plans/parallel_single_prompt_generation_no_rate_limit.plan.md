# Parallel Single Prompt Generation - Implementation Plan

## Context

Refactor the image prompt generation system to generate exactly **1 prompt per slide** using **parallel processing** (all prompts generated simultaneously) after all slides are written to Firestore. Remove the trigger-based parallel processing approach and eliminate artificial rate limiting constraints. The system should process all slides concurrently, with the practical limit being the maximum 25 slides per deck (25 concurrent API calls, well under the 1000/min API rate limit).

## Spec

### Overview

**Current Flow (To Remove):**

```
generateSlidesAndUpdateFirestore()
  → batch.commit() (writes all slides)
    → onSlideCreated trigger fires for EACH slide simultaneously
      → Each trigger calls generateImagePromptsForSlide()
        → Generates 3 prompts per slide sequentially
          → Rate limiter bottleneck (5 concurrent max)
```

**New Flow (Target):**

```
generateSlidesAndUpdateFirestore()
  → batch.commit() (writes all slides)
    → Query all slides (ordered by sortOrder)
      → Process all slides in parallel (Promise.allSettled)
        → Generate 1 prompt per slide simultaneously
        → No rate limiting (up to 25 concurrent calls)
        → Handle errors per slide independently
```

### Phase 1: Simplify Image Prompt Generation Function

**File:** `functions/src/services/imageGeneration.ts`

**Changes:**

1. **Modify `generateImagePrompts()` function signature:**

            - Remove `existingPrompts` parameter (not needed for single prompt)
            - Simplify to generate exactly 1 prompt

2. **Simplify function implementation:**

            - Remove the loop that generates 3 prompts (lines 115-165)
            - Remove temperature variation logic (use single temperature: 0.7)
            - Generate single prompt directly
            - Return simplified result

3. **Update `PromptGenerationResult` interface:**

            - Keep structure but `prompts` array will always contain 0 or 1 prompt
            - Remove `isComplete` field (not needed for single prompt)
            - Simplify `failed` field (will be 0 or 1)

**Key Code Changes:**

````typescript
// BEFORE: Loop generates 3 prompts
for (let i = 0; i < promptsToGenerate; i++) {
    const generateFn = async () => { ... };
    const promptResult = await retryPromptGeneration(generateFn);
    prompts.push(promptResult);
}

// AFTER: Generate single prompt directly
const generateFn = async () => {
    const result = await getAiClient().models.generateContent({
        model: MODEL_SLIDE_GENERATION,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
            systemInstruction: { parts: [{ text: systemInstructions }] },
            temperature: 0.7, // Single temperature, no variation
        }
    });
    
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error("Empty response from AI model");
    }
    
    // Clean up the response (same as before)
    let cleanedPrompt = text
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/```/g, '')
        .trim();
    cleanedPrompt = cleanedPrompt.replace(/^(imagePrompt|Image Prompt|Prompt):\s*/i, '').trim();
    
    const inputTokens = result.usageMetadata?.promptTokenCount || 0;
    const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;
    
    return {
        id: crypto.randomUUID(),
        text: cleanedPrompt,
        inputTokens,
        outputTokens
    };
};

try {
    const promptResult = await retryPromptGeneration(generateFn);
    return {
        prompts: [promptResult],
        failed: 0,
        totalInputTokens: promptResult.inputTokens,
        totalOutputTokens: promptResult.outputTokens
    };
} catch (error) {
    console.error('Error generating prompt:', error);
    return {
        prompts: [],
        failed: 1,
        totalInputTokens: 0,
        totalOutputTokens: 0
    };
}
````

**Function Signature Change:**

```typescript
// BEFORE:
export async function generateImagePrompts(
    topic: string,
    subject: string,
    gradeLevel: string,
    slideTitle: string,
    slideContent: string[],
    existingPrompts: any[] = []  // REMOVE THIS
): Promise<PromptGenerationResult>

// AFTER:
export async function generateImagePrompts(
    topic: string,
    subject: string,
    gradeLevel: string,
    slideTitle: string,
    slideContent: string[]
): Promise<PromptGenerationResult>
```

### Phase 2: Create Parallel Processing Function

**File:** `functions/src/services/slideGeneration.ts`

**Changes:**

1. **Add new function `generateImagePromptsForAllSlides()`:**

            - Query all slides ordered by `sortOrder`
            - Process all slides in parallel using `Promise.allSettled`
            - Each slide processes independently
            - Handle errors per slide (don't fail entire process)

2. **Import necessary dependencies:**

            - Add `generateImagePrompts` from `./imageGeneration`
            - Add `calculateAndIncrementProjectCost` from `./pricingService`
            - Add `MODEL_SLIDE_GENERATION` from `@shared/constants`
            - Add `Slide`, `ImagePrompt`, `ProjectData` types from `@shared/types`

**New Function Implementation:**

```typescript
/**
 * Generates image prompts for all slides in parallel (one prompt per slide).
 * Processes slides simultaneously with no rate limiting constraints.
 * Errors are handled per slide independently.
 */
async function generateImagePromptsForAllSlides(
    projectRef: admin.firestore.DocumentReference,
    projectData: ProjectData
): Promise<void> {
    const db = projectRef.firestore;
    const slidesCollectionRef = projectRef.collection('slides');
    
    // Query all slides ordered by sortOrder
    const slidesSnapshot = await slidesCollectionRef
        .orderBy('sortOrder', 'asc')
        .get();
    
    if (slidesSnapshot.empty) {
        console.log('[PROMPT_GEN] No slides found to process');
        return;
    }
    
    console.log(`[PROMPT_GEN] Starting parallel prompt generation for ${slidesSnapshot.size} slides`);
    
    // Process all slides in parallel
    const promptPromises = slidesSnapshot.docs.map(async (slideDoc) => {
        const slideRef = slideDoc.ref;
        const slideData = slideDoc.data() as Slide;
        
        // Skip if already has a prompt
        if ((slideData.imagePrompts || []).length >= 1) {
            console.log(`[PROMPT_GEN] Slide ${slideDoc.id} already has prompt, skipping`);
            return { slideId: slideDoc.id, success: true, skipped: true };
        }
        
        try {
            // Update state to generating
            await slideRef.update({
                promptGenerationState: 'generating',
                updatedAt: FieldValue.serverTimestamp()
            });
            
            // Generate single prompt (bypass rate limiter - direct API call)
            const result = await generateImagePrompts(
                projectData.topic || '',
                projectData.subject || '',
                projectData.gradeLevel || '',
                slideData.title || '',
                slideData.content || []
            );
            
            // Save the prompt
            if (result.prompts.length > 0) {
                const prompt = result.prompts[0];
                await slideRef.update({
                    imagePrompts: [{
                        id: prompt.id,
                        text: prompt.text,
                        inputTokens: prompt.inputTokens,
                        outputTokens: prompt.outputTokens,
                        createdAt: Date.now(),
                        isOriginal: true
                    }],
                    currentPromptId: prompt.id,
                    promptGenerationState: 'completed',
                    updatedAt: FieldValue.serverTimestamp()
                });
                
                // Track costs
                await calculateAndIncrementProjectCost(
                    projectRef,
                    MODEL_SLIDE_GENERATION,
                    result.totalInputTokens,
                    result.totalOutputTokens,
                    'text'
                );
                
                console.log(`[PROMPT_GEN] Successfully generated prompt for slide ${slideDoc.id}`);
                return { slideId: slideDoc.id, success: true, tokens: result.totalInputTokens + result.totalOutputTokens };
            } else {
                throw new Error('No prompt generated');
            }
        } catch (error: any) {
            console.error(`[PROMPT_GEN] Error generating prompt for slide ${slideDoc.id}:`, error);
            await slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: error.message || 'Failed to generate prompt',
                updatedAt: FieldValue.serverTimestamp()
            });
            return { slideId: slideDoc.id, success: false, error: error.message };
        }
    });
    
    // Wait for all slides to complete (success or failure)
    const results = await Promise.allSettled(promptPromises);
    
    // Log summary
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    console.log(`[PROMPT_GEN] Completed parallel prompt generation: ${successful} successful, ${failed} failed`);
}
```

**Integration Point:**

In `generateSlidesAndUpdateFirestore()`, after `batch.commit()` (line 302):

```typescript
await batch.commit();

// Generate image prompts in parallel for all slides
await generateImagePromptsForAllSlides(projectRef, projectData);

// Continue with existing cost tracking and status updates
```

### Phase 3: Remove Trigger-Based Processing

**File:** `functions/src/index.ts`

**Changes:**

1. **Remove `onSlideCreated` trigger entirely** (lines 381-446)
2. **Remove import of `generateImagePromptsForSlide`** from `promptGenerationService.ts`
3. **Remove import of `onDocumentCreated`** if not used elsewhere
4. **Keep the retry endpoint** but simplify it (see Phase 4)

### Phase 4: Simplify Retry Endpoint

**File:** `functions/src/index.ts`

**Changes:**

1. **Update `/retry-prompt-generation` endpoint** (lines 256-378):

            - Generate 1 prompt instead of 3
            - For single slide retry: call `generateImagePrompts()` directly (parallel processing)
            - For batch retry: use `Promise.allSettled` to process slides in parallel
            - Remove transaction complexity (not needed for parallel model)

**Simplified Retry Logic:**

```typescript
if (slideId) {
    // Retry single slide
    const slideRef = projectRef.collection('slides').doc(slideId);
    const slideDoc = await slideRef.get();
    
    if (!slideDoc.exists) {
        res.status(404).json({ error: "Slide not found" });
        return;
    }
    
    const slideData = slideDoc.data() as Slide;
    const projectData = (await projectRef.get()).data() as ProjectData;
    
    // Update state
    await slideRef.update({
        promptGenerationState: 'generating',
        promptGenerationError: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
    });
    
    // Generate single prompt (fire and forget - process in background)
    generateImagePromptsForSingleSlide(slideRef, projectData, slideData).catch(console.error);
    res.json({ success: true, message: `Prompt generation started for slide ${slideId}` });
    
} else {
    // Retry all failed slides in parallel
    const failedSlidesSnapshot = await projectRef.collection('slides')
        .where('promptGenerationState', '==', 'failed')
        .get();
    
    if (failedSlidesSnapshot.empty) {
        res.json({ success: true, message: "No failed slides found to retry." });
        return;
    }
    
    const projectData = (await projectRef.get()).data() as ProjectData;
    
    // Process all failed slides in parallel
    const retryPromises = failedSlidesSnapshot.docs.map(async (slideDoc) => {
        const slideData = slideDoc.data() as Slide;
        if ((slideData.imagePrompts || []).length >= 1) return; // Skip if already has prompt
        
        await slideDoc.ref.update({
            promptGenerationState: 'generating',
            promptGenerationError: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp()
        });
        
        return generateImagePromptsForSingleSlide(slideDoc.ref, projectData, slideData);
    });
    
    await Promise.allSettled(retryPromises);
    res.json({ success: true, message: `Retry started for ${failedSlidesSnapshot.size} slides.` });
}

// Helper function (can be added to slideGeneration.ts or kept local)
async function generateImagePromptsForSingleSlide(
    slideRef: admin.firestore.DocumentReference,
    projectData: ProjectData,
    slideData: Slide
): Promise<void> {
    try {
        const result = await generateImagePrompts(
            projectData.topic || '',
            projectData.subject || '',
            projectData.gradeLevel || '',
            slideData.title || '',
            slideData.content || []
        );
        
        if (result.prompts.length > 0) {
            const prompt = result.prompts[0];
            await slideRef.update({
                imagePrompts: [{
                    id: prompt.id,
                    text: prompt.text,
                    inputTokens: prompt.inputTokens,
                    outputTokens: prompt.outputTokens,
                    createdAt: Date.now(),
                    isOriginal: true
                }],
                currentPromptId: prompt.id,
                promptGenerationState: 'completed',
                updatedAt: FieldValue.serverTimestamp()
            });
            
            // Track costs (need projectRef - pass as parameter or get from slideRef)
            const projectRef = slideRef.parent.parent!;
            await calculateAndIncrementProjectCost(
                projectRef,
                MODEL_SLIDE_GENERATION,
                result.totalInputTokens,
                result.totalOutputTokens,
                'text'
            );
        } else {
            throw new Error('No prompt generated');
        }
    } catch (error: any) {
        console.error(`[RETRY] Error for slide ${slideRef.id}:`, error);
        await slideRef.update({
            promptGenerationState: 'failed',
            promptGenerationError: error.message || 'Failed to generate prompt',
            updatedAt: FieldValue.serverTimestamp()
        });
    }
}
```

### Phase 5: Remove or Simplify Prompt Generation Service

**File:** `functions/src/services/promptGenerationService.ts`

**Changes:**

1. **DELETE entire file** (no longer needed) OR
2. **Keep file but remove all functions** (if file is imported elsewhere for types)

**Functions to Remove:**

- `generateImagePromptsForSlide()` - replaced by parallel processing
- `savePromptIncrementally()` - no longer needed (direct updates)

### Phase 6: Update UI Components

**File:** `src/components/SlideCard.tsx`

**Changes:**

1. **Remove prompt navigation UI** (lines 388-412):

            - Remove "Idea X of Y" navigation buttons (prev/next)
            - Remove prompt counter display

2. **Update loading state logic:**

            - Remove check for `imagePrompts.length < 3` (partial progress)
            - Simplify to check if `imagePrompts.length === 0`

3. **Update loading messages:**

            - Remove "X of 3 prompts generated" message
            - Simplify to "Generating Visual Idea..." when `promptGenerationState === 'generating'`

**Key UI Changes:**

```typescript
// BEFORE: Check for partial progress (0-3 prompts)
) : (slide.promptGenerationState !== 'completed' && imagePrompts.length > 0 && imagePrompts.length < 3) ? (
    <div>... {imagePrompts.length} of 3 prompts generated</div>

// AFTER: Check for 0 prompts (1 is complete)
) : (slide.promptGenerationState !== 'completed' && imagePrompts.length === 0) ? (
    <div>... Generating Visual Idea...</div>

// REMOVE: Prompt navigation (lines 388-412)
// {imagePrompts.length > 1 && !isEditingPrompt && (
//     <div className="flex items-center gap-4">
//         <button onClick={...}>Previous</button>
//         <span>Idea {currentIndex + 1} of {imagePrompts.length}</span>
//         <button onClick={...}>Next</button>
//     </div>
// )}
```

### Phase 7: Update Type Definitions

**File:** `shared/types.ts`

**Changes:**

1. **Simplify `Slide` interface:**

            - Remove `promptGenerationProgress` field (no longer tracking 0-3 prompts)
            - Keep `promptGenerationState` and `promptGenerationError` for error handling

**Updated Interface:**

```typescript
export interface Slide {
    // ... existing fields ...
    
    imagePrompts?: ImagePrompt[];     // Array (will contain 0 or 1 prompt)
    currentPromptId?: string;         // ID of prompt (single prompt)
    
    // Simplified state tracking (only generating/completed/failed)
    promptGenerationState?: 'generating' | 'completed' | 'failed';
    promptGenerationError?: string;
    
    // REMOVE: promptGenerationProgress field
    // promptGenerationProgress?: {
    //     succeeded: number;
    //     failed: number;
    // };
}
```

### Phase 8: Update Firestore Rules

**File:** `firestore.rules`

**Changes:**

1. **Remove validation for `promptGenerationProgress` field**
2. **Keep validation for `promptGenerationState`** (generating/completed/failed)

**Updated Rules:**

```javascript
// BEFORE: Validation includes promptGenerationProgress
function isValidSlide(slide) {
    return slide.promptGenerationState == null ||
           slide.promptGenerationState in ['generating', 'completed', 'failed'] &&
           // ... other validations
}

// AFTER: Remove promptGenerationProgress validation
function isValidSlide(slide) {
    return slide.promptGenerationState == null ||
           slide.promptGenerationState in ['generating', 'completed', 'failed'] &&
           // ... other validations (no promptGenerationProgress check)
}
```

### Phase 9: Remove Rate Limiter for Prompt Generation (Optional)

**File:** `functions/src/services/imageGeneration.ts` or create bypass

**Note:** The current `retryPromptGeneration()` function uses the rate limiter. For true parallel processing without rate limits, we have two options:

**Option A (Recommended):** Keep rate limiter but increase limit or accept queuing

- Rate limiter will queue requests (first 5 start, next 5 wait, etc.)
- Still much faster than sequential
- Safer (respects process-local limits)

**Option B:** Bypass rate limiter for this use case

- Create a new function `generateImagePromptDirect()` that calls Gemini API directly
- Skip `retryPromptGeneration()` wrapper
- Use direct API call with basic retry logic

**Recommendation:** Keep Option A (rate limiter will still allow parallel processing with automatic queuing). The 5 concurrent limit will handle up to 25 slides in ~5 batches (still much faster than sequential).

### Phase 10: Clean Up Imports

**Files to Update:**

1. **`functions/src/index.ts`:**

            - Remove: `import { generateImagePromptsForSlide } from './services/promptGenerationService';`
            - Remove: `import { onDocumentCreated }` if not used elsewhere
            - Add: `import { generateImagePrompts } from './services/imageGeneration';` (if needed for retry endpoint)

2. **`functions/src/services/slideGeneration.ts`:**

            - Add: `import { generateImagePrompts } from './imageGeneration';`
            - Add: `import { calculateAndIncrementProjectCost } from './pricingService';`
            - Add: `import { MODEL_SLIDE_GENERATION } from '@shared/constants';`
            - Add: `import type { Slide, ImagePrompt, ProjectData } from '@shared/types';`

## Acceptance Criteria

1. **Single Prompt Per Slide:**

            - Each slide has exactly 0 or 1 prompt (never 3)
            - Verification: Check Firestore - `imagePrompts` array contains 0 or 1 item

2. **Parallel Processing:**

            - All prompts generate simultaneously after slides are written
            - Verification: Check Cloud Functions logs - all prompts start within ~1 second of batch.commit()
            - For 10 slides, total time should be ~2-5 seconds (not 20-30 seconds sequential)

3. **No Trigger-Based Processing:**

            - `onSlideCreated` trigger is removed
            - Verification: Check `functions/src/index.ts` - trigger code is deleted
            - Verification: No trigger functions deployed

4. **State Management:**

            - Slides track `promptGenerationState`: 'generating' | 'completed' | 'failed'
            - No `promptGenerationProgress` field
            - Verification: Check Firestore documents - only state fields exist

5. **UI Updates:**

            - No prompt navigation buttons (prev/next)
            - Loading state shows "Generating Visual Idea..." when generating
            - No "X of 3 prompts" messages
            - Verification: Manual UI testing - check SlideCard component

6. **Error Handling:**

            - Failed slides don't block other slides
            - Each slide handles errors independently
            - Verification: Simulate API failure - other slides continue processing

7. **Retry Endpoint:**

            - Retry endpoint generates 1 prompt
            - Batch retry processes slides in parallel
            - Verification: Test retry endpoint - verify single prompt generation

8. **Build Success:**

            - TypeScript compilation succeeds
            - No type errors
            - Verification: Run `npm run build` in `functions/` directory

## Edge Cases

1. **Empty Slide Array:**

            - Handle gracefully when no slides exist
            - Function should return early without errors
            - **Solution:** Check `slidesSnapshot.empty` before processing

2. **Slide Already Has Prompt:**

            - Skip slides that already have a prompt
            - Don't regenerate or overwrite existing prompts
            - **Solution:** Check `imagePrompts.length >= 1` before processing

3. **API Failure for One Slide:**

            - One slide's failure shouldn't affect others
            - Failed slide should have state set to 'failed'
            - **Solution:** Use `Promise.allSettled` and handle errors per slide

4. **Partial Success:**

            - If some slides succeed and some fail, all successes should be saved
            - Failed slides should be retryable
            - **Solution:** `Promise.allSettled` ensures all promises complete (success or failure)

5. **Race Condition (Retry During Generation):**

            - If user retries while initial generation is running
            - Should handle gracefully (state check)
            - **Solution:** Check `promptGenerationState === 'generating'` before retry

6. **Very Large Slide Deck (25 slides):**

            - 25 concurrent API calls should work
            - Rate limiter will queue (5 at a time)
            - **Solution:** Rate limiter handles queuing automatically

7. **Cost Tracking:**

            - Costs should be tracked per slide
            - Multiple slides shouldn't double-count costs
            - **Solution:** Each slide tracks its own costs independently

8. **Firestore Transaction Limits:**

            - Too many simultaneous writes could cause contention
            - **Solution:** Use direct updates (not transactions) - each slide updates independently

9. **Function Timeout:**

            - Cloud Functions have timeout limits (60s default, 540s max)
            - 25 slides × 2-3 seconds = 50-75 seconds (within limits)
            - **Solution:** Parallel processing ensures completion within timeout

10. **Network Instabilities:**

                - Individual API calls may timeout or fail
                - Retry logic handles transient failures
                - **Solution:** `retryPromptGeneration` includes retry logic with exponential backoff

## Tests

### Unit Tests

1. **`generateImagePrompts()` function:**

            - Test: Generates exactly 1 prompt
            - Test: Returns empty array on error
            - Test: Handles API errors gracefully
            - File: `functions/src/services/imageGeneration.ts` (if tests exist)

2. **`generateImagePromptsForAllSlides()` function:**

            - Test: Processes all slides in parallel
            - Test: Handles empty slide array
            - Test: Skips slides with existing prompts
            - Test: Updates state correctly per slide
            - File: `functions/src/services/slideGeneration.ts` (if tests exist)

### Integration Tests

1. **End-to-End Prompt Generation:**

            - Test: Create project with 10 slides
            - Verify: All prompts generate in parallel
            - Verify: Total time < 10 seconds
            - Verify: All slides have 1 prompt or failed state

2. **Error Handling:**

            - Test: Simulate API failure for one slide
            - Verify: Other slides continue processing
            - Verify: Failed slide has state 'failed'
            - Verify: Successful slides have prompts saved

3. **Retry Endpoint:**

            - Test: Retry single failed slide
            - Verify: Generates 1 prompt
            - Verify: State updates correctly
            - Test: Batch retry multiple failed slides
            - Verify: Processes in parallel

### Manual Testing Checklist

1. **Create New Project:**

            - [ ] Generate slide deck with 10 slides
            - [ ] Verify prompts generate after slides are written
            - [ ] Verify all prompts complete in ~2-5 seconds
            - [ ] Check Firestore - each slide has 0 or 1 prompt

2. **UI Verification:**

            - [ ] No prompt navigation buttons (prev/next)
            - [ ] Loading state shows "Generating Visual Idea..."
            - [ ] No "X of 3 prompts" messages
            - [ ] Single prompt displays correctly

3. **Error Scenarios:**

            - [ ] Simulate network error (one slide fails)
            - [ ] Verify other slides continue processing
            - [ ] Verify failed slide shows error state
            - [ ] Test retry button on failed slide

4. **Edge Cases:**

            - [ ] Test with 25 slides (maximum)
            - [ ] Verify all prompts generate (may take longer due to queuing)
            - [ ] Test retry during generation (should handle gracefully)

## Implementation Notes

1. **Rate Limiter Behavior:**

            - The rate limiter (`maxConcurrent = 5`) will still queue requests
            - With 25 slides, requests will be processed in batches of 5
            - This is still parallel processing (5 at a time) and much faster than sequential
            - To remove rate limiting entirely, Option B in Phase 9 would be needed

2. **Promise.allSettled vs Promise.all:**

            - Use `Promise.allSettled` (not `Promise.all`)
            - Ensures all promises complete even if some fail
            - Allows independent error handling per slide

3. **Cost Tracking:**

            - Each slide tracks costs independently
            - Costs are accumulated at project level
            - Multiple parallel updates are safe (Firestore increments are atomic)

4. **Order of Processing:**

            - Slides are queried ordered by `sortOrder`
            - But processing happens in parallel (order not guaranteed)
            - This is acceptable - prompts don't depend on order

5. **State Updates:**

            - Use direct `update()` calls (not transactions)
            - Each slide updates independently
            - No contention since each slide is a separate document

## Success Metrics

- ✅ All prompts generate in parallel (within 1 second of batch.commit())
- ✅ Total time for 10 slides: < 10 seconds
- ✅ Each slide has exactly 0 or 1 prompt
- ✅ Failed slides don't block successful ones
- ✅ UI correctly displays single prompt
- ✅ No trigger-based processing
- ✅ Build succeeds with no errors