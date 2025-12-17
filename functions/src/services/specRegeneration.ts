import { getAiClient } from '../utils/geminiClient';
import { buildSpecRegenerationPrompt } from '@shared/promptBuilders';
import { normalizeImageSpec } from '@shared/utils/imageUtils';
import { retryWithBackoff, extractFirstJsonArray } from '@shared/utils/retryLogic';
import { MODEL_SLIDE_GENERATION } from '@shared/constants';
import { ImageSpec } from '@shared/types';
import { GeminiError } from '@shared/errors';

export async function regenerateImageSpec(
    currentSpec: ImageSpec,
    changeRequest: string,
    slideContext: { title: string; content: string[] }
): Promise<{ spec: ImageSpec, inputTokens: number, outputTokens: number }> {
    const prompt = buildSpecRegenerationPrompt(currentSpec, changeRequest, slideContext);

    const generateFn = async () => {
        const model = MODEL_SLIDE_GENERATION;
        const result = await getAiClient().models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                temperature: 0.7
            }
        });

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new GeminiError("Empty response from AI", 'API_ERROR', true);
        }

        let newSpec: ImageSpec;
        try {
            // Note: extractFirstJsonArray is for arrays, we need object extractor.
            // Or just JSON.parse(text) provided responseMimeType works well.
            newSpec = JSON.parse(text);
        } catch {
            // Try array extractor just in case it wrapped it.
            try {
                const arr = extractFirstJsonArray(text);
                newSpec = arr[0];
            } catch {
                throw new GeminiError("Failed to parse JSON", 'INVALID_REQUEST', false);
            }
        }

        const inputTokens = result.usageMetadata?.promptTokenCount || 0;
        const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

        // Normalize
        // Passed gradeLevel could be improved, but for now fixed "3rd Grade" or derived from context if passed
        const { spec } = normalizeImageSpec(newSpec, "3rd Grade");

        return { spec, inputTokens, outputTokens };
    };

    return retryWithBackoff(generateFn);
}
