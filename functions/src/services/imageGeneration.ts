import * as crypto from 'crypto';
import { getAiClient } from '../utils/geminiClient';
import { MODEL_IMAGE_GENERATION, MODEL_SLIDE_GENERATION, STYLE_GUIDELINES } from '@shared/constants';
import { retryWithBackoff, retryPromptGeneration } from '@shared/utils/retryLogic';
import { ImageGenError } from '@shared/errors';
import { recordUsageEvent, UsageEventContext } from './usageEventsService';

async function safeRecordUsageEvent(params: Parameters<typeof recordUsageEvent>[0]): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await recordUsageEvent(params);
            return;
        } catch (error: any) {
            if (attempt >= maxAttempts) {
                console.warn(
                    `[imageGeneration] Failed to record usage event (${params.operationKey}) after ${maxAttempts} attempts:`,
                    error?.message || error
                );
                return;
            }
            const delayMs = 200 * attempt;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}
import { buildSingleSlideImagePromptSystemInstructions, buildSingleSlideImagePromptUserPrompt } from '@shared/promptBuilders';

export interface PromptGenerationResult {
    prompts: Array<{ id: string; text: string; inputTokens: number; outputTokens: number }>;
    failed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
}

export async function generateImage(
    imagePrompt: string,
    trackingContext: UsageEventContext,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string; inputTokens: number; outputTokens: number }> {

    const finalPrompt = `IMAGE CONTENT:
${imagePrompt}

${STYLE_GUIDELINES}`;
    const aspectRatio = options.aspectRatio || '16:9';
    const temperature = options.temperature || 0.7;

    const generateFn = async () => {
        try {
            const model = MODEL_IMAGE_GENERATION;

            const config: any = {
                responseModalities: ['TEXT', 'IMAGE'],
                temperature: temperature,
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: '1K'
                }
            };

            const response = await getAiClient().models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
                config: config
            });

            // Extract image from response parts
            const parts = response.candidates?.[0]?.content?.parts;
            const imagePart = parts?.find((p: any) => p.inlineData || p.inline_data);

            if (!imagePart) {
                throw new ImageGenError("No image data returned", 'NO_IMAGE_DATA', true);
            }

            const inlineData = imagePart.inlineData || (imagePart as any).inline_data;
            if (!inlineData || !inlineData.data) {
                throw new ImageGenError("No image data returned", 'NO_IMAGE_DATA', true);
            }

            // Extract token counts from usage_metadata
            const inputTokens = response.usageMetadata?.promptTokenCount || 0;
            const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;

            await safeRecordUsageEvent({
                ...trackingContext,
                operationKey: 'image-generation',
                inputTokens,
                outputTokens
            });

            return {
                base64Data: inlineData.data || "",
                mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
                renderedPrompt: finalPrompt,
                inputTokens,
                outputTokens
            };

        } catch (error: any) {
            // Handle safety blocks
            if (error.message?.includes('safety') || error.response?.promptFeedback?.blockReason) {
                throw new ImageGenError("Image generation blocked by safety filters", 'UNKNOWN', false);
            }
            throw error;
        }
    };

    return retryWithBackoff(generateFn, 2);
}

/**
 * Generates a single image prompt for a slide
 */
export async function generateImagePrompts(
    topic: string,
    subject: string,
    gradeLevel: string,
    slideTitle: string,
    slideContent: string[],
    trackingContext: UsageEventContext
): Promise<PromptGenerationResult> {
    const systemInstructions = buildSingleSlideImagePromptSystemInstructions();
    const userPrompt = buildSingleSlideImagePromptUserPrompt(topic, subject, gradeLevel, slideTitle, slideContent);

    const generateFn = async () => {
        try {
            const result = await getAiClient().models.generateContent({
                model: MODEL_SLIDE_GENERATION,
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: { parts: [{ text: systemInstructions }] },
                    temperature: 0.7, // Fixed temperature for single prompt
                }
            });

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Empty response from AI model");
            }

            // Clean up the response
            let cleanedPrompt = text
                .replace(/```[a-z]*\n?/gi, '') // Remove code fences
                .replace(/```/g, '')
                .trim();

            // Handle cases where AI might add "imagePrompt:" or similar prefixes
            cleanedPrompt = cleanedPrompt.replace(/^(imagePrompt|Image Prompt|Prompt):\s*/i, '').trim();

            const inputTokens = result.usageMetadata?.promptTokenCount || 0;
            const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

            await safeRecordUsageEvent({
                ...trackingContext,
                operationKey: 'image-prompt',
                inputTokens,
                outputTokens
            });

            return {
                id: crypto.randomUUID(),
                text: cleanedPrompt,
                inputTokens,
                outputTokens
            };
        } catch (error: any) {
            console.error(`Error in generateImagePrompts:`, error);
            throw error;
        }
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
        console.error(`Prompt generation failed:`, error);
        return {
            prompts: [],
            failed: 1,
            totalInputTokens: 0,
            totalOutputTokens: 0
        };
    }
}
