import { getAiClient } from '../utils/geminiClient';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';
import { retryWithBackoff } from '@shared/utils/retryLogic';
import { GeminiError } from '@shared/errors';
import { getErrorMessage } from '@shared/utils/errorMessage';
import { recordUsage } from './usageEventsService';

export async function extractTextFromImage(
    imageBase64: string,
    mimeType: string,
    trackingContext: { userId: string; projectId: string }
): Promise<{ text: string, inputTokens: number, outputTokens: number }> {

    const generateFn = async () => {
        const model = MODEL_SLIDE_GENERATION;

        try {
            const result = await getAiClient().models.generateContent({
                model: model,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: "Extract all text from this image." },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: imageBase64
                                }
                            }
                        ]
                    }
                ]
            });

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new GeminiError("No text extracted", 'INVALID_REQUEST', false);
            }
            const inputTokens = result.usageMetadata?.promptTokenCount || 0;
            const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

            await recordUsage({
                userId: trackingContext.userId,
                projectId: trackingContext.projectId,
                operationKey: 'text-extraction',
                inputTokens,
                outputTokens
            });

            return {
                text: text,
                inputTokens,
                outputTokens
            };

        } catch (error: unknown) {
            console.error("Text extraction failed:", getErrorMessage(error));
            throw new GeminiError("Failed to extract text from image", 'API_ERROR', false, error);
        }
    };

    return retryWithBackoff(generateFn);
}
