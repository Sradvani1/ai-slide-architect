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

            const speakerNotes = s.speakerNotes || '';

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
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:275',message:'Preparing slide for batch',data:{slideId,index,slideTitle:slide.title},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            // Destructure to explicitly exclude promptGenerationState and promptGenerationError
            // These fields should only be set when user triggers generation
            const { promptGenerationState, promptGenerationError, ...slideWithoutState } = slide;
            const slideData: any = {
                ...slideWithoutState,
                id: slideId,
                sortOrder: typeof slide.sortOrder === 'number' ? slide.sortOrder : index,
                imagePrompts: [],
                updatedAt: FieldValue.serverTimestamp()
            };
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:289',message:'Slide data prepared',data:{slideId,hasPromptState:slideData.promptGenerationState!==undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            batch.set(slideRef, slideData);
        });

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:290',message:'About to commit batch',data:{slideCount:result.slides.length,projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        await batch.commit();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:291',message:'Batch committed successfully',data:{projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion

        // Note: Image prompt generation is now user-triggered per slide
        // No automatic generation after slide creation

        // New: Calculate and increment project cost using pricing service
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:296',message:'About to calculate cost',data:{modelId:MODEL_SLIDE_GENERATION,inputTokens:result.inputTokens,outputTokens:result.outputTokens},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        await calculateAndIncrementProjectCost(
            projectRef,
            MODEL_SLIDE_GENERATION,
            result.inputTokens,
            result.outputTokens,
            'text'
        );
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:302',message:'Cost calculated successfully',data:{projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        // Update: Complete (100%) - Remove direct token updates
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:305',message:'About to update to completed',data:{projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        await projectRef.update({
            status: 'completed',
            generationProgress: 100,
            sources: result.sources || [],
            generationCompletedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:311',message:'Update to completed successful',data:{projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

    } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:313',message:'Generation error caught',data:{errorMessage:error?.message,errorStack:error?.stack,errorName:error?.name,projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        console.error("Generation error:", error);
        try {
            await projectRef.update({
                status: 'failed',
                generationError: error.message || "Generation failed",
                updatedAt: FieldValue.serverTimestamp()
            });
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:320',message:'Error status updated successfully',data:{projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
        } catch (updateError: any) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slideGeneration.ts:322',message:'CRITICAL: Failed to update error status',data:{updateError:updateError?.message,projectId:projectRef.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            console.error("CRITICAL: Failed to update project status after generation error:", updateError);
        }
    }
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

