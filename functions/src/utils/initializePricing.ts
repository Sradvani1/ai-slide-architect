import * as admin from 'firebase-admin';
import { ModelPricing } from '@shared/types';
import { MODEL_SLIDE_GENERATION, MODEL_IMAGE_GENERATION } from '@shared/constants';

/**
 * Initializes the modelPricing collection with initial rates.
 * This is meant to be called once or whenever pricing scales change.
 */
export async function initializeModelPricing(): Promise<void> {
    const db = admin.firestore();
    const now = Date.now();

    const pricingData: ModelPricing[] = [
        {
            id: MODEL_SLIDE_GENERATION, // gemini-3-flash-preview
            modelName: 'Gemini 3 Flash Preview',
            modelType: 'text',
            inputPricePer1MTokens: 0.50,
            outputPricePer1MTokens: 3.00,
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        },
        {
            id: MODEL_IMAGE_GENERATION, // gemini-3-pro-image-preview
            modelName: 'Gemini 3 Pro Preview (Image)',
            modelType: 'image',
            inputPricePer1MTokens: 3.00,
            outputPricePer1MTokens: 120.00,
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    ];

    const batch = db.batch();

    for (const pricing of pricingData) {
        const ref = db.collection('modelPricing').doc(pricing.id);
        batch.set(ref, pricing);
    }

    try {
        await batch.commit();
        console.log('[initializePricing] Successfully initialized model pricing.');
    } catch (error) {
        console.error('[initializePricing] Error initializing model pricing:', error);
        throw error;
    }
}
