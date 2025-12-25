---
name: Make Image Prompt Generation On-Demand
overview: Refactor image prompt generation to process immediately when slides are created, removing the scheduled function and making it consistent with slide generation's on-demand architecture.
todos:
  - id: create-immediate-processor
    content: Create processQueueItemImmediately function in promptQueue.ts to process single queue items immediately
    status: pending
  - id: update-slide-created-trigger
    content: Update onSlideCreated trigger to call processQueueItemImmediately after enqueueing
    status: pending
    dependencies:
      - create-immediate-processor
  - id: update-manual-retry-endpoint
    content: Update /retry-prompt-generation endpoint to trigger immediate processing
    status: pending
    dependencies:
      - create-immediate-processor
  - id: update-automatic-retry-logic
    content: Update automatic retry logic in promptGenerationService.ts to trigger immediate processing when re-enqueueing
    status: pending
    dependencies:
      - create-immediate-processor
  - id: remove-scheduled-function
    content: Remove processPromptGenerationQueue scheduled function from index.ts
    status: pending
    dependencies:
      - update-slide-created-trigger
      - update-manual-retry-endpoint
      - update-automatic-retry-logic
  - id: update-imports
    content: Update imports to remove processQueueBatch and add processQueueItemImmediately
    status: pending
    dependencies:
      - create-immediate-processor
  - id: test-immediate-processing
    content: Test that prompts start generating immediately when slides are created
    status: pending
    dependencies:
      - remove-scheduled-function
  - id: test-retry-processing
    content: Test that manual retries process immediately
    status: pending
    dependencies:
      - remove-scheduled-function
---

# Make Image Prompt Generation On-Demand

## Problem Analysis

### Current Architecture (Inconsistent)

**Slide Generation (On-Demand):**

```javascript
User Clicks "Generate" 
  → HTTP POST /generate-slides 
  → Function executes immediately 
  → Slides created in Firestore
```

**Image Prompt Generation (Scheduled):**

```javascript
Slide Created in Firestore 
  → onSlideCreated trigger fires 
  → Slide added to queue 
  → [WAIT up to 1 minute]
  → Scheduled function runs 
  → Queue processed
```



### Issues with Current Design

1. **Architectural Inconsistency**: Slide generation is immediate, but prompt generation has unnecessary delay
2. **Inefficiency**: Scheduled function runs every minute even when no work exists (wasted executions)
3. **User Experience**: Up to 60-second delay before prompt generation starts
4. **Complexity**: Extra scheduled function adds operational overhead and complexity
5. **Resource Waste**: Function executions for empty queue checks

### Why the Queue is Still Useful

The queue system provides value for:

- **Coordination**: Prevents API floods with rate limiting
- **Retry Management**: Failed items can be re-queued with priority
- **State Persistence**: Survives function crashes/restarts
- **Batch Processing**: Can process multiple items efficiently

The problem is the **processing trigger**, not the queue itself.

## Solution Architecture

### New Flow (On-Demand)

```javascript
Slide Created in Firestore 
  → onSlideCreated trigger fires 
  → Slide added to queue 
  → Immediately start processing queue items
  → Rate limiter controls API concurrency
  → Prompts generated in background
```



### Key Changes

1. **Remove scheduled function**: Delete `processPromptGenerationQueue`
2. **Add immediate processor**: Process queue items immediately when enqueued
3. **Keep queue system**: Maintain queue for coordination and retries
4. **Handle retries**: Failed items re-enqueued should also trigger immediate processing
5. **Concurrency control**: Rate limiter already handles this (max 5 concurrent API calls)

## Implementation Plan

### Phase 1: Create Immediate Queue Processor

**File:** `functions/src/services/promptQueue.ts`Add a new function `processQueueItemImmediately` that processes a single queue item:

