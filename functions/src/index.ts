import 'module-alias/register';
import * as functions from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as express from 'express';
import * as cors from 'cors';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

// Initialize Firebase Admin (must be before middleware)
admin.initializeApp();

// Define the secret for admin user ID
const adminUserIdSecret = defineSecret('ADMIN_USER_ID');
const braveApiKeySecret = defineSecret('BRAVE_API_KEY');

import { verifyAuth, AuthenticatedRequest } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimiter';
import { generateSlidesAndUpdateFirestore, generateImagePromptsForSingleSlide } from './services/slideGeneration';
import { generateImage, generateImageSearchTerms } from './services/imageGeneration';
import { searchBraveImages } from './services/imageSearch';
import { extractTextFromImage } from './services/imageTextExtraction';
import { createShareLink, claimShareLink, getSharePreview } from './services/shareService';
import { Slide, ProjectData } from '@shared/types';
import { initializeModelPricing } from './utils/initializePricing';
import { GeminiError, ImageGenError } from '@shared/errors';
import { apiKey } from './utils/geminiClient';

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Routes
// 1. Generate Slides
app.post('/generate-slides', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const {
            projectId,
            topic,
            gradeLevel,
            subject,
            sourceMaterial,
            numSlides,
            useWebSearch,
            additionalInstructions,
            bulletsPerSlide,
            uploadedFileNames,
            requestId
        } = req.body;

        // Basic validation
        if (!topic || !gradeLevel || !subject) {
            res.status(400).json({ error: "Missing required fields: topic, gradeLevel, subject" });
            return;
        }

        if (!projectId) {
            res.status(400).json({ error: "Missing required field: projectId" });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        // Verify project exists
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found" });
            return;
        }

        const baseRequestId = typeof requestId === 'string' && requestId.trim()
            ? requestId
            : crypto.randomUUID();
        await projectRef.update({
            generationRequestId: baseRequestId,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Return 202 Accepted immediately
        res.status(202).json({
            message: "Generation started",
            projectId
        });

        // Start background generation
        generateSlidesAndUpdateFirestore(
            projectRef,
            topic,
            gradeLevel,
            subject,
            sourceMaterial || "",
            numSlides || 5,
            useWebSearch || false,
            {
                baseRequestId,
                userId,
                projectId
            },
            additionalInstructions,
            bulletsPerSlide,
            uploadedFileNames
        ).catch(error => {
            console.error("Background generation error:", error);
            // Update project with error status as a fallback
            projectRef.update({
                status: 'failed',
                generationError: error.message || "Background generation failed",
                updatedAt: FieldValue.serverTimestamp()
            }).catch(updateError => {
                console.error("Failed to update error status in background catch:", updateError);
            });
        });
        return;

    } catch (error: any) {
        console.error("Generate Slides Error:", error);
        if (error instanceof GeminiError) {
            res.status(error.code === 'RATE_LIMIT' ? 429 : 500).json({
                error: error.message,
                code: error.code,
                isRetryable: error.isRetryable
            });
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
});

// 2. Generate Image
app.post('/generate-image', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { imagePrompt, options, projectId } = req.body;

        if (!imagePrompt || typeof imagePrompt !== 'string') {
            res.status(400).json({ error: "Missing required field: imagePrompt (string)" });
            return;
        }
        if (!projectId) {
            res.status(400).json({ error: "Missing required field: projectId" });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found or unauthorized" });
            return;
        }

        const result = await generateImage(imagePrompt, {
            userId,
            projectId
        }, options || {});
        res.json(result);

    } catch (error: any) {
        console.error("Generate Image Error:", error);
        if (error instanceof ImageGenError) {
            const status = error.code === 'NO_IMAGE_DATA' ? 500 : 400; // Map generic bad request
            res.status(status).json({ error: error.message, code: error.code });
        } else {
            res.status(500).json({ error: "Image generation failed" });
        }
    }
});




