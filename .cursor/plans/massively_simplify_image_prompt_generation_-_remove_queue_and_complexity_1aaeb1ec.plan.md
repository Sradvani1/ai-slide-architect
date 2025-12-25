---
name: Massively Simplify Image Prompt Generation - Remove Queue and Complexity
overview: Remove the queue system entirely and simplify image prompt generation to match the streamlined slide generation pattern. Process prompts directly in the Firestore trigger with built-in retry logic, eliminating unnecessary complexity while maintaining all functionality.
todos:
  - id: simplify-processing-function
    content: Refactor generateImagePromptsForSlide to process directly without queue (remove QueueItem parameter, remove attempt tracking, use simple try/catch)
    status: pending
  - id: simplify-trigger
    content: Simplify onSlideCreated trigger to process directly (remove transaction complexity, queue operations, direct function call)
    status: pending
    dependencies:
      - simplify-processing-function
  - id: simplify-retry-endpoint
    content: Simplify /retry-prompt-generation endpoint (remove queue operations, reset state and process directly)
    status: pending
    dependencies:
      - simplify-processing-function
  - id: update-type-definitions
    content: Update Slide interface in shared/types.ts to remove unused state fields (keep only generating/completed/failed states, error, progress)
    status: pending
  - id: delete-queue-files
    content: Delete promptQueue.ts and promptGenerationStateMachine.ts files
    status: pending
    dependencies:
      - simplify-trigger
      - simplify-retry-endpoint
  - id: update-imports
    content: Remove queue-related imports from index.ts, add generateImagePromptsForSlide import
    status: pending
    dependencies:
      - delete-queue-files
  - id: update-ui-components
    content: Simplify SlideCard.tsx state checks to use only generating/completed/failed states
    status: pending
    dependencies:
      - update-type-definitions
  - id: update-firestore-rules
    content: Simplify firestore.rules validation and remove queue collection rules
    status: pending
    dependencies:
      - update-type-definitions
  - id: remove-firestore-indexes
    content: Remove queue-related indexes from firestore.indexes.json
    status: pending
  - id: verify-build
    content: Verify TypeScript build passes and all functionality works
    status: pending
    dependencies:
      - update-imports
      - update-ui-components
      - update-firestore-rules
---

# Massively Simplify Image Prompt Generation

## Objective

Transform image prompt generation from a complex queue-based system to a simple, direct processing pattern matching slide generation. Remove all unnecessary complexity while maintaining:

- ✅ Automatic retry on failures
- ✅ Rate limiting to prevent API floods
- ✅ Partial progress tracking (keep successful prompts)
- ✅ Error handling and user feedback
- ✅ Manual retry capability

## Current Complexity Analysis

### What We Have Now (Complex):

1. **Queue System** (promptQueue.ts - 189 lines)

- Separate Firestore collection (`promptGenerationQueue`)
- Queue items with status, priority, attempts
- Failed queue collection (`failedPromptGenerationQueue`)
- `enqueueSlide`, `enqueueSlideInBatch`, `processQueueItemImmediately`
- `moveToFailedQueue` function
- Atomic transactions for claiming items
- Recursive setTimeout retries

2. **State Machine** (7+ fields on Slide)

- 6 states: `pending`, `queued`, `generating`, `partial`, `completed`, `failed`
- `promptGenerationState`
- `promptGenerationError`
- `promptGenerationAttempts`
- `promptGenerationLastAttempt` ❌ (never used)
- `promptGenerationNextRetry` ❌ (calculated but unused)
- `promptGenerationQueuedAt` ❌ (queue artifact)
- `promptGenerationProgress` (succeeded, failed, lastSuccessAt)

3. **Unused State Machine Functions** (promptGenerationStateMachine.ts - 38 lines)

- `validateStateTransition()` ❌ (never called)
- `calculateNextRetryTime()` ❌ (calculated but not used)

