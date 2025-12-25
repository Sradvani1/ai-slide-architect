import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateImagePrompts } from './imageGeneration';
import { calculateAndIncrementProjectCost } from './pricingService';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';
import { QueueItem, enqueueSlide, processQueueItemImmediately } from './promptQueue';
import { calculateNextRetryTime } from './promptGenerationStateMachine';
import type { Slide, ImagePrompt, ProjectData } from '@shared/types';

/**
 * Main entry point for generating image prompts for a slide from the queue.
 */
export async function generateImagePromptsForSlide(item: QueueItem): Promise<void> {
    const slideRef = item.slideRef;
    const projectRef = item.projectRef;
    const slideId = item.slideId;
    const projectId = item.projectId;
    const attempts = item.attempts || 0;
    const correlationId = `${slideId}-${Date.now()}`;

    console.log(`[PROMPT_GEN:${correlationId}] Starting generation for slide ${slideId} in project ${projectId} (Attempt ${attempts + 1})`);

    // Get current slide and project data
    const [slideDoc, projectDoc] = await Promise.all([
        slideRef.get(),
        projectRef.get()
    ]);

    if (!slideDoc.exists || !projectDoc.exists) {
        console.warn(`[PROMPT_GEN:${correlationId}] Slide ${slideId} or project ${projectId} not found. Skipping.`);
        return;
    }

    const slideData = slideDoc.data() as Slide;
    const projectData = projectDoc.data() as ProjectData;

    // Check existing prompts
    const existingPrompts: ImagePrompt[] = slideData.imagePrompts || [];

    if (existingPrompts.length >= 3) {
        console.log(`[PROMPT_GEN:${correlationId}] Slide ${slideId} already has ${existingPrompts.length} prompts. Marking as completed.`);
        await slideRef.update({
            promptGenerationState: 'completed',
            updatedAt: FieldValue.serverTimestamp()
        });
        return;
    }

    // Update state to generating
    await slideRef.update({
        promptGenerationState: 'generating',
        promptGenerationAttempts: attempts + 1,
        promptGenerationLastAttempt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });

    try {
        // Generate remaining prompts
        const result = await generateImagePrompts(
            projectData.topic || '',
            projectData.subject || '',
            projectData.gradeLevel || '',
            slideData.title || '',
            slideData.content || [],
            existingPrompts
        );

        console.log(`[PROMPT_GEN:${correlationId}] Generated ${result.prompts.length} new prompts for slide ${slideId}. Failed: ${result.failed}`);

        // Save prompts incrementally using transactions with retry logic
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

        // Determine final state
        const allPromptsCount = existingPrompts.length + result.prompts.length;

        if (result.isComplete) {
            console.log(`[PROMPT_GEN:${correlationId}] Generation complete for slide ${slideId}. Tracking costs.`);
            // Track costs ONLY on full completion
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
        } else if (result.prompts.length > 0 || allPromptsCount > 0) {
            console.log(`[PROMPT_GEN:${correlationId}] Partial success for slide ${slideId} (${allPromptsCount}/3). Re-queuing.`);
            await slideRef.update({
                promptGenerationState: 'partial',
                'promptGenerationProgress.succeeded': allPromptsCount,
                'promptGenerationProgress.failed': result.failed,
                updatedAt: FieldValue.serverTimestamp()
            });

            // Re-enqueue for remaining prompts - Reset attempts because we made progress
            await enqueueSlide(slideRef, projectRef, item.userId, projectId, 0);

            await slideRef.update({
                promptGenerationState: 'queued',
                promptGenerationQueuedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            // Start processing immediately (non-blocking)
            processQueueItemImmediately(slideId, async (queueItem) => {
                await generateImagePromptsForSlide(queueItem);
            }).catch(err => {
                console.error(`[PROMPT_GEN] Error starting immediate processing for partial ${slideId}:`, err);
            });
        } else {
            // All attempts failed in this run
            const newAttempts = attempts + 1;
            console.warn(`[PROMPT_GEN:${correlationId}] All prompt generations failed for slide ${slideId} (Total attempts: ${newAttempts})`);

            const nextRetry = calculateNextRetryTime(newAttempts);

            await slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: `Failed to generate prompts after ${newAttempts} attempts`,
                promptGenerationNextRetry: admin.firestore.Timestamp.fromDate(nextRetry),
                'promptGenerationProgress.failed': result.failed || 3,
                updatedAt: FieldValue.serverTimestamp()
            });
        }

    } catch (error: any) {
        console.error(`[PROMPT_GEN:${correlationId}] Error in generateImagePromptsForSlide for ${slideId}:`, error);

        const newAttempts = attempts + 1;
        // Basic retryable check for the entire process
        const isRetryable = error?.status === 429 || error?.status === 503 ||
            error?.status === 500 || error?.message?.includes('timeout');

        if (isRetryable && newAttempts < 5) {
            const nextRetry = calculateNextRetryTime(newAttempts);
            console.log(`[PROMPT_GEN:${correlationId}] Retrying slide ${slideId} at ${nextRetry.toISOString()}`);

            await slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: error.message || 'Unknown error',
                promptGenerationNextRetry: admin.firestore.Timestamp.fromDate(nextRetry),
                promptGenerationAttempts: newAttempts,
                updatedAt: FieldValue.serverTimestamp()
            });

            // Re-enqueue for retry - Preserve attempt count to prevent infinite loops
            await enqueueSlide(slideRef, projectRef, item.userId, projectId, newAttempts);

            // Start processing immediately (non-blocking)
            processQueueItemImmediately(slideId, async (queueItem) => {
                await generateImagePromptsForSlide(queueItem);
            }).catch(err => {
                console.error(`[PROMPT_GEN] Error starting immediate processing for retry ${slideId}:`, err);
            });
        } else {
            console.error(`[PROMPT_GEN:${correlationId}] Permanent failure for slide ${slideId} after ${newAttempts} attempts.`);
            await slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: error.message || 'Unknown error',
                promptGenerationAttempts: newAttempts,
                updatedAt: FieldValue.serverTimestamp()
            });
        }
    }
}

