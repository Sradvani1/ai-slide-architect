import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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
        totalCost: FieldValue.increment(cost),
        updatedAt: FieldValue.serverTimestamp()
    };

    if (operationType === 'text') {
        updateData.textInputTokens = FieldValue.increment(inputTokens);
        updateData.textOutputTokens = FieldValue.increment(outputTokens);
    } else {
        updateData.imageInputTokens = FieldValue.increment(inputTokens);
        updateData.imageOutputTokens = FieldValue.increment(outputTokens);
    }

    try {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricingService.ts:78',message:'About to update project cost',data:{projectId:projectRef.id,modelId,cost,inputTokens,outputTokens,operationType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        await projectRef.update(updateData);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricingService.ts:80',message:'Project cost updated successfully',data:{projectId:projectRef.id,cost},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return cost;
    } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6352f1d4-1b3b-4b40-b2cb-cdebc7a19877',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pricingService.ts:82',message:'Error updating project cost',data:{projectId:projectRef.id,errorMessage:error?.message,errorStack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error(`[pricingService] Error updating project ${projectRef.id}:`, error);
        throw error;
    }
}