4. **Complex Service Layer** (promptGenerationService.ts - 232 lines)

- Handles queue items
- Complex retry logic with re-enqueueing
- Incremental saving with transaction retry logic

5. **Complex Trigger** (index.ts onSlideCreated)

- Transaction to check state
- Enqueue to queue collection
- Update slide state
- Call processQueueItemImmediately

### What Slide Generation Has (Simple):

- Direct processing in background function
- Built-in retry logic (`retryWithBackoff`)
- Simple state: `generating`, `completed`, `failed`
- Direct Firestore updates
- No queue, no state machine complexity

## Simplification Impact Analysis

### 1. Remove Queue System

**Impact:**

- **Removes**: `promptQueue.ts` file (189 lines), queue collection, failed queue collection
- **Keeps**: Rate limiting (already in `retryPromptGeneration` - max 5 concurrent per process)
- **How it works**: Rate limiter in `retryPromptGeneration` already prevents floods. Multiple function instances each limit to 5 concurrent = natural coordination.

**Risk**: Minimal. Rate limiter provides coordination. Process-local limit of 5 concurrent means even with 10 instances, max 50 concurrent calls (well under 1000/min limit).

### 2. Remove Unused State Machine Code

**Impact:**

- **Removes**: `promptGenerationStateMachine.ts` file (38 lines)
- **Removes**: `validateStateTransition()` (never used)
- **Removes**: `calculateNextRetryTime()` (calculated but unused)
- **No functionality loss**: These functions are never actually used

### 3. Simplify State Fields

**Impact:**

- **Remove**: `promptGenerationLastAttempt` (tracked but unused)
- **Remove**: `promptGenerationNextRetry` (calculated but unused)
- **Remove**: `promptGenerationQueuedAt` (queue artifact)
- **Keep**: `promptGenerationState` (simplified to 3 states: `generating`, `completed`, `failed`)
- **Keep**: `promptGenerationProgress` (for partial progress tracking)
- **Keep**: `promptGenerationError` (for user feedback)
- **Remove**: `promptGenerationAttempts` (not needed - retry logic handles this)

**Functionality preserved**: UI can still show status and progress.

### 4. Simplify Processing Flow

**New Flow (Simple):**

```javascript
Slide Created → Firestore Trigger → Direct Processing
                                           ↓
                                    generateImagePrompts()
                                    (with retryPromptGeneration)
                                           ↓
                                    Save all prompts at once
                                    (or save incrementally)
                                           ↓
                                    Update slide state
```

**Impact:**

- **Removes**: Queue operations, atomic claiming, recursive setTimeout
- **Uses**: Built-in retry logic (`retryPromptGeneration` already has exponential backoff)
- **Simpler**: Process directly like slide generation

### 5. Remove Failed Queue Collection

**Impact:**

- **Removes**: `failedPromptGenerationQueue` collection
- **Removes**: `moveToFailedQueue()` function
- **Keeps**: Failed state on slide document (for UI feedback)
- **No functionality loss**: Failed queue was only for cleanup/history

### 6. Simplify Incremental Saving

**Options:**

- **Option A**: Keep incremental saving (preserves partial progress)
- **Option B**: Save all at once (simpler, but loses partial progress)

**Recommendation**: Keep incremental saving - it's valuable and only ~50 lines of code with transaction retry logic.

## Implementation Plan

### Phase 1: Simplify Processing Function

**File:** `functions/src/services/promptGenerationService.ts`Transform `generateImagePromptsForSlide` to process directly without queue:

