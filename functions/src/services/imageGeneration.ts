import * as crypto from 'crypto';
import { getAiClient } from '../utils/geminiClient';
import { MODEL_IMAGE_GENERATION, MODEL_SLIDE_GENERATION, STYLE_GUIDELINES } from '@shared/constants';
import { retryWithBackoff, retryPromptGeneration } from '@shared/utils/retryLogic';
import { ImageGenError } from '@shared/errors';
import { getErrorMessage } from '@shared/utils/errorMessage';
import { recordUsage } from './usageEventsService';
import {
    buildSingleSlideImagePromptSystemInstructions,
    buildSingleSlideImagePromptUserPrompt,
    buildImageSearchTermsSystemInstructions,
    buildImageSearchTermsUserPrompt
} from '@shared/promptBuilders';

export interface PromptGenerationResult {
    prompts: Array<{ id: string; text: string; inputTokens: number; outputTokens: number }>;
    failed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
}

export interface SearchTermGenerationResult {
    terms: string[];
    inputTokens: number;
    outputTokens: number;
}

export async function generateImage(
    imagePrompt: string,
    trackingContext: { userId: string; projectId: string },
    options: { aspectRatio?: '16:9' | '1:1' } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string; inputTokens: number; outputTokens: number }> {

    const finalPrompt = `IMAGE CONTENT:
${imagePrompt}

${STYLE_GUIDELINES}`;
    const aspectRatio = options.aspectRatio || '16:9';

    const generateFn = async () => {
        try {
            const model = MODEL_IMAGE_GENERATION;

            const config: any = {
                responseModalities: ['TEXT', 'IMAGE'],
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

            await recordUsage({
                userId: trackingContext.userId,
                projectId: trackingContext.projectId,
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

        } catch (error: unknown) {
            // Handle safety blocks (Gemini SDK may throw with response.promptFeedback)
            const msg = getErrorMessage(error);
            const blockReason = typeof error === 'object' && error !== null && 'response' in error
                ? (error as { response?: { promptFeedback?: { blockReason?: string } } }).response?.promptFeedback?.blockReason
                : undefined;
            if (msg.includes('safety') || blockReason) {
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
    trackingContext: { userId: string; projectId: string }
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

            await recordUsage({
                userId: trackingContext.userId,
                projectId: trackingContext.projectId,
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
        } catch (error: unknown) {
            console.error(`Error in generateImagePrompts:`, getErrorMessage(error));
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
    } catch (error: unknown) {
        console.error(`Prompt generation failed:`, getErrorMessage(error));
        return {
            prompts: [],
            failed: 1,
            totalInputTokens: 0,
            totalOutputTokens: 0
        };
    }
}

export async function generateImageSearchTerms(
    topic: string,
    subject: string,
    gradeLevel: string,
    slideTitle: string,
    slideContent: string[],
    trackingContext: { userId: string; projectId: string }
): Promise<SearchTermGenerationResult> {
    const systemInstructions = buildImageSearchTermsSystemInstructions();
    const userPrompt = buildImageSearchTermsUserPrompt(topic, subject, gradeLevel, slideTitle, slideContent);

    const generateFn = async () => {
        const result = await getAiClient().models.generateContent({
            model: MODEL_SLIDE_GENERATION,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: { parts: [{ text: systemInstructions }] }
            }
        });

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error("Empty response from AI model");
        }

        let terms: string[] = [];
        try {
            const parsed = JSON.parse(text.trim());
            if (Array.isArray(parsed)) {
                terms = parsed.filter(item => typeof item === 'string');
            }
        } catch {
            terms = text
                .replace(/```[a-z]*\n?/gi, '')
                .replace(/```/g, '')
                .split(/\r?\n/)
                .map(line => line.replace(/^[\-\*\d\.\)\s]+/, '').trim())
                .filter(Boolean);
        }

        const normalized = terms
            .map(term => term.replace(/["']/g, '').trim())
            .filter(Boolean);

        const uniqueTerms = Array.from(new Set(normalized)).slice(0, 6);

        const inputTokens = result.usageMetadata?.promptTokenCount || 0;
        const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

        await recordUsage({
            userId: trackingContext.userId,
            projectId: trackingContext.projectId,
            operationKey: 'image-search-terms',
            inputTokens,
            outputTokens
        });

        return {
            terms: uniqueTerms,
            inputTokens,
            outputTokens
        };
    };

    return retryPromptGeneration(generateFn);
}
