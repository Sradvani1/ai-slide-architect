import { ai } from '../utils/geminiClient';
import { MODEL_SPEC_REGENERATION } from '@shared/constants';
import { retryWithBackoff, extractFirstJsonArray } from '@shared/utils/retryLogic';
import { GeminiError } from '@shared/errors';
import { ImageSpec } from '@shared/types';
import { normalizeImageSpec } from '@shared/utils/imageUtils';

export async function regenerateImageSpec(
    currentSpec: ImageSpec,
    changeRequest: string,
    slideContext: { title: string; content: string[] },
    diffOnly: boolean = false // If true, only return changed fields? For now, full spec.
): Promise<ImageSpec> {

    const prompt = `
    You are an expert Visual Director.
    Task: Update the following Image Specification based on a user's request.

    CONTEXT:
    Slide Title: "${slideContext.title}"
    Slide Content: ${slideContext.content.slice(0, 3).join('; ')}...

    CURRENT SPEC (JSON):
    ${JSON.stringify(currentSpec, null, 2)}

    USER REQUEST:
    "${changeRequest}"

    INSTRUCTIONS:
    1. Modify the JSON to satisfy the user request.
    2. Maintain strict alignment with the slide concept.
    3. Ensure the JSON schema is valid (same fields as input).
    4. Return ONLY the JSON object.
    `;

    const generateFn = async () => {
        const result = await ai.models.generateContent({
            model: MODEL_SPEC_REGENERATION,
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

        // Normalize
        // Passed gradeLevel could be improved, but for now fixed "3rd Grade" or derived from context if passed
        const { spec } = normalizeImageSpec(newSpec, "3rd Grade");

        return spec;
    };

    return retryWithBackoff(generateFn);
}
