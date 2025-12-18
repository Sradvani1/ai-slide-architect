import { getAiClient } from '../utils/geminiClient';
import { buildSlideGenerationPrompt } from '@shared/promptBuilders';
import { formatImageSpec } from '@shared/utils/imageUtils';
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
    bulletsPerSlide?: number,
    uploadedFileNames?: string[]
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
        };

        // SDK specific tool definition
        if (useWebSearch) {
            config.tools = [{ googleSearch: {} }];
        } else {
            // Only enforce JSON mode if NO tools are used, as they are mutually exclusive in some models
            config.responseMimeType = "application/json";
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
        const normalizedSlides: Slide[] = slides.map((s, i) => {
            // Generate the rendered image prompt if spec exists
            let renderedPrompt = undefined;
            if (s.imageSpec) {
                try {
                    renderedPrompt = formatImageSpec(s.imageSpec, { gradeLevel, subject });
                } catch (e) {
                    console.warn(`Failed to format image spec for slide ${i}:`, e);
                }
            }

            return {
                ...s,
                id: `slide-${Date.now()}-${i}`,
                sortOrder: i,
                // Ensure compatibility
                content: Array.isArray(s.content) ? s.content : [String(s.content)],
                speakerNotes: cleanSpeakerNotes(s.speakerNotes || ''),
                sources: getUniqueSources(sources, uploadedFileNames, sourceMaterial, s.sources),
                renderedImagePrompt: renderedPrompt
            };
        });

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

/**
 * Clean speaker notes by removing "Sources:" or "References:" sections
 */
function cleanSpeakerNotes(notes: string): string {
    if (!notes) return "";
    // Remove "Sources:" or "References:" section at the end of the text
    // Matches "Sources:" optionally followed by anything until end of string
    return notes.replace(/(?:Sources|References|Citations):\s*[\s\S]*$/i, '').trim();
}

/**
 * Validate URL (http/https only)
 */
function isValidUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

/**
 * Extract file names from source material string
 */
function extractFileNamesFromSourceMaterial(sourceMaterial: string): string[] {
    if (!sourceMaterial) return [];

    // Pattern matches "File: filename" at start of line
    const filePattern = /(?:^|\n)File:\s*(.+?)(?:\n|$)/gm;
    const matches = sourceMaterial.matchAll(filePattern);
    const fileNames: string[] = [];

    for (const match of matches) {
        if (match[1]) {
            fileNames.push(match[1].trim());
        }
    }

    return fileNames;
}

/**
 * Combine and deduplicate sources
 */
function getUniqueSources(
    groundingSources: Array<{ uri: string; title?: string }>,
    uploadedFileNames?: string[],
    sourceMaterial?: string,
    aiProvidedSources?: string[]
): string[] | undefined {
    const allSources = new Set<string>();

    // 1. Add valid grounding sources (Web)
    groundingSources.forEach(s => {
        if (s.uri && isValidUrl(s.uri)) {
            allSources.add(s.uri);
        }
    });

    // 2. Add file sources
    // Use uploadedFileNames if available, otherwise fallback to extraction
    const fileNames = uploadedFileNames || extractFileNamesFromSourceMaterial(sourceMaterial || "");
    fileNames.forEach(f => {
        if (f && f.trim()) {
            allSources.add(`File: ${f.trim()}`);
        }
    });

    // 3. Add AI provided sources (if any, preserving them but deduping)
    if (aiProvidedSources && Array.isArray(aiProvidedSources)) {
        aiProvidedSources.forEach(s => {
            if (s && typeof s === 'string' && s.trim()) {
                // If it's a URL, validate it
                if (s.startsWith('http')) {
                    if (isValidUrl(s)) allSources.add(s);
                } else {
                    // Assume it's a file ref or other text
                    allSources.add(s);
                }
            }
        });
    }

    const uniqueSources = Array.from(allSources);
    return uniqueSources.length > 0 ? uniqueSources : undefined;
}