```typescript
/**
    * Process a single queue item immediately (non-blocking).
    * Returns a promise that resolves when processing starts (not when it completes).
 */
export async function processQueueItemImmediately(
    queueItemId: string,
    processFn: (item: QueueItem) => Promise<void>
): Promise<void> {
    const db = admin.firestore();
    const queueRef = db.collection(QUEUE_COLLECTION).doc(queueItemId);
    
    // Atomically claim the item
    const updateResult = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(queueRef);
        if (!doc.exists) return null;
        
        const data = doc.data();
        if (data?.status !== 'queued') {
            return null; // Already being processed
        }
        
        transaction.update(queueRef, {
            status: 'processing',
            processedAt: FieldValue.serverTimestamp()
        });
        
        return {
            slideRef: db.doc(data.slidePath),
            projectRef: db.doc(data.projectPath),
            slideId: data.slideId,
            projectId: data.projectId,
            userId: data.userId,
            attempts: data.attempts || 0
        };
    });
    
    if (!updateResult) {
        // Already being processed by another worker
        return;
    }
    
    // Process in background (don't await - fire and forget)
    processFn({
        slideId: updateResult.slideId,
        projectId: updateResult.projectId,
        userId: updateResult.userId,
        slideRef: updateResult.slideRef,
        projectRef: updateResult.projectRef,
        priority: 0,
        queuedAt: admin.firestore.Timestamp.now(),
        attempts: updateResult.attempts
    }).then(async () => {
        // Success - remove from queue
        await queueRef.delete();
    }).catch(async (error) => {
        console.error(`Error processing queue item ${queueItemId}:`, error);
        
        // Handle failure - re-queue or mark as failed
        const doc = await queueRef.get();
        const data = doc.data();
        if (!doc.exists || !data) return;
        
        const attempts = (data.attempts || 0) + 1;
        if (attempts < 5) {
            await queueRef.update({
                status: 'queued',
                attempts,
                priority: attempts,
                processedAt: null,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } else {
            await moveToFailedQueue(queueRef, {
                ...data,
                status: 'failed',
                attempts,
                error: error instanceof Error ? error.message : 'Unknown error',
                failedAt: FieldValue.serverTimestamp()
            });
        }
    });
}
```



### Phase 2: Update onSlideCreated Trigger

**File:** `functions/src/index.ts`Modify the `onSlideCreated` trigger to process immediately after enqueueing:

```typescript
import { processQueueItemImmediately, enqueueSlide } from './services/promptQueue';
import { generateImagePromptsForSlide } from './services/promptGenerationService';

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

        try {
            // Use transaction to prevent race conditions
            await db.runTransaction(async (transaction) => {
                const currentDoc = await transaction.get(slideRef);
                const currentData = currentDoc.data();

                const existingPrompts = currentData?.imagePrompts || [];
                if (existingPrompts.length >= 3) {
                    return;
                }

                const currentState = currentData?.promptGenerationState;
                if (currentState && currentState !== 'pending' && currentState !== 'failed') {
                    throw new Error('ALREADY_PROCESSING');
                }

                transaction.update(slideRef, {
                    promptGenerationState: 'pending',
                    promptGenerationError: admin.firestore.FieldValue.delete(),
                    'promptGenerationProgress.succeeded': existingPrompts.length,
                    'promptGenerationProgress.failed': 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            // Enqueue the slide
            await enqueueSlide(slideRef, projectRef, userId, projectId);

            // Update state to queued
            await slideRef.update({
                promptGenerationState: 'queued',
                promptGenerationQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // NEW: Process immediately (non-blocking)
            await processQueueItemImmediately(slideRef.id, async (item) => {
                await generateImagePromptsForSlide(item);
            });

            console.log(`[TRIGGER] Slide ${slideRef.id} enqueued and processing started.`);

        } catch (error: any) {
            if (error.message === 'ALREADY_PROCESSING') {
                return;
            }
            console.error(`[TRIGGER] Error enqueueing slide ${slideRef.id}:`, error);
            await slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: 'Failed to enqueue for processing',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
);
```



### Phase 3: Update Manual Retry Endpoint