// 4. Extract Text from Image
app.post('/extract-text', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { imageBase64, mimeType, projectId } = req.body;

        if (!imageBase64) {
            res.status(400).json({ error: "Missing image data" });
            return;
        }

        if (!mimeType) {
            res.status(400).json({ error: "Missing required field: mimeType" });
            return;
        }
        if (!projectId) {
            res.status(400).json({ error: "Missing required field: projectId" });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found or unauthorized" });
            return;
        }

        const result = await extractTextFromImage(imageBase64, mimeType, {
            userId,
            projectId
        });
        res.json(result);

    } catch (error: any) {
        console.error("Extract Text Error:", error);
        res.status(500).json({ error: "Text extraction failed" });
    }
});

/**
 * 6. (Admin Only) Initialize Pricing
 * In a real app, this would be highly protected.
 */
app.post('/admin/initialize-pricing', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        // Admin check - secret is accessed via defineSecret().value()
        const ADMIN_USER_ID = adminUserIdSecret.value();
        if (!ADMIN_USER_ID || req.user?.uid !== ADMIN_USER_ID) {
            res.status(403).json({ error: "Forbidden: Admin access required" });
            return;
        }

        await initializeModelPricing();

        res.json({ success: true, message: "Model pricing initialized" });
    } catch (error: any) {
        console.error("Initialize Pricing Error:", error);
        res.status(500).json({ error: "Failed to initialize pricing" });
    }
});

/**
 * 8. Generate or regenerate image prompt for a specific slide.
 * Handles both initial generation and retry scenarios.
 */
app.post('/generate-prompt', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { projectId, slideId, regenerate = false, requestId } = req.body;

        if (!projectId || !slideId) {
            res.status(400).json({ error: "Missing required fields: projectId, slideId" });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        // Verify project exists and belongs to user
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found or unauthorized" });
            return;
        }

        const slideRef = projectRef.collection('slides').doc(slideId);
        const slideDoc = await slideRef.get();

        if (!slideDoc.exists) {
            res.status(404).json({ error: "Slide not found" });
            return;
        }

        const slideData = slideDoc.data() as Slide;
        const projectData = projectDoc.data() as ProjectData;
        const baseRequestId = typeof requestId === 'string' && requestId.trim()
            ? requestId
            : (!regenerate && slideData.promptRequestId ? slideData.promptRequestId : crypto.randomUUID());

        // Check if prompt already exists
        const hasPrompt = (slideData.imagePrompts || []).length > 0;
        if (hasPrompt && !regenerate) {
            res.status(400).json({
                error: "Slide already has a prompt. Set regenerate=true to create a new one."
            });
            return;
        }

        // Check if already generating (prevent duplicate requests)
        if (slideData.promptGenerationState === 'generating') {
            // Self-healing: If it's been stuck for >5 minutes, allow retry
            const updatedAt = slideData.updatedAt;
            const updatedAtMs = updatedAt?.toMillis?.() || updatedAt || 0;
            const elapsed = Date.now() - updatedAtMs;
            const timeoutMs = 5 * 60 * 1000; // 5 minutes

            if (elapsed < timeoutMs) {
                res.status(409).json({
                    error: "Prompt generation already in progress for this slide."
                });
                return;
            }
            // Stuck for too long, allow retry (will overwrite state)
            console.log(`[PROMPT_GEN] Overwriting stuck generation state for slide ${slideId} (elapsed: ${Math.round(elapsed / 1000)}s)`);
        }

        // Atomically claim by setting to 'generating'
        await slideRef.update({
            promptGenerationState: 'generating',
            promptGenerationError: FieldValue.delete(),
            promptRequestId: baseRequestId,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Process in background (fire and forget)
        generateImagePromptsForSingleSlide(slideRef, projectData, slideData, {
            userId,
            projectId
        }).catch(error => {
            console.error(`[PROMPT_GEN] Error processing prompt for slide ${slideId}:`, error);
        });

        res.json({
            success: true,
            message: `Prompt generation started for slide ${slideId}.`
        });
    } catch (error: any) {
        console.error("Generate Prompt Error:", error);
        res.status(500).json({ error: "Failed to initiate prompt generation" });
    }
});

