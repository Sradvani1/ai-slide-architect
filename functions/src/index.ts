import 'module-alias/register';
import * as functions from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as express from 'express';
import * as cors from 'cors';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (must be before middleware)
admin.initializeApp();

// Define the secret for admin user ID
const adminUserIdSecret = defineSecret('ADMIN_USER_ID');

import { verifyAuth, AuthenticatedRequest } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimiter';
import { generateSlides, generateSlidesAndUpdateFirestore } from './services/slideGeneration';
import { generateImage } from './services/imageGeneration';
import { calculateAndIncrementProjectCost } from './services/pricingService';
import { extractTextFromImage } from './services/imageTextExtraction';
import { Slide } from '@shared/types';
import { initializeModelPricing } from './utils/initializePricing';
import { GeminiError, ImageGenError } from '@shared/errors';
import { apiKey } from './utils/geminiClient';
import { generateImagePromptsForSlide } from './services/promptGenerationService';

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
            temperature,
            bulletsPerSlide,
            uploadedFileNames
        } = req.body;

        // Basic validation
        if (!topic || !gradeLevel || !subject) {
            res.status(400).json({ error: "Missing required fields: topic, gradeLevel, subject" });
            return;
        }

        // Background generation if projectId is provided
        if (projectId) {
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
                additionalInstructions,
                temperature,
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
        }

        // Legacy synchronous behavior
        const result = await generateSlides(
            topic,
            gradeLevel,
            subject,
            sourceMaterial || "",
            numSlides || 5,
            useWebSearch || false,
            additionalInstructions,
            temperature,
            bulletsPerSlide,
            uploadedFileNames
        );

        res.json(result);

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
        const { imagePrompt, options } = req.body;

        if (!imagePrompt || typeof imagePrompt !== 'string') {
            res.status(400).json({ error: "Missing required field: imagePrompt (string)" });
            return;
        }

        const result = await generateImage(imagePrompt, options || {});
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
        const { imageBase64, mimeType } = req.body;

        if (!imageBase64) {
            res.status(400).json({ error: "Missing image data" });
            return;
        }

        if (!mimeType) {
            res.status(400).json({ error: "Missing required field: mimeType" });
            return;
        }

        const result = await extractTextFromImage(imageBase64, mimeType);
        res.json(result);

    } catch (error: any) {
        console.error("Extract Text Error:", error);
        res.status(500).json({ error: "Text extraction failed" });
    }
});

/**
 * 5. Increment Project Tokens (from frontend)
 */
