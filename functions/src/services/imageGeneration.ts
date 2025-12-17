
import { ai } from '../utils/geminiClient';
import { MODEL_IMAGE_GENERATION } from '@shared/constants';
import { retryWithBackoff } from '@shared/utils/retryLogic';
import { ImageGenError } from '@shared/errors';
import { ImageSpec } from '@shared/types';
import { formatImageSpec } from '@shared/utils/imageUtils';

export async function generateImage(
    spec: ImageSpec,
    gradeLevel: string,
    subject: string,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string }> {

    const renderedPrompt = formatImageSpec(spec, { gradeLevel, subject });
    const aspectRatio = options.aspectRatio || '16:9';
    const temperature = options.temperature || 0.7;

    const generateFn = async () => {
        try {
            const model = MODEL_IMAGE_GENERATION;

            // Original approach using generateContent for image generation model
            const response = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: renderedPrompt }] }],
                config: {
                    // @ts-ignore - SDK types might not be fully updated for imageConfig if using strict types or if it's dynamic
                    // But this matches the user's "original approach" request
                    responseModalities: ['TEXT', 'IMAGE'],
                    temperature: temperature,
                    imageConfig: {
                        aspectRatio: aspectRatio,
                        // imageSize: '1024x1024' // Optional if needed
                    }
                }
            });

            // Extract image from response parts
            // candidates[0].content.parts[0] should be the image if successful?
            // Or response.candidates[0].content.parts may contain inlineData
            const parts = response.candidates?.[0]?.content?.parts;
            const imagePart = parts?.find((p: any) => p.inlineData || p.inline_data);

            if (!imagePart) {
                throw new ImageGenError("No image data returned", 'NO_IMAGE_DATA', true);
            }

            const inlineData = imagePart.inlineData || (imagePart as any).inline_data;
            if (!inlineData || !inlineData.data) {
                throw new ImageGenError("No image data returned", 'NO_IMAGE_DATA', true);
            }

            return {
                base64Data: inlineData.data || "",
                mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
                renderedPrompt
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
