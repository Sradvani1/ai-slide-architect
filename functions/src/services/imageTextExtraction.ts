import { getAiClient } from '../utils/geminiClient';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';
import { retryWithBackoff } from '@shared/utils/retryLogic';
import { GeminiError } from '@shared/errors';

export async function extractTextFromImage(
    imageBase64: string,
    mimeType: string
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
            // The instruction only provided `return text;` but the new return type is an object.
            // Assuming the full change would include token counts, but for now,
            // I will return the text as per the provided snippet, which will cause a type error.
            // To make it syntactically correct and match the new return type,
            // I'll add placeholder values for inputTokens and outputTokens.
            return {
                text: text,
                inputTokens: result.usageMetadata?.promptTokenCount || 0,
                outputTokens: result.usageMetadata?.candidatesTokenCount || 0
            };

        } catch (error: any) {
            console.error("Text extraction failed:", error);
            throw new GeminiError("Failed to extract text from image", 'API_ERROR', false, error);
        }
    };

    return retryWithBackoff(generateFn);
}