app.post('/increment-project-tokens', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { projectId, modelId, inputTokens, outputTokens, operationType } = req.body;

        if (!projectId || !modelId || inputTokens === undefined || outputTokens === undefined || !operationType) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }

        // Validate token counts are positive numbers
        if (typeof inputTokens !== 'number' || inputTokens < 0 || typeof outputTokens !== 'number' || outputTokens < 0) {
            res.status(400).json({ error: "Invalid token values. Must be non-negative numbers." });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const userId = req.user.uid;
        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        const cost = await calculateAndIncrementProjectCost(
            projectRef,
            modelId,
            inputTokens,
            outputTokens,
            operationType
        );

        res.json({ success: true, cost });
    } catch (error: any) {
        console.error("Increment Tokens Error:", error);
        res.status(500).json({ error: "Failed to update token counts" });
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
 * 8. Retry Prompt Generation (for specific slide or all failed in project)
 */
app.post('/retry-prompt-generation', verifyAuth, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { projectId, slideId } = req.body;

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

        // Verify project exists and belongs to user
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            res.status(404).json({ error: "Project not found or unauthorized" });
            return;
        }

        if (slideId) {
            // Retry specific slide with transaction
            const slideRef = projectRef.collection('slides').doc(slideId);

            try {
                await db.runTransaction(async (transaction) => {
                    const slideDoc = await transaction.get(slideRef);
                    if (!slideDoc.exists) {
                        throw new Error('DOC_NOT_FOUND');
                    }

                    const data = slideDoc.data() as Slide;
                    const existingPrompts = data?.imagePrompts || [];

                    // Skip if already complete
                    if (existingPrompts.length >= 3) {
                        throw new Error('ALREADY_COMPLETE');
                    }

                    // Block if already processing
                    if (data.promptGenerationState === 'generating' || data.promptGenerationState === 'completed') {
                        throw new Error('ALREADY_PROCESSING');
                    }

                    // Atomically claim by setting to 'generating'
                    transaction.update(slideRef, {
                        promptGenerationState: 'generating',
                        promptGenerationError: FieldValue.delete(),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                });

                // Process directly (fire and forget)
                generateImagePromptsForSlide(slideRef, projectRef).catch(error => {
                    console.error(`[RETRY] Error processing prompts for slide ${slideId}:`, error);
                });

                res.json({ success: true, message: `Slide ${slideId} retry started.` });

            } catch (error: any) {
                if (error.message === 'DOC_NOT_FOUND') {
                    res.status(404).json({ error: "Slide not found" });
                    return;
                }
                if (['ALREADY_PROCESSING', 'ALREADY_COMPLETE'].includes(error.message)) {
                    res.json({ success: true, message: `Slide ${slideId} is already processing or complete.` });
                    return;
                }
                throw error; // Re-throw to outer catch
            }
        } else {
            // Retry all failed slides - batch updates (no transaction per slide for simplicity)
            const failedSlidesSnapshot = await projectRef.collection('slides')
                .where('promptGenerationState', '==', 'failed')
                .get();

            if (failedSlidesSnapshot.empty) {
                res.json({ success: true, message: "No failed slides found to retry." });
                return;
            }

            // For batch, use simple batch update
            const batch = db.batch();
            let count = 0;
            for (const slideDoc of failedSlidesSnapshot.docs) {
                const data = slideDoc.data() as Slide;
                // Skip if already complete
                if ((data.imagePrompts || []).length >= 3) continue;

                batch.update(slideDoc.ref, {
                    promptGenerationState: 'generating',
                    promptGenerationError: FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp()
                });
                count++;
            }

            if (count > 0) {
                await batch.commit();

                // Start processing each slide (fire and forget)
                for (const slideDoc of failedSlidesSnapshot.docs) {
                    const data = slideDoc.data() as Slide;
                    if ((data.imagePrompts || []).length >= 3) continue;

                    generateImagePromptsForSlide(slideDoc.ref, projectRef).catch(error => {
                        console.error(`[RETRY] Error processing slide ${slideDoc.id}:`, error);
                    });
                }
            }

            res.json({ success: true, message: `Retry started for ${count} slides.` });
        }
    } catch (error: any) {
        console.error("Retry Prompt Generation Error:", error);
        res.status(500).json({ error: "Failed to retry prompt generation" });
    }
});

// 6. Triggers
export const onSlideCreated = onDocumentCreated(
    {
        document: 'users/{userId}/projects/{projectId}/slides/{slideId}',
        secrets: [apiKey],
        timeoutSeconds: 60,
        maxInstances: 100
    },
    async (event) => {
        const slideRef = event.data?.ref;
        if (!slideRef) return;

        const projectId = event.params.projectId;
        const userId = event.params.userId;

        const db = admin.firestore();
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

        try {
            // Use transaction to atomically claim processing
            await db.runTransaction(async (transaction) => {
                const currentDoc = await transaction.get(slideRef);
                if (!currentDoc.exists) throw new Error('DOC_NOT_FOUND');

                const currentData = currentDoc.data() as Slide;
                const existingPrompts = currentData?.imagePrompts || [];

                // Skip if already complete
                if (existingPrompts.length >= 3) {
                    throw new Error('ALREADY_COMPLETE');
                }

                // Block if already processing or completed
                const currentState = currentData?.promptGenerationState;
                if (currentState === 'generating' || currentState === 'completed') {
                    throw new Error('ALREADY_PROCESSING');
                }

                transaction.update(slideRef, {
                    promptGenerationState: 'generating',
                    promptGenerationError: FieldValue.delete(),
                    'promptGenerationProgress.succeeded': existingPrompts.length,
                    'promptGenerationProgress.failed': FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp()
                });
            });

            // Process directly (fire and forget)
            generateImagePromptsForSlide(slideRef, projectRef).catch(error => {
                console.error(`[TRIGGER] Error processing prompts for slide ${slideRef.id}:`, error);
                slideRef.update({
                    promptGenerationState: 'failed',
                    promptGenerationError: 'Failed to start prompt generation',
                    updatedAt: FieldValue.serverTimestamp()
                }).catch(updateError => {
                    console.error(`[TRIGGER] Failed to update error state:`, updateError);
                });
            });

        } catch (error: any) {
            if (['ALREADY_PROCESSING', 'ALREADY_COMPLETE', 'DOC_NOT_FOUND'].includes(error.message)) {
                return; // Gracefully handle expected conditions
            }
            console.error(`[TRIGGER] Error in trigger for slide ${slideRef.id}:`, error);
        }
    }
);

// Export the API
export const api = functions.https.onRequest(
    {
        timeoutSeconds: 300,
        memory: '1GiB',
        secrets: [adminUserIdSecret, apiKey]
    },
    app
);