/**
 * 9. Search images for a specific slide (one-time).
 */
app.post('/search-images', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { projectId, slideId } = req.body;

        if (!projectId || !slideId) {
            res.status(400).json({ error: "Missing required fields: projectId, slideId" });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found or unauthorized" });
            return;
        }

        const slideRef = projectRef.collection('slides').doc(slideId);
        const slideDoc = await slideRef.get();

        if (!slideDoc.exists) {
            res.status(404).json({ error: "Slide not found" });
            return;
        }

        const slideData = slideDoc.data() as Slide;
        const projectData = projectDoc.data() as ProjectData;

        const existingSearchImages = (slideData.generatedImages || []).filter(img => img.source === 'search');
        if (existingSearchImages.length > 0) {
            res.status(400).json({ error: "Search already completed for this slide." });
            return;
        }

        const searchTermsResult = await generateImageSearchTerms(
            projectData.topic,
            projectData.subject,
            projectData.gradeLevel,
            slideData.title,
            slideData.content || [],
            { userId, projectId }
        );
        const effectiveTerms = searchTermsResult.terms.length > 0
            ? searchTermsResult.terms
            : [slideData.title].filter(Boolean);

        const apiKey = braveApiKeySecret.value();
        if (!apiKey) {
            res.status(500).json({ error: "Image search is not configured." });
            return;
        }

        const searchResults = await searchBraveImages(effectiveTerms, apiKey, 50);

        const mergedImages = [...(slideData.generatedImages || []), ...searchResults];

        await slideRef.update({
            generatedImages: mergedImages,
            updatedAt: FieldValue.serverTimestamp()
        });

        res.json({
            searchTerms: effectiveTerms,
            results: searchResults
        });
    } catch (error: any) {
        console.error("Search Images Error:", error);
        res.status(500).json({ error: error.message || "Image search failed" });
    }
});

/**
 * 10. Claim a share link and create a copy for the current user.
 */
app.post('/share/claim', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ error: 'Missing required field: token' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await claimShareLink(token, req.user.uid);
        res.json(result);
    } catch (error: any) {
        console.error('Claim Share Link Error:', error);
        const message = error?.message || 'Failed to claim share link';
        const status = message.includes('generating') ? 409 : (message.includes('not found') ? 404 : 500);
        res.status(status).json({ error: message });
    }
});

/**
 * 11. Fetch share preview data (no auth required).
 */
app.get('/share/preview', async (req: express.Request, res: express.Response) => {
    try {
        const token = typeof req.query.token === 'string' ? req.query.token : '';
        if (!token) {
            res.status(400).json({ error: 'Missing required query param: token' });
            return;
        }

        const result = await getSharePreview(token);
        res.json(result);
    } catch (error: any) {
        console.error('Share Preview Error:', error);
        const message = error?.message || 'Failed to load share preview';
        const status = message.includes('not found') ? 404 : 500;
        res.status(status).json({ error: message });
    }
});

/**
 * 12. Create a persistent share link when a project is created.
 */
export const onProjectCreate = onDocumentCreated('users/{userId}/projects/{projectId}', async (event) => {
    const { userId, projectId } = event.params;
    const projectData = event.data?.data() as (ProjectData & { shareToken?: string }) | undefined;
    if (!projectData || projectData.shareToken) return;

    try {
        await createShareLink(userId, projectId);
    } catch (error) {
        console.error('Share link creation on project create failed:', error);
    }
});




// Export the API
export const api = functions.https.onRequest(
    {
        timeoutSeconds: 300,
        memory: '1GiB',
        secrets: [adminUserIdSecret, apiKey, braveApiKeySecret]
    },
    app
);

