import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateImagePrompts } from './imageGeneration';
import { calculateAndIncrementProjectCost } from './pricingService';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';
import type { Slide, ImagePrompt, ProjectData } from '@shared/types';

/**
 * Generate image prompts for a slide directly (no queue).
 */
export async function generateImagePromptsForSlide(
    slideRef: admin.firestore.DocumentReference,
    projectRef: admin.firestore.DocumentReference
): Promise<void> {
    const correlationId = `${slideRef.id}-${Date.now()}`;
    console.log(`[PROMPT_GEN:${correlationId}] Starting generation for slide ${slideRef.id}`);

    // Get current slide data
    const slideDoc = await slideRef.get();
    if (!slideDoc.exists) {
        console.warn(`[PROMPT_GEN:${correlationId}] Slide ${slideRef.id} not found. Skipping.`);
        return;
    }

    const slideData = slideDoc.data() as Slide;
    const existingPrompts: ImagePrompt[] = slideData.imagePrompts || [];

    // Already complete
    if (existingPrompts.length >= 3) {
        console.log(`[PROMPT_GEN:${correlationId}] Slide already has ${existingPrompts.length} prompts. Marking as completed.`);
        await slideRef.update({
            promptGenerationState: 'completed',
            updatedAt: FieldValue.serverTimestamp()
        });
        return;
    }

    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
        console.warn(`[PROMPT_GEN:${correlationId}] Project not found for slide ${slideRef.id}. Skipping.`);
        return;
    }

    const projectData = projectDoc.data() as ProjectData;

    try {
        // Generate prompts (uses internal retry logic for rate limiting)
        const result = await generateImagePrompts(
            projectData.topic || '',
            projectData.subject || '',
            projectData.gradeLevel || '',
            slideData.title || '',
            slideData.content || [],
            existingPrompts
        );

        console.log(`[PROMPT_GEN:${correlationId}] Generated ${result.prompts.length} new prompts. Failed: ${result.failed}`);

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
            console.log(`[PROMPT_GEN:${correlationId}] Generation complete. Tracking costs.`);
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
            console.log(`[PROMPT_GEN:${correlationId}] Partial success (${allPromptsCount}/3).`);
            await slideRef.update({
                promptGenerationState: 'failed',
                promptGenerationError: `Only ${allPromptsCount} of 3 prompts generated. Click retry to continue.`,
                'promptGenerationProgress.succeeded': allPromptsCount,
                updatedAt: FieldValue.serverTimestamp()
            });
        }
    } catch (error: any) {
        console.error(`[PROMPT_GEN:${correlationId}] Error generating prompts for slide ${slideRef.id}:`, error);
        await slideRef.update({
            promptGenerationState: 'failed',
            promptGenerationError: error.message || 'Failed to generate prompts',
            updatedAt: FieldValue.serverTimestamp()
        });
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
