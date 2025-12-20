import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { getAiClient } from '../utils/geminiClient';
import { buildSlideGenerationPrompt } from '@shared/promptBuilders';
import { retryWithBackoff, extractFirstJsonArray } from '@shared/utils/retryLogic';
import { validateSlideStructure } from '@shared/utils/validation';
import { DEFAULT_TEMPERATURE, DEFAULT_BULLETS_PER_SLIDE, MODEL_SLIDE_GENERATION } from '@shared/constants';
import { Slide } from '@shared/types';
import { GeminiError } from '@shared/errors';
import { calculateAndIncrementProjectCost } from './pricingService';

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
    sources: string[],
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

        // Create unique sources for the entire deck
        const uniqueSources = getUniqueSources(sources, uploadedFileNames, sourceMaterial);

        // Normalize slides (add IDs, etc)
        const normalizedSlides: Slide[] = slides.map((s, i) => {
            const slideId = `slide-${Date.now()}-${i}`;
            const promptId = crypto.randomUUID();

            return {
                ...s,
                id: slideId,
                sortOrder: i,
                // Ensure compatibility
                content: Array.isArray(s.content) ? s.content : [String(s.content)],
                speakerNotes: cleanSpeakerNotes(s.speakerNotes || ''),
                imagePrompts: (s.imagePrompt && s.imagePrompt.trim()) ? [{
                    id: promptId,
                    text: s.imagePrompt.trim(),
                    createdAt: Date.now(),
                    isOriginal: true
                }] : [],
                currentPromptId: (s.imagePrompt && s.imagePrompt.trim()) ? promptId : undefined
            };
        });

        return {
            slides: normalizedSlides,
            inputTokens,
            outputTokens,
            sources: uniqueSources || [],
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
    sourceMaterial?: string
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

    const uniqueSources = Array.from(allSources);
    return uniqueSources.length > 0 ? uniqueSources : undefined;
}

export async function generateSlidesAndUpdateFirestore(
    projectRef: admin.firestore.DocumentReference,
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
): Promise<void> {
    const db = admin.firestore();

    try {
        // Update: Generation started
        await projectRef.update({
            status: 'generating',
            generationProgress: 0,
            generationStartedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update: Research phase (25%)
        await projectRef.update({
            generationProgress: 25,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Generate slides
        const result = await generateSlides(
            topic,
            gradeLevel,
            subject,
            sourceMaterial,
            numSlides,
            useWebSearch,
            additionalInstructions,
            temperature,
            bulletsPerSlide,
            uploadedFileNames
        );

        // Update: Generation complete, writing to Firestore (75%)
        await projectRef.update({
            generationProgress: 75,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Write slides to subcollection
        const slidesCollectionRef = projectRef.collection('slides');
        const batch = db.batch();

        result.slides.forEach((slide, index) => {
            const slideId = slide.id || `slide-${Date.now()}-${index}`;
            const slideRef = slidesCollectionRef.doc(slideId);
            batch.set(slideRef, {
                ...slide,
                id: slideId,
                sortOrder: typeof slide.sortOrder === 'number' ? slide.sortOrder : index,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        // New: Calculate and increment project cost using pricing service
        await calculateAndIncrementProjectCost(
            projectRef,
            MODEL_SLIDE_GENERATION,
            result.inputTokens,
            result.outputTokens,
            'text'
        );

        // Update: Complete (100%) - Remove direct token updates
        await projectRef.update({
            status: 'completed',
            generationProgress: 100,
            sources: result.sources || [],
            generationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error: any) {
        console.error("Generation error:", error);
        try {
            await projectRef.update({
                status: 'failed',
                generationError: error.message || "Generation failed",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (updateError) {
            console.error("CRITICAL: Failed to update project status after generation error:", updateError);
        }
    }
}
