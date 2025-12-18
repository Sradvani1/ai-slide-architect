import { getAiClient } from '../utils/geminiClient';
import { MODEL_IMAGE_GENERATION, STYLE_GUIDELINES } from '@shared/constants';
import { retryWithBackoff } from '@shared/utils/retryLogic';
import { ImageGenError } from '@shared/errors';

export async function generateImage(
    imagePrompt: string,
    options: { aspectRatio?: '16:9' | '1:1', temperature?: number } = {}
): Promise<{ base64Data: string; mimeType: string; renderedPrompt: string }> {

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

            return {
                base64Data: inlineData.data || "",
                mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
                renderedPrompt: finalPrompt
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
