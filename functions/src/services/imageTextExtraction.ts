import { ai } from '../utils/geminiClient';
import { retryWithBackoff } from '@shared/utils/retryLogic';
import { GeminiError } from '@shared/errors';

export async function extractTextFromImage(
    imageBase64: string,
    mimeType: string = 'image/png'
): Promise<string> {
    const generateFn = async () => {
        const model = "gemini-2.0-flash-exp"; // Fast model for vision? Or constant
        // TODO: Move model constant to shared if needed

        try {
            const prompt = "Extract all text from this image systematically. Format it as a clean list or structured text.";

            const result = await ai.models.generateContent({
                model: model,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: imageBase64
                            }
                        }
                    ]
                }]
            });

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new GeminiError("No text extracted", 'INVALID_REQUEST', false);
            }
            return text;

        } catch (error: any) {
            console.error("Text extraction failed:", error);
            throw new GeminiError("Failed to extract text from image", 'API_ERROR', false, error);
        }
    };

    return retryWithBackoff(generateFn);
}
