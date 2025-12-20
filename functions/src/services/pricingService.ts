import * as admin from 'firebase-admin';
import { ModelPricing } from '@shared/types';

const PRICING_CACHE = new Map<string, { data: ModelPricing; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches model pricing from Firestore with simple in-memory caching.
 */
export async function getModelPricing(modelId: string): Promise<ModelPricing | null> {
    const now = Date.now();
    const cached = PRICING_CACHE.get(modelId);

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    try {
        const db = admin.firestore();
        const doc = await db.collection('modelPricing').doc(modelId).get();

        if (!doc.exists) {
            console.warn(`[pricingService] No pricing found for model: ${modelId}`);
            return null;
        }

        const pricing = { id: doc.id, ...doc.data() } as ModelPricing;
        PRICING_CACHE.set(modelId, { data: pricing, timestamp: now });
        return pricing;
    } catch (error) {
        console.error(`[pricingService] Error fetching pricing for ${modelId}:`, error);
        return null;
    }
}

/**
 * Calculates cost based on tokens and pricing.
 */
export function calculateCost(
    inputTokens: number,
    outputTokens: number,
    pricing: ModelPricing
): number {
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePer1MTokens;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1MTokens;
    return inputCost + outputCost;
}

/**
 * Calculates cost and increments project-level tokens and cost atomically.
 */
export async function calculateAndIncrementProjectCost(
    projectRef: admin.firestore.DocumentReference,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    operationType: 'text' | 'image'
): Promise<number> {
    const pricing = await getModelPricing(modelId);

    // If no pricing found, we still want to increment tokens (at 0 cost)
    const cost = pricing ? calculateCost(inputTokens, outputTokens, pricing) : 0;

    const updateData: any = {
        totalCost: admin.firestore.FieldValue.increment(cost),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (operationType === 'text') {
        updateData.textInputTokens = admin.firestore.FieldValue.increment(inputTokens);
        updateData.textOutputTokens = admin.firestore.FieldValue.increment(outputTokens);
    } else {
        updateData.imageInputTokens = admin.firestore.FieldValue.increment(inputTokens);
        updateData.imageOutputTokens = admin.firestore.FieldValue.increment(outputTokens);
    }

    try {
        await projectRef.update(updateData);
        return cost;
    } catch (error) {
        console.error(`[pricingService] Error updating project ${projectRef.id}:`, error);
        throw error;
    }
}
