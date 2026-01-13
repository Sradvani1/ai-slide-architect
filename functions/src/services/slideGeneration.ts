import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAiClient } from '../utils/geminiClient';
import { buildSlideDeckSystemPrompt, buildSlideDeckUserPrompt } from '@shared/promptBuilders';
import { retryWithBackoff, extractFirstJsonArray } from '@shared/utils/retryLogic';
import { validateSlideStructure } from '@shared/utils/validation';
import { DEFAULT_TEMPERATURE, DEFAULT_BULLETS_PER_SLIDE, MODEL_SLIDE_GENERATION } from '@shared/constants';
import { Slide, ProjectData } from '@shared/types';
import { GeminiError } from '@shared/errors';
import { calculateAndIncrementProjectCost } from './pricingService';
import { generateImagePrompts } from './imageGeneration';

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
    const systemPrompt = buildSlideDeckSystemPrompt();
    const userPrompt = buildSlideDeckUserPrompt(
        topic,
        subject,
        gradeLevel,
        numSlides,     // numContentSlides
        bulletsPerSlide || DEFAULT_BULLETS_PER_SLIDE,
        sourceMaterial,
        useWebSearch,
        additionalInstructions
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
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                ...config,
                systemInstruction: { parts: [{ text: systemPrompt }] }
            }
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

            // Clean speaker notes first
            let speakerNotes = cleanSpeakerNotes(s.speakerNotes || '');

            // Append sources to the last slide only
            const isLastSlide = i === slides.length - 1;
            if (isLastSlide && uniqueSources && uniqueSources.length > 0) {
                speakerNotes += '\n\nSources:\n' + uniqueSources.join('\n');
            }

            return {
                ...s,
                id: slideId,
                sortOrder: i,
                // Ensure compatibility
                content: Array.isArray(s.content) ? s.content : [String(s.content)],
                speakerNotes: speakerNotes,
                imagePrompts: [],
                currentPromptId: null
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

    // Use uploadedFileNames if available, otherwise fallback to extraction
    const fileNames = (uploadedFileNames && uploadedFileNames.length > 0)
        ? uploadedFileNames
        : extractFileNamesFromSourceMaterial(sourceMaterial || "");
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
            generationStartedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Update: Research phase (25%)
        await projectRef.update({
            generationProgress: 25,
            updatedAt: FieldValue.serverTimestamp()
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
            updatedAt: FieldValue.serverTimestamp()
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
                imagePrompts: [],
                updatedAt: FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        // New: Generate image prompts in parallel for all slides
        await generateImagePromptsForAllSlides(projectRef, {
            topic,
            gradeLevel,
            subject,
            ...result
        } as any);

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
            generationCompletedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

    } catch (error: any) {
        console.error("Generation error:", error);
        try {
            await projectRef.update({
                status: 'failed',
                generationError: error.message || "Generation failed",
                updatedAt: FieldValue.serverTimestamp()
            });
        } catch (updateError) {
            console.error("CRITICAL: Failed to update project status after generation error:", updateError);
        }
    }
}

/**
 * Generates image prompts for all slides in parallel (one prompt per slide).
 * Processes slides simultaneously with no rate limiting constraints.
 * Errors are handled per slide independently.
 */
async function generateImagePromptsForAllSlides(
    projectRef: admin.firestore.DocumentReference,
    projectData: ProjectData
): Promise<void> {
    const slidesCollectionRef = projectRef.collection('slides');

    // Query all slides ordered by sortOrder
    const slidesSnapshot = await slidesCollectionRef
        .orderBy('sortOrder', 'asc')
        .get();

    if (slidesSnapshot.empty) {
        console.log('[PROMPT_GEN] No slides found to process');
        return;
    }

    console.log(`[PROMPT_GEN] Starting parallel prompt generation for ${slidesSnapshot.size} slides`);

    // Process all slides in parallel
    const promptPromises = slidesSnapshot.docs.map(async (slideDoc) => {
        const slideData = slideDoc.data() as Slide;

        // Skip if already has a prompt
        if ((slideData.imagePrompts || []).length >= 1) {
            console.log(`[PROMPT_GEN] Slide ${slideDoc.id} already has prompt, skipping`);
            return;
        }

        return generateImagePromptsForSingleSlide(slideDoc.ref, projectRef, projectData, slideData);
    });

    // Wait for all slides to complete (success or failure)
    await Promise.allSettled(promptPromises);
    console.log(`[PROMPT_GEN] Parallel prompt generation completed for project ${projectRef.id}`);
}

/**
 * Helper to generate prompts for a single slide and update Firestore
 */
export async function generateImagePromptsForSingleSlide(
    slideRef: admin.firestore.DocumentReference,
    projectRef: admin.firestore.DocumentReference,
    projectData: ProjectData,
    slideData: Slide
): Promise<void> {
    try {
        // Update state to generating
        await slideRef.update({
            promptGenerationState: 'generating',
            updatedAt: FieldValue.serverTimestamp()
        });

        // Generate single prompt
        const result = await generateImagePrompts(
            projectData.topic || '',
            projectData.subject || '',
            projectData.gradeLevel || '',
            slideData.title || '',
            slideData.content || []
        );

        // Save the prompt
        if (result.prompts.length > 0) {
            const prompt = result.prompts[0];
            await slideRef.update({
                imagePrompts: [{
                    id: prompt.id,
                    text: prompt.text,
                    inputTokens: prompt.inputTokens,
                    outputTokens: prompt.outputTokens,
                    createdAt: Date.now(),
                    isOriginal: true
                }],
                currentPromptId: prompt.id,
                promptGenerationState: 'completed',
                updatedAt: FieldValue.serverTimestamp()
            });

            // Track costs
            await calculateAndIncrementProjectCost(
                projectRef,
                MODEL_SLIDE_GENERATION,
                result.totalInputTokens,
                result.totalOutputTokens,
                'text'
            );

            console.log(`[PROMPT_GEN] Successfully generated prompt for slide ${slideRef.id}`);
        } else {
            throw new Error('No prompt generated');
        }
    } catch (error: any) {
        console.error(`[PROMPT_GEN] Error generating prompt for slide ${slideRef.id}:`, error);
        await slideRef.update({
            promptGenerationState: 'failed',
            promptGenerationError: error.message || 'Failed to generate prompt',
            updatedAt: FieldValue.serverTimestamp()
        });
    }
}