```typescript
/**
    * Generate image prompts for a slide directly (no queue).
    * Similar pattern to slide generation - direct processing with retry logic.
 */
export async function generateImagePromptsForSlide(
    slideRef: admin.firestore.DocumentReference,
    projectRef: admin.firestore.DocumentReference
): Promise<void> {
    const slideDoc = await slideRef.get();
    if (!slideDoc.exists) {
        console.warn(`[PROMPT_GEN] Slide ${slideRef.id} not found. Skipping.`);
        return;
    }

    const slideData = slideDoc.data() as Slide;
    const existingPrompts: ImagePrompt[] = slideData.imagePrompts || [];

    // Already complete
    if (existingPrompts.length >= 3) {
        await slideRef.update({
            promptGenerationState: 'completed',
            updatedAt: FieldValue.serverTimestamp()
        });
        return;
    }

    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
        console.warn(`[PROMPT_GEN] Project not found for slide ${slideRef.id}. Skipping.`);
        return;
    }

    const projectData = projectDoc.data() as ProjectData;

    // Update state to generating
    await slideRef.update({
        promptGenerationState: 'generating',
        updatedAt: FieldValue.serverTimestamp()
    });

    try {
        // Generate prompts (uses retryPromptGeneration internally for rate limiting)
        const result = await generateImagePrompts(
            projectData.topic || '',
            projectData.subject || '',
            projectData.gradeLevel || '',
            slideData.title || '',
            slideData.content || [],
            existingPrompts
        );

        // Save prompts incrementally (preserves partial progress)
        for (const prompt of result.prompts) {
            await savePromptIncrementally(slideRef, {
                id: prompt.id,
                text: prompt.text,
                inputTokens: prompt.inputTokens,
                outputTokens: prompt.outputTokens,
                createdAt: Date.now(),
                isOriginal: true
            });
        }

        const allPromptsCount = existingPrompts.length + result.prompts.length;

        if (result.isComplete || allPromptsCount >= 3) {
            // Track costs on completion
            await calculateAndIncrementProjectCost(
                projectRef,
                MODEL_SLIDE_GENERATION,
                result.totalInputTokens,
                result.totalOutputTokens,
                'text'
            );

            await slideRef.update({
                promptGenerationState: 'completed',
                'promptGenerationProgress.succeeded': 3,
                updatedAt: FieldValue.serverTimestamp()
            });
        } else {
            // Partial success - mark as failed so user can retry
            await slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: `Only ${allPromptsCount} of 3 prompts generated. Click retry to continue.`,
                'promptGenerationProgress.succeeded': allPromptsCount,
                updatedAt: FieldValue.serverTimestamp()
            });
        }
    } catch (error: any) {
        console.error(`[PROMPT_GEN] Error generating prompts for slide ${slideRef.id}:`, error);
        await slideRef.update({
            promptGenerationState: 'failed',
            promptGenerationError: error.message || 'Failed to generate prompts',
            updatedAt: FieldValue.serverTimestamp()
        });
    }
}
```

**Changes:**

- Remove `QueueItem` parameter
- Remove attempt tracking
- Remove re-enqueueing logic
- Process directly with simple try/catch
- Use built-in retry from `retryPromptGeneration`

### Phase 2: Simplify Trigger

**File:** `functions/src/index.ts`Simplify `onSlideCreated` trigger:

```typescript
export const onSlideCreated = onDocumentCreated(
    {
        document: 'users/{userId}/projects/{projectId}/slides/{slideId}',
        secrets: [apiKey],
        timeoutSeconds: 60,
        maxInstances: 100
    },
    async (event) => {
        const slideRef = event.data?.ref;
        if (!slideRef) return;

        const projectId = event.params.projectId;
        const userId = event.params.userId;

        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        // Simple check: skip if already processing or completed
        const slideDoc = await slideRef.get();
        if (!slideDoc.exists) return;

        const slideData = slideDoc.data() as Slide;
        const existingPrompts = slideData.imagePrompts || [];
        
        // Skip if already complete or currently generating
        if (existingPrompts.length >= 3 || slideData.promptGenerationState === 'generating') {
            return;
        }

        // Process directly (background, don't await)
        generateImagePromptsForSlide(slideRef, projectRef).catch(error => {
            console.error(`[TRIGGER] Error processing prompts for slide ${slideRef.id}:`, error);
            slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: 'Failed to start prompt generation',
                updatedAt: FieldValue.serverTimestamp()
            }).catch(updateError => {
                console.error(`[TRIGGER] Failed to update error state:`, updateError);
            });
        });
    }
);
```

