import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (must be before middleware)
admin.initializeApp();

import { verifyAuth, AuthenticatedRequest } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimiter';
import { generateSlides } from './services/slideGeneration';
import { generateImage } from './services/imageGeneration';
import { regenerateImageSpec } from './services/specRegeneration';
import { extractTextFromImage } from './services/imageTextExtraction';
import { GeminiError, ImageGenError } from '@shared/errors';

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Routes
// 1. Generate Slides
app.post('/generate-slides', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const {
            topic,
            gradeLevel,
            subject,
            sourceMaterial,
            numSlides,
            useWebSearch,
            additionalInstructions,
            temperature,
            bulletsPerSlide
        } = req.body;

        // Basic validation
        if (!topic || !gradeLevel || !subject) {
            res.status(400).json({ error: "Missing required fields: topic, gradeLevel, subject" });
            return;
        }

        const result = await generateSlides(
            topic,
            gradeLevel,
            subject,
            sourceMaterial || "",
            numSlides || 5,
            useWebSearch || false,
            additionalInstructions,
            temperature,
            bulletsPerSlide
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
        const { spec, gradeLevel, subject, options } = req.body;

        if (!spec || !gradeLevel || !subject) {
            res.status(400).json({ error: "Missing required fields: spec, gradeLevel, subject" });
            return;
        }

        const result = await generateImage(spec, gradeLevel, subject, options || {});
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

// 3. Regenerate Image Spec
app.post('/regenerate-spec', verifyAuth, rateLimitMiddleware, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { currentSpec, changeRequest, slideContext } = req.body;

        if (!currentSpec || !changeRequest || !slideContext) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }

        const newSpec = await regenerateImageSpec(currentSpec, changeRequest, slideContext);
        res.json({ spec: newSpec });

    } catch (error: any) {
        console.error("Regenerate Spec Error:", error);
        res.status(500).json({ error: error.message || "Failed to update spec" });
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

        const text = await extractTextFromImage(imageBase64, mimeType);
        res.json({ text });

    } catch (error: any) {
        console.error("Extract Text Error:", error);
        res.status(500).json({ error: "Text extraction failed" });
    }
});

// Export the API
export const api = functions.https.onRequest(app);
