import { getAiClient } from '../utils/geminiClient';
import { buildSlideGenerationPrompt } from '@shared/promptBuilders';
import { retryWithBackoff, extractFirstJsonArray } from '@shared/utils/retryLogic';
import { validateSlideStructure } from '@shared/utils/validation';
import { DEFAULT_TEMPERATURE, DEFAULT_BULLETS_PER_SLIDE, MODEL_SLIDE_GENERATION } from '@shared/constants';
import { Slide } from '@shared/types';
import { GeminiError } from '@shared/errors';

export async function generateSlides(
    topic: string,
    gradeLevel: string,
    subject: string,
    sourceMaterial: string,
    numSlides: number,
    useWebSearch: boolean,
    additionalInstructions?: string,
    temperature?: number,
    bulletsPerSlide?: number
): Promise<{
    slides: Slide[],
    inputTokens: number,
    outputTokens: number,
    sources: Array<{ uri: string; title?: string }>,
    searchEntryPoint?: any,
    webSearchQueries?: string[],
    warnings: string[]
}> {
    const prompt = buildSlideGenerationPrompt(
        topic,
        subject,
        gradeLevel,
        numSlides + 1, // + Title slide
        numSlides,
        sourceMaterial,
        useWebSearch,
        bulletsPerSlide || DEFAULT_BULLETS_PER_SLIDE,
        additionalInstructions,
        true // includeOutputFormat
    );

    const generateFn = async () => {
        const model = MODEL_SLIDE_GENERATION;
        const config: any = {
            temperature: temperature || DEFAULT_TEMPERATURE,
            responseMimeType: "application/json",
        };

        // SDK specific tool definition
        if (useWebSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const result = await getAiClient().models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: config
        });

        // The result object from @google/genai usually has .text() helper or candidates structure
        // Let's check candidates.
        const candidates = result.candidates;
        const text = candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new GeminiError("Empty response from AI model", 'API_ERROR', true);
        }

        const inputTokens = result.usageMetadata?.promptTokenCount || 0;
        const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

        // Extract Grounding Metadata if available
        const groundingMetadata = candidates?.[0]?.groundingMetadata;
        let searchEntryPoint = undefined;
        let webSearchQueries = undefined;
        const sources: Array<{ uri: string; title?: string }> = [];

        if (groundingMetadata) {
            searchEntryPoint = groundingMetadata.searchEntryPoint?.renderedContent;
            webSearchQueries = groundingMetadata.webSearchQueries;

            if (groundingMetadata.groundingChunks) {
                groundingMetadata.groundingChunks.forEach((chunk: any) => {
                    if (chunk.web?.uri) {
                        sources.push({
                            uri: chunk.web.uri,
                            title: chunk.web.title
                        });
                    }
                });
            }
        }


        // Extract and Validate
        let slides: any[];
        try {
            slides = extractFirstJsonArray(text);
        } catch (e) {
            // Fallback or repair could go here, but for now rethrow as GeminiError
            throw new GeminiError("Failed to parse JSON from model response", 'INVALID_REQUEST', false, { responseText: text });
        }

        // Validate each slide
        const warnings: string[] = [];
        slides.forEach((slide, idx) => {
            const errors = validateSlideStructure(slide, idx);
            if (errors.length > 0) {
                // Collect errors as warnings instead of failing hard
                warnings.push(...errors);
            }
        });

        // Normalize slides (add IDs, etc)
        const normalizedSlides: Slide[] = slides.map((s, i) => ({
            ...s,
            id: `slide-${Date.now()}-${i}`,
            sortOrder: i,
            // Ensure compatibility
            content: Array.isArray(s.content) ? s.content : [String(s.content)],
        }));

        return {
            slides: normalizedSlides,
            inputTokens,
            outputTokens,
            sources,
            searchEntryPoint,
            webSearchQueries,
            warnings
        };
    };

    return retryWithBackoff(generateFn);
}
