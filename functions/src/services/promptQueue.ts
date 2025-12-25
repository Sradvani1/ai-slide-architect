import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const QUEUE_COLLECTION = 'promptGenerationQueue';
const FAILED_QUEUE_COLLECTION = 'failedPromptGenerationQueue';

export interface QueueItem {
    slideId: string;
    projectId: string;
    userId: string;
    slideRef: admin.firestore.DocumentReference;
    projectRef: admin.firestore.DocumentReference;
    priority: number; // Lower = higher priority (0 = highest)
    queuedAt: admin.firestore.Timestamp;
    attempts: number;
}

/**
 * Add slide to processing queue.
 * Idempotent: Can be called multiple times for the same slide.
 */
export async function enqueueSlide(
    slideRef: admin.firestore.DocumentReference,
    projectRef: admin.firestore.DocumentReference,
    userId: string,
    projectId: string,
    attempts: number = 0
): Promise<void> {
    const db = admin.firestore();
    const queueRef = db.collection(QUEUE_COLLECTION).doc(slideRef.id);

    await queueRef.set({
        slideId: slideRef.id,
        projectId,
        userId,
        slidePath: slideRef.path,
        projectPath: projectRef.path,
        priority: attempts, // Higher attempts = lower priority
        queuedAt: FieldValue.serverTimestamp(),
        attempts,
        status: 'queued',
        processedAt: null
    }, { merge: true });
}

/**
 * Version of enqueueSlide that works within a transaction or batch.
 */
export function enqueueSlideInBatch(
    batch: admin.firestore.WriteBatch,
    slideRef: admin.firestore.DocumentReference,
    projectRef: admin.firestore.DocumentReference,
    userId: string,
    projectId: string,
    attempts: number = 0
): void {
    const db = admin.firestore();
    const queueRef = db.collection(QUEUE_COLLECTION).doc(slideRef.id);

    batch.set(queueRef, {
        slideId: slideRef.id,
        projectId,
        userId,
        slidePath: slideRef.path,
        projectPath: projectRef.path,
        priority: attempts,
        queuedAt: FieldValue.serverTimestamp(),
        attempts,
        status: 'queued',
        processedAt: null
    }, { merge: true });
}

/**
 * Cleanup old items from the failed queue (older than 30 days).
 */
export async function cleanupFailedQueue(): Promise<number> {
    const db = admin.firestore();
    const failedQueueRef = db.collection(FAILED_QUEUE_COLLECTION);

    const expireThreshold = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    const snapshot = await failedQueueRef
        .where('failedAt', '<', expireThreshold)
        .where('failedAt', '!=', null)
        .limit(100)
        .get();

    if (snapshot.empty) return 0;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return snapshot.size;
}

async function moveToFailedQueue(docRef: admin.firestore.DocumentReference, data: any): Promise<void> {
    const db = admin.firestore();
    const failedQueueRef = db.collection(FAILED_QUEUE_COLLECTION).doc(docRef.id);

    try {
        await db.runTransaction(async (transaction) => {
            transaction.set(failedQueueRef, data);
            transaction.delete(docRef);
        });
    } catch (error) {
        console.error(`[QUEUE] Failed to move item ${docRef.id} to failed queue:`, error);
        // Fallback: Just mark as failed in active queue
        await docRef.update({
            status: 'failed',
            error: data.error || 'Unknown error',
            failedAt: FieldValue.serverTimestamp()
        });
    }
}

/**
 * Process a single queue item immediately (non-blocking).
 * Returns a promise that resolves when processing starts (not when it completes).
 */
export async function processQueueItemImmediately(
    queueItemId: string,
    processFn: (item: QueueItem) => Promise<void>
): Promise<void> {
    try {
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
                attempts: data.attempts || 0,
                data: data // Keep full data for potential retry
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
            console.error(`[QUEUE] Error processing queue item ${queueItemId}:`, error);

            // Handle failure - re-queue or mark as failed
            const attempts = updateResult.attempts + 1;

            if (attempts < 5) {
                await queueRef.update({
                    status: 'queued',
                    attempts,
                    priority: attempts,
                    processedAt: null,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                // Trigger immediate retry with exponential backoff
                const delayMs = Math.min(1000 * Math.pow(2, attempts), 30000); // Max 30 seconds
                console.log(`[QUEUE] Retrying ${queueItemId} in ${delayMs}ms (Attempt ${attempts})`);

                setTimeout(() => {
                    processQueueItemImmediately(queueItemId, processFn).catch(err => {
                        console.error(`[QUEUE] Failed to trigger retry for ${queueItemId}:`, err);
                    });
                }, delayMs);
            } else {
                await moveToFailedQueue(queueRef, {
                    ...updateResult.data,
                    status: 'failed',
                    attempts,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    failedAt: FieldValue.serverTimestamp()
                });
            }
        });
    } catch (error) {
        console.error(`[QUEUE] Critical error in processQueueItemImmediately for ${queueItemId}:`, error);
        // Don't throw - we don't want to fail the trigger if queue processing setup fails
    }
}