**Changes:**

- Remove transaction complexity
- Remove queue operations
- Remove state machine checks
- Simple existence/state check
- Direct function call (fire and forget)

### Phase 3: Simplify Retry Endpoint

**File:** `functions/src/index.ts`Simplify retry endpoint:

```typescript
app.post('/retry-prompt-generation', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { projectId, slideId } = req.body;

        if (!projectId) {
            res.status(400).json({ error: "Missing required field: projectId" });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found or unauthorized" });
            return;
        }

        if (slideId) {
            // Retry specific slide
            const slideRef = projectRef.collection('slides').doc(slideId);
            const slideDoc = await slideRef.get();
            if (!slideDoc.exists) {
                res.status(404).json({ error: "Slide not found" });
                return;
            }

            // Reset state
            await slideRef.update({
                promptGenerationState: null, // Clear state
                promptGenerationError: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Process directly
            generateImagePromptsForSlide(slideRef, projectRef).catch(error => {
                console.error(`[RETRY] Error processing prompts for slide ${slideId}:`, error);
            });

            res.json({ success: true, message: `Slide ${slideId} retry started.` });
        } else {
            // Retry all failed slides
            const failedSlidesSnapshot = await projectRef.collection('slides')
                .where('promptGenerationState', '==', 'failed')
                .get();

            if (failedSlidesSnapshot.empty) {
                res.json({ success: true, message: "No failed slides found to retry." });
                return;
            }

            // Reset and process all failed slides
            const batch = db.batch();
            failedSlidesSnapshot.docs.forEach(slideDoc => {
                batch.update(slideDoc.ref, {
                    promptGenerationState: null,
                    promptGenerationError: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();

            // Process each slide (fire and forget)
            for (const slideDoc of failedSlidesSnapshot.docs) {
                generateImagePromptsForSlide(slideDoc.ref, projectRef).catch(error => {
                    console.error(`[RETRY] Error processing slide ${slideDoc.id}:`, error);
                });
            }

            res.json({ success: true, message: `Retry started for ${failedSlidesSnapshot.size} slides.` });
        }
    } catch (error: any) {
        console.error("Retry Prompt Generation Error:", error);
        res.status(500).json({ error: "Failed to retry prompt generation" });
    }
});
```

**Changes:**

- Remove queue operations
- Remove state machine complexity
- Reset state and process directly

### Phase 4: Update Type Definitions

**File:** `shared/types.ts`Simplify Slide interface:

```typescript
export interface Slide {
    // ... existing fields ...

    // Simplified state tracking
    promptGenerationState?: 'generating' | 'completed' | 'failed';
    promptGenerationError?: string;
    
    // Progress tracking (for partial success)
    promptGenerationProgress?: {
        succeeded: number;
        failed: number;
    };
    
    // Remove: promptGenerationAttempts
    // Remove: promptGenerationLastAttempt
    // Remove: promptGenerationNextRetry
    // Remove: promptGenerationQueuedAt
}
```



### Phase 5: Remove Unused Files

**Delete Files:**

- `functions/src/services/promptQueue.ts` (entire file - 189 lines)
- `functions/src/services/promptGenerationStateMachine.ts` (entire file - 38 lines)

### Phase 6: Update Imports

**File:** `functions/src/index.ts`Remove queue-related imports:

```typescript
// Remove:
import { enqueueSlide, enqueueSlideInBatch, processQueueItemImmediately } from './services/promptQueue';
import { QueueItem } from './services/promptQueue';

// Add:
import { generateImagePromptsForSlide } from './services/promptGenerationService';
```



### Phase 7: Update UI Components