**File:** `functions/src/index.ts`Update the retry endpoint to trigger immediate processing:

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

            await slideRef.update({
                promptGenerationState: 'pending',
                promptGenerationError: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await enqueueSlide(slideRef, projectRef, userId, projectId);

            await slideRef.update({
                promptGenerationState: 'queued',
                promptGenerationQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // NEW: Process immediately
            await processQueueItemImmediately(slideId, async (item) => {
                await generateImagePromptsForSlide(item);
            });

            res.json({ success: true, message: `Slide ${slideId} enqueued for retry.` });
        } else {
            // Retry all failed slides in project
            const failedSlidesSnapshot = await projectRef.collection('slides')
                .where('promptGenerationState', '==', 'failed')
                .get();

            if (failedSlidesSnapshot.empty) {
                res.json({ success: true, message: "No failed slides found to retry." });
                return;
            }

            const batch = db.batch();
            for (const slideDoc of failedSlidesSnapshot.docs) {
                batch.update(slideDoc.ref, {
                    promptGenerationState: 'pending',
                    promptGenerationError: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                enqueueSlideInBatch(batch, slideDoc.ref, projectRef, userId, projectId);
            }
            await batch.commit();

            // NEW: Process each slide immediately
            for (const slideDoc of failedSlidesSnapshot.docs) {
                await processQueueItemImmediately(slideDoc.id, async (item) => {
                    await generateImagePromptsForSlide(item);
                });
            }

            res.json({ success: true, message: `Enqueued ${failedSlidesSnapshot.size} slides for retry.` });
        }
    } catch (error: any) {
        console.error("Retry Prompt Generation Error:", error);
        res.status(500).json({ error: "Failed to retry prompt generation" });
    }
});
```



### Phase 4: Update Automatic Retry Logic

**File:** `functions/src/services/promptGenerationService.ts`When re-enqueuing for retry (line 155), also trigger immediate processing:

```typescript
// Around line 154-155, when re-enqueueing for retry:
import { processQueueItemImmediately } from './promptQueue';

// Re-enqueue for retry - Preserve attempt count to prevent infinite loops
await enqueueSlide(slideRef, projectRef, item.userId, projectId, newAttempts);

// NEW: Trigger immediate processing
await processQueueItemImmediately(slideRef.id, async (queueItem) => {
    await generateImagePromptsForSlide(queueItem);
});
```

Also update the partial success re-queue (around line 111):

```typescript
// Re-enqueue for remaining prompts - Reset attempts because we made progress
await enqueueSlide(slideRef, projectRef, item.userId, projectId, 0);

// NEW: Trigger immediate processing
await processQueueItemImmediately(slideRef.id, async (queueItem) => {
    await generateImagePromptsForSlide(queueItem);
});
```



### Phase 5: Remove Scheduled Function

**File:** `functions/src/index.ts`Remove the entire `processPromptGenerationQueue` scheduled function (lines ~398-442):

```typescript
// DELETE THIS ENTIRE FUNCTION:
export const processPromptGenerationQueue = onSchedule(...)
```

**File:** `functions/src/index.ts`Remove the import for `processQueueBatch` if it's no longer used:

```typescript
// Remove from imports if only used by scheduled function:
import { processQueueBatch, enqueueSlide, cleanupFailedQueue, enqueueSlideInBatch } from './services/promptQueue';
// Change to:
import { enqueueSlide, cleanupFailedQueue, enqueueSlideInBatch, processQueueItemImmediately } from './services/promptQueue';
```



### Phase 6: Clean Up Unused Code (Optional)

**File:** `functions/src/services/promptQueue.ts`The `processQueueBatch` function (lines 82-200) is now only used for cleanup/stale items. Consider:

- Keeping it for future batch processing needs
- Or simplifying stale cleanup to not use batch processing

For now, we'll keep it as-is since stale cleanup might still be useful.

### Phase 7: Update Exports

**File:** `functions/src/services/promptQueue.ts`Export the new function:

```typescript
export { processQueueItemImmediately };
```



## Testing Plan

1. **Test Immediate Processing**: Create a new slide deck, verify prompts start generating immediately (no 1-minute delay)
2. **Test Retry Processing**: Manually retry a failed slide, verify it processes immediately
3. **Test Concurrency**: Create 10 slides, verify rate limiter prevents API floods (max 5 concurrent)
4. **Test Failure Handling**: Simulate API failure, verify re-queue triggers immediate retry
5. **Verify No Scheduled Function**: Confirm scheduled function is removed and not running

## Benefits of This Change

1. **Consistency**: Both slide generation and prompt generation are now on-demand
2. **Performance**: No artificial 60-second delay
3. **Efficiency**: No wasted function executions when queue is empty
4. **Simplicity**: Removes scheduled function complexity
5. **User Experience**: Prompts start generating immediately after slides are created

## Migration Notes

- **No data migration needed**: Queue structure remains the same
- **Backward compatible**: Existing queue items will be processed by immediate processor
- **Stale items**: May need one-time cleanup of items stuck in queue if any exist