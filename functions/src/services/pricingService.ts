import * as admin from 'firebase-admin';
import { ModelPricing } from '@shared/types';

const PRICING_CACHE = new Map<string, { data: ModelPricing; timestamp: number }>();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

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

export function invalidatePricingCache(modelId?: string) {
    if (modelId) {
        PRICING_CACHE.delete(modelId);
        return;
    }
    PRICING_CACHE.clear();
}