**File:** `src/components/SlideCard.tsx`Simplify state checks (remove queue-specific states):

```typescript
// Simplify to 3 states: generating, completed, failed
{slide.promptGenerationState === 'failed' ? (
    // Failed UI with retry button
) : (slide.promptGenerationState !== 'completed' && imagePrompts.length > 0 && imagePrompts.length < 3) ? (
    // Partial progress UI
) : (slide.promptGenerationState !== 'completed' && imagePrompts.length === 0) ? (
    // Generating UI
    {slide.promptGenerationState === 'generating' ? 'Generating Visual Ideas...' : 'Preparing Ideas...'}
) : (
    // Normal display
)}
```

**Changes:**

- Remove `queued`, `pending`, `partial` state checks
- Use `imagePrompts.length` for partial progress detection
- Simplify to 3 states matching backend

### Phase 8: Update Firestore Rules

**File:** `firestore.rules`Simplify validation (remove queue-specific fields):

```typescript
function isValidSlide(data) {
    // ... existing validations ...
    
    // Simplified state validation
    let validState = !data.hasAny(['promptGenerationState']) || 
                     data.promptGenerationState in ['generating', 'completed', 'failed'];
    
    // Remove validation for: promptGenerationAttempts, promptGenerationNextRetry, etc.
    
    return validTitle && validContent && validLayout && validState;
}
```



### Phase 9: Remove Queue Collections from Rules

**File:** `firestore.rules`Remove rules for queue collections (no longer exist):

```typescript
// DELETE these rules:
// match /promptGenerationQueue/{queueId} { ... }
// match /failedPromptGenerationQueue/{queueId} { ... }
```



### Phase 10: Update Firestore Indexes

**File:** `firestore.indexes.json`Remove queue-related indexes:

```json
// DELETE these indexes:
// promptGenerationQueue composite indexes
```



## Files to Modify

### Delete:

1. `functions/src/services/promptQueue.ts` (189 lines)
2. `functions/src/services/promptGenerationStateMachine.ts` (38 lines)

### Modify:

1. `functions/src/services/promptGenerationService.ts` - Simplify processing function
2. `functions/src/index.ts` - Simplify trigger and retry endpoint
3. `shared/types.ts` - Simplify Slide interface
4. `src/components/SlideCard.tsx` - Simplify state checks
5. `firestore.rules` - Simplify validation, remove queue rules
6. `firestore.indexes.json` - Remove queue indexes

## Complexity Reduction Summary

### Before:

- **3 files**: promptQueue.ts (189 lines), promptGenerationStateMachine.ts (38 lines), promptGenerationService.ts (232 lines)
- **2 Firestore collections**: promptGenerationQueue, failedPromptGenerationQueue
- **7+ state fields** on Slide
- **Complex flow**: Trigger → Queue → Processor → Recursive Retry
- **~450 lines of queue/state machine code**

### After:

- **1 file**: promptGenerationService.ts (~150 lines simplified)
- **0 Firestore collections** (queue removed)
- **3 state fields** on Slide (state, error, progress)
- **Simple flow**: Trigger → Direct Processing
- **~150 lines of code** (67% reduction)

## Benefits

1. **67% code reduction** (~300 lines removed)
2. **Simpler architecture** matching slide generation
3. **Easier maintenance** - less code, fewer moving parts
4. **Same functionality** - retries, rate limiting, partial progress all preserved
5. **Better performance** - no queue overhead, direct processing
6. **Fewer Firestore operations** - no queue reads/writes

## Risk Assessment

**Low Risk:**

- Rate limiter already provides coordination (5 concurrent per process)
- Built-in retry logic already handles failures
- UI already handles simplified states

**Mitigation:**

- Rate limiter prevents API floods (max 5 concurrent per instance)
- `retryPromptGeneration` has exponential backoff built-in
- Simple error handling with user retry option

## Testing Plan

1. **Direct Processing Test**: Create slide deck, verify prompts generate immediately