import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAiClient } from '../utils/geminiClient';
import { buildResearchSystemPrompt, buildResearchUserPrompt, buildSlideDeckSystemPrompt, buildSlideDeckUserPrompt } from '@shared/promptBuilders';
import { retryWithBackoff, extractFirstJsonArray } from '@shared/utils/retryLogic';
import { validateSlideStructure } from '@shared/utils/validation';
import { DEFAULT_TEMPERATURE, DEFAULT_BULLETS_PER_SLIDE, MODEL_SLIDE_GENERATION } from '@shared/constants';
import { Slide, ProjectData } from '@shared/types';
import { GeminiError } from '@shared/errors';
import { generateImagePrompts } from './imageGeneration';
import { recordUsageEvent, UsageEventContext } from './usageEventsService';

type ResearchResult = {
    researchContent: string;
    sources: string[];
    searchEntryPoint?: any;
    webSearchQueries?: string[];
    inputTokens: number;
    outputTokens: number;
};

type GenerationResult = {
    slides: Slide[];
    inputTokens: number;
    outputTokens: number;
    warnings: string[];
};

type SlideGenerationTracking = {
    baseRequestId: string;
    userId: string;
    projectId: string;
    idempotencyKeySource: 'client' | 'server';
    sourceEndpoint?: string;
};

function extractGroundingData(groundingMetadata: any): {
    sources: Array<{ uri: string; title?: string }>;
    searchEntryPoint?: any;
    webSearchQueries?: string[];
} {
    const sources: Array<{ uri: string; title?: string }> = [];
    let searchEntryPoint = undefined;
    let webSearchQueries = undefined;

    if (groundingMetadata) {
        searchEntryPoint = groundingMetadata.searchEntryPoint?.renderedContent;
        webSearchQueries = groundingMetadata.webSearchQueries;

        if (groundingMetadata.groundingChunks) {
            groundingMetadata.groundingChunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    const normalizedUri = normalizeSourceUri(chunk.web.uri);
                    sources.push({
                        uri: normalizedUri,
                        title: chunk.web.title
                    });
                }
            });
        }
    }

    return { sources, searchEntryPoint, webSearchQueries };
}

function normalizeSourceUri(uri: string): string {
    const trimmed = uri.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    if (trimmed.startsWith('vertexaisearch.cloud.google.com/')) {
        return `https://${trimmed}`;
    }
    if (trimmed.startsWith('www.')) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

async function safeRecordUsageEvent(params: Parameters<typeof recordUsageEvent>[0]): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await recordUsageEvent(params);
            return;
        } catch (error: any) {
            if (attempt >= maxAttempts) {
                console.warn(
                    `[slideGeneration] Failed to record usage event (${params.operationKey}) after ${maxAttempts} attempts:`,
                    error?.message || error
                );
                return;
            }
            const delayMs = 200 * attempt;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

async function performUnifiedResearch(
    topic: string,
    gradeLevel: string,
    subject: string,
    sourceMaterial: string,
    useWebSearch: boolean,
    trackingContext: UsageEventContext,
    additionalInstructions?: string,
    temperature?: number,
    uploadedFileNames?: string[]
): Promise<ResearchResult> {
    const model = MODEL_SLIDE_GENERATION;
    const config: any = {
        temperature: temperature || DEFAULT_TEMPERATURE,
    };

    if (useWebSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    const researchSystemPrompt = buildResearchSystemPrompt();
    const researchUserPrompt = buildResearchUserPrompt(
        topic,
        subject,
        gradeLevel,
        sourceMaterial,
        useWebSearch,
        additionalInstructions
    );

    const result = await retryWithBackoff(() => getAiClient().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: researchUserPrompt }] }],
        config: {
            ...config,
            systemInstruction: { parts: [{ text: researchSystemPrompt }] }
        }
    }));

    const candidates = result.candidates;
    const researchContent = candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!researchContent) {
        throw new GeminiError("Empty response from research API", 'API_ERROR', true);
    }

    const inputTokens = result.usageMetadata?.promptTokenCount || 0;
    const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

    await safeRecordUsageEvent({
        ...trackingContext,
        operationKey: 'slide-research',
        inputTokens,
        outputTokens
    });

    const groundingMetadata = candidates?.[0]?.groundingMetadata;
    const { sources: groundingSources, searchEntryPoint, webSearchQueries } = extractGroundingData(groundingMetadata);

    // Diagnostic: Log when web search was enabled but model didn't use it
    if (useWebSearch && groundingSources.length === 0) {
        console.warn(
            `[performUnifiedResearch] WARNING: Web search was enabled but model returned no grounding sources. ` +
            `webSearchQueries=${webSearchQueries?.length || 0}, hasGroundingMetadata=${!!groundingMetadata}`
        );
    }

    const { sources: uniqueSources, stats } = await computeResolvedSources(
        groundingSources,
        uploadedFileNames,
        sourceMaterial
    );
    console.log(
        `[performUnifiedResearch] source_resolution total=${stats.totalGrounding} resolved=${stats.resolved} fallback=${stats.fallback} final=${stats.finalCount}`
    );

    return {
        researchContent,
        sources: uniqueSources,
        searchEntryPoint,
        webSearchQueries,
        inputTokens,
        outputTokens
    };
}

async function performSlideGeneration(
    topic: string,
    gradeLevel: string,
    subject: string,
    numSlides: number,
    researchContent: string,
    trackingContext: UsageEventContext,
    additionalInstructions?: string,
    temperature?: number,
    bulletsPerSlide?: number
): Promise<GenerationResult> {
    const systemPrompt = buildSlideDeckSystemPrompt();
    const userPrompt = buildSlideDeckUserPrompt(
        topic,
        subject,
        gradeLevel,
        numSlides,
        bulletsPerSlide || DEFAULT_BULLETS_PER_SLIDE,
        researchContent,
        additionalInstructions
    );

    const model = MODEL_SLIDE_GENERATION;
    const config: any = {
        temperature: temperature || DEFAULT_TEMPERATURE,
        responseMimeType: "application/json"
    };

    const result = await retryWithBackoff(() => getAiClient().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
            ...config,
            systemInstruction: { parts: [{ text: systemPrompt }] }
        }
    }));

    const candidates = result.candidates;
    const text = candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new GeminiError("Empty response from AI model", 'API_ERROR', true);
    }

    const inputTokens = result.usageMetadata?.promptTokenCount || 0;
    const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

    await safeRecordUsageEvent({
        ...trackingContext,
        operationKey: 'slide-generation',
        inputTokens,
        outputTokens
    });

    let slides: any[];
    try {
        slides = extractFirstJsonArray(text);
    } catch (e) {
        throw new GeminiError("Failed to parse JSON from model response", 'INVALID_REQUEST', false, { responseText: text });
    }

    const warnings: string[] = [];
    slides.forEach((slide, idx) => {
        const errors = validateSlideStructure(slide, idx);
        if (errors.length > 0) {
            warnings.push(...errors);
        }
    });

    const normalizedSlides: Slide[] = slides.map((s, i) => {
        const slideId = `slide-${Date.now()}-${i}`;

        return {
            ...s,
            id: slideId,
            sortOrder: i,
            content: Array.isArray(s.content) ? s.content : [String(s.content)],
            speakerNotes: s.speakerNotes || '',
            imagePrompts: [],
            currentPromptId: null
        };
    });

    return {
        slides: normalizedSlides,
        inputTokens,
        outputTokens,
        warnings
    };
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

function getUrlForLog(uri: string): string {
    try {
        const url = new URL(uri);
        return `${url.origin}${url.pathname}`;
    } catch (e) {
        return uri;
    }
}

function isVertexRedirectUrl(uri: string): boolean {
    return uri.includes('vertexaisearch.cloud.google.com');
}

function resolveLocationHeader(location: string | null, baseUri: string): string | null {
    if (!location) return null;
    try {
        return new URL(location, baseUri).toString();
    } catch (e) {
        return null;
    }
}

/**
 * Resolves vertexaisearch.cloud.google.com redirect links to their final URLs
 * Uses GET request with redirect: 'manual' to capture the Location header
 * Returns original URL if resolution fails (graceful degradation)
 */
async function getOriginalUrl(uri: string): Promise<string> {
    if (!uri || !isValidUrl(uri)) {
        return uri;
    }

    if (!isVertexRedirectUrl(uri)) {
        return uri;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
        // Use redirect: 'manual' to capture the redirect without following
        // This is faster and works better with redirect services
        const response = await fetch(uri, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SlidesEdu/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        clearTimeout(timeoutId);

        // Check for redirect status codes (301, 302, 303, 307, 308)
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const resolvedUrl = resolveLocationHeader(location, uri);
                if (resolvedUrl && resolvedUrl !== uri) {
                    return resolvedUrl;
                }
            }
        }

        // If no redirect, return original
        return uri;
    } catch (error: any) {
        clearTimeout(timeoutId);
        // Only log if not a timeout (timeouts are expected and handled gracefully)
        if (error?.name !== 'AbortError') {
            console.warn(`[getOriginalUrl] Failed to resolve ${getUrlForLog(uri)}:`, error?.message || error);
        }
        return uri;
    }
}

/**
 * Resolves all source URIs in parallel
 * Returns array with resolved URIs, preserving titles
 */
async function resolveSourceUrls(
    sources: Array<{ uri: string; title?: string }>
): Promise<Array<{ uri: string; title?: string }>> {
    if (!sources || sources.length === 0) {
        return [];
    }

    const resolvedSources = await Promise.all(
        sources.map(async source => {
            try {
                const resolvedUri = await getOriginalUrl(source.uri);
                return { ...source, uri: resolvedUri };
            } catch (error) {
                return source;
            }
        })
    );

    return resolvedSources;
}

type SourceResolutionStats = {
    totalGrounding: number;
    resolved: number;
    fallback: number;
    finalCount: number;
    usedSourcesFallback: boolean;
};

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

async function computeResolvedSources(
    groundingSources: Array<{ uri: string; title?: string }>,
    uploadedFileNames?: string[],
    sourceMaterial?: string
): Promise<{ sources: string[]; stats: SourceResolutionStats }> {
    const resolvedSources = await resolveSourceUrls(groundingSources);
    let resolvedCount = 0;
    let fallbackCount = 0;
    groundingSources.forEach((source, index) => {
        const resolvedUri = resolvedSources[index]?.uri;
        if (!resolvedUri) {
            return;
        }
        if (!isVertexRedirectUrl(source.uri)) {
            return;
        }
        if (resolvedUri !== source.uri) {
            resolvedCount += 1;
            return;
        }
        fallbackCount += 1;
    });
    let uniqueSources = getUniqueSources(resolvedSources, uploadedFileNames, sourceMaterial) || [];
    let usedSourcesFallback = false;
    if (uniqueSources.length === 0 && resolvedSources.length > 0) {
        const fallbackSources = resolvedSources
            .map(source => normalizeSourceUri(source.uri))
            .filter(uri => uri && uri.trim() && isValidUrl(uri));
        if (fallbackSources.length > 0) {
            uniqueSources = Array.from(new Set(fallbackSources));
            usedSourcesFallback = true;
        }
    }

    return {
        sources: uniqueSources,
        stats: {
            totalGrounding: groundingSources.length,
            resolved: resolvedCount,
            fallback: fallbackCount,
            finalCount: uniqueSources.length,
            usedSourcesFallback
        }
    };
}

async function updateProjectWithRetry(
    projectRef: admin.firestore.DocumentReference,
    data: Record<string, unknown>,
    attempts: number = 3
): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await projectRef.update(data);
            return;
        } catch (error) {
            lastError = error;
            if (attempt >= attempts) {
                throw error;
            }
            const delayMs = 250 * attempt;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastError;
}

