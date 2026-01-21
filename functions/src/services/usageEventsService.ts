import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateCost, getModelPricing } from './pricingService';
import { getModelForOperation, getOperationType } from './modelMappingService';

type OperationType = 'text' | 'image';

function validateTokens(inputTokens: number, outputTokens: number) {
    if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
        throw new Error('[usageEventsService] Token counts must be finite numbers');
    }
    if (inputTokens < 0 || outputTokens < 0) {
        throw new Error('[usageEventsService] Token counts must be non-negative');
    }
}

export async function recordUsage(params: {
    userId: string;
    projectId: string;
    operationKey: string;
    inputTokens: number;
    outputTokens: number;
}): Promise<void> {
    const { userId, projectId, operationKey, inputTokens, outputTokens } = params;

    if (!userId || !projectId) {
        throw new Error('[usageEventsService] Missing required identifiers');
    }

    validateTokens(inputTokens, outputTokens);

    const modelKey = getModelForOperation(operationKey);
    const operationType: OperationType = getOperationType(operationKey);
    const pricing = await getModelPricing(modelKey);

    if (!pricing) {
        throw new Error(`[usageEventsService] Missing pricing for model ${modelKey}`);
    }

    const cost = calculateCost(inputTokens, outputTokens, pricing);
    const db = admin.firestore();
    const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

    const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
        totalCost: FieldValue.increment(cost)
    };

    if (operationType === 'text') {
        updates.textInputTokens = FieldValue.increment(inputTokens);
        updates.textOutputTokens = FieldValue.increment(outputTokens);
    } else {
        updates.imageInputTokens = FieldValue.increment(inputTokens);
        updates.imageOutputTokens = FieldValue.increment(outputTokens);
    }

    await projectRef.update(updates);
}