/**
 * Saves a single prompt to the slide's imagePrompts array atomically.
 * Includes retry logic for transaction contention (Firestore error code 10: ABORTED).
 */
async function savePromptIncrementally(
    slideRef: admin.firestore.DocumentReference,
    prompt: ImagePrompt
): Promise<void> {
    let retries = 5; // Increased retries for high contention
    while (retries > 0) {
        try {
            return await slideRef.firestore.runTransaction(async (transaction) => {
                const slideDoc = await transaction.get(slideRef);
                const slideData = slideDoc.data() as Slide;

                const existingPrompts = slideData.imagePrompts || [];

                // Idempotency check: Don't add duplicate IDs
                if (existingPrompts.some((p: ImagePrompt) => p.id === prompt.id)) {
                    return;
                }

                const updatedPrompts = [...existingPrompts, prompt];

                const updateData: any = {
                    imagePrompts: updatedPrompts,
                    'promptGenerationProgress.succeeded': updatedPrompts.length,
                    'promptGenerationProgress.lastSuccessAt': FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                };

                // If this is the first prompt, set it as current
                if (updatedPrompts.length === 1) {
                    updateData.currentPromptId = prompt.id;
                }

                transaction.update(slideRef, updateData);
            });
        } catch (error: any) {
            if (error?.code === 10 && retries > 0) { // ABORTED
                retries--;
                console.warn(`[PROMPT_GEN] Transaction aborted for slide ${slideRef.id}, retrying... (${retries} left)`);
                // Exponential backoff: capped at 2000ms
                await new Promise(resolve => setTimeout(resolve, Math.min(100 * Math.pow(2, 5 - retries), 2000)));
                continue;
            }
            throw error;
        }
    }
}