export async function generateSlidesAndUpdateFirestore(
    projectRef: admin.firestore.DocumentReference,
    topic: string,
    gradeLevel: string,
    subject: string,
    sourceMaterial: string,
    numSlides: number,
    useWebSearch: boolean,
    tracking: SlideGenerationTracking,
    additionalInstructions?: string,
    temperature?: number,
    bulletsPerSlide?: number,
    uploadedFileNames?: string[]
): Promise<void> {
    const db = admin.firestore();
    const shouldUseWebSearch = useWebSearch || (!sourceMaterial && (!uploadedFileNames || uploadedFileNames.length === 0));
    const maxGenerationRetries = 3;
    let researchResult: ResearchResult | null = null;
    let generationResult: GenerationResult | null = null;
    const researchTracking = {
        requestId: `${tracking.baseRequestId}-research`,
        parentRequestId: tracking.baseRequestId,
        userId: tracking.userId,
        projectId: tracking.projectId,
        idempotencyKeySource: tracking.idempotencyKeySource,
        sourceEndpoint: tracking.sourceEndpoint
    };
    const generationTracking = {
        requestId: `${tracking.baseRequestId}-generation`,
        parentRequestId: tracking.baseRequestId,
        userId: tracking.userId,
        projectId: tracking.projectId,
        idempotencyKeySource: tracking.idempotencyKeySource,
        sourceEndpoint: tracking.sourceEndpoint
    };

    try {
        // Update: Generation started
        await projectRef.update({
            status: 'generating',
            generationProgress: 0,
            generationStartedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Step 1: Unified research phase
        researchResult = await performUnifiedResearch(
            topic,
            gradeLevel,
            subject,
            sourceMaterial,
            shouldUseWebSearch,
            researchTracking,
            additionalInstructions,
            temperature,
            uploadedFileNames
        );

        // Save research before Step 2 (resumable if generation fails)
        await updateProjectWithRetry(projectRef, {
            generationProgress: 25,
            sources: researchResult.sources || [],
            researchContent: researchResult.researchContent,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Step 2: Generate slides (auto-retry using saved research)
        for (let attempt = 1; attempt <= maxGenerationRetries; attempt++) {
            try {
                generationResult = await performSlideGeneration(
                    topic,
                    gradeLevel,
                    subject,
                    numSlides,
                    researchResult.researchContent,
                    generationTracking,
                    additionalInstructions,
                    temperature,
                    bulletsPerSlide
                );
                break;
            } catch (error: any) {
                if (attempt >= maxGenerationRetries) {
                    throw error;
                }
                const delayMs = 1000 * attempt;
                console.warn(`Generation attempt ${attempt} failed, retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        if (!generationResult) {
            throw new GeminiError("Generation failed after retries", 'API_ERROR', false);
        }

        // Update: Generation complete, writing to Firestore (75%)
        await projectRef.update({
            generationProgress: 75,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Write slides to subcollection
        const slidesCollectionRef = projectRef.collection('slides');
        const batch = db.batch();

        generationResult.slides.forEach((slide, index) => {
            const slideId = slide.id || `slide-${Date.now()}-${index}`;
            const slideRef = slidesCollectionRef.doc(slideId);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:275', message: 'Preparing slide for batch', data: { slideId, index, slideTitle: slide.title }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
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
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:289', message: 'Slide data prepared', data: { slideId, hasPromptState: slideData.promptGenerationState !== undefined }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
            // #endregion
            batch.set(slideRef, slideData);
        });

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:290', message: 'About to commit batch', data: { slideCount: generationResult.slides.length, projectId: projectRef.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
        // #endregion
        await batch.commit();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:291', message: 'Batch committed successfully', data: { projectId: projectRef.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
        // #endregion

        // Note: Image prompt generation is now user-triggered per slide
        // No automatic generation after slide creation

        // Update: Complete (100%) - Remove direct token updates
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:305', message: 'About to update to completed', data: { projectId: projectRef.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
        // #endregion
        let sourcesToWrite = researchResult.sources || [];
        if (sourcesToWrite.length === 0) {
            const existingSnapshot = await projectRef.get();
            const existingSources = existingSnapshot.get('sources');
            if (Array.isArray(existingSources) && existingSources.length > 0) {
                sourcesToWrite = existingSources;
            }
        }

        await updateProjectWithRetry(projectRef, {
            status: 'completed',
            generationProgress: 100,
            sources: sourcesToWrite,
            researchContent: researchResult.researchContent,
            generationCompletedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:311', message: 'Update to completed successful', data: { projectId: projectRef.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
        // #endregion

    } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:313', message: 'Generation error caught', data: { errorMessage: error?.message, errorStack: error?.stack, errorName: error?.name, projectId: projectRef.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
        // #endregion
        console.error("Generation error:", error);
        try {
            await projectRef.update({
                status: 'failed',
                generationError: error.message || "Generation failed",
                updatedAt: FieldValue.serverTimestamp()
            });
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:320', message: 'Error status updated successfully', data: { projectId: projectRef.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
            // #endregion
        } catch (updateError: any) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'slideGeneration.ts:322', message: 'CRITICAL: Failed to update error status', data: { updateError: updateError?.message, projectId: projectRef.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
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
    projectData: ProjectData,
    slideData: Slide,
    trackingContext: UsageEventContext
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
            slideData.content || [],
            trackingContext
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

