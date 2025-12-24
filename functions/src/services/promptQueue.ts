import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const QUEUE_COLLECTION = 'promptGenerationQueue';
const FAILED_QUEUE_COLLECTION = 'failedPromptGenerationQueue';
const BATCH_SIZE = 10; // Process 10 slides at a time

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
 * Process next batch of items from queue.
 * 
 * NOTE: Requires Firestore Composite Index:
 * Collection: promptGenerationQueue
 * Fields: status (Asc), priority (Asc), queuedAt (Asc)
 */
export async function processQueueBatch(
    processFn: (item: QueueItem) => Promise<void>
): Promise<number> {
    const db = admin.firestore();
    const queueRef = db.collection(QUEUE_COLLECTION);

    // 1. Cleanup stale "processing" items (older than 5 mins)
    const staleThreshold = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 5 * 60 * 1000)
    );
    const staleSnapshot = await queueRef
        .where('status', '==', 'processing')
        .where('processedAt', '<', staleThreshold)
        .limit(BATCH_SIZE)
        .get();

    if (!staleSnapshot.empty) {
        console.log(`[QUEUE] Resetting ${staleSnapshot.size} stale processing items.`);
        const cleanupBatch = db.batch();
        staleSnapshot.docs.forEach(doc => {
            cleanupBatch.update(doc.ref, {
                status: 'queued',
                processedAt: null,
                error: 'Processing timeout - reset to queued'
            });
        });
        await cleanupBatch.commit();
    }

    // 2. Get next batch of queued items, ordered by priority then queuedAt
    const snapshot = await queueRef
        .where('status', '==', 'queued')
        .orderBy('priority')
        .orderBy('queuedAt')
        .limit(BATCH_SIZE)
        .get();

    if (snapshot.empty) {
        return 0;
    }

    let processedCount = 0;

    // Process items in parallel (but rate limiter in retryLogic controls actual API concurrency)
    await Promise.allSettled(snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Mark as processing atomically to avoid multiple workers picking up the same item
        const updateResult = await db.runTransaction(async (transaction) => {
            const currentDoc = await transaction.get(doc.ref);
            const currentData = currentDoc.data();

            if (currentData?.status !== 'queued') {
                return null; // Already being processed
            }

            transaction.update(doc.ref, {
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
            return; // Another worker picked it up
        }

        try {
            await processFn({
                slideId: updateResult.slideId,
                projectId: updateResult.projectId,
                userId: updateResult.userId,
                slideRef: updateResult.slideRef,
                projectRef: updateResult.projectRef,
                priority: 0,
                queuedAt: admin.firestore.Timestamp.now(),
                attempts: updateResult.attempts
            });

            // Mark as complete by removing from queue
            await doc.ref.delete();

            processedCount++;
        } catch (error) {
            console.error(`Error processing queue item ${doc.id}:`, error);

            // Increment attempts and re-queue or mark as failed
            const attempts = (data.attempts || 0) + 1;
            if (attempts < 5) {
                await doc.ref.update({
                    status: 'queued',
                    attempts,
                    priority: attempts, // Higher attempts = lower priority (processed later)
                    processedAt: null,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            } else {
                // Move to failed queue for long-term tracking and cleanup
                await moveToFailedQueue(doc.ref, {
                    ...data,
                    status: 'failed',
                    attempts,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    failedAt: FieldValue.serverTimestamp()
                });
            }
        }
    }));

    return processedCount;
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

/**
 * Moves an item to the failed queue collection and removes it from the active queue.
 */
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
