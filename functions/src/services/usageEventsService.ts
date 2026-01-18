import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateCost, getModelPricing } from './pricingService';
import { getModelForOperation, getOperationType } from './modelMappingService';

type OperationType = 'text' | 'image';

export type UsageEventContext = {
    requestId: string;
    parentRequestId?: string;
    userId: string;
    projectId: string;
    sourceEndpoint?: string;
    idempotencyKeySource: 'client' | 'server';
};

const TOKEN_BOUNDS: Record<string, { maxInput: number; maxOutput: number }> = {
    'slide-research': { maxInput: 1_000_000, maxOutput: 500_000 },
    'slide-generation': { maxInput: 500_000, maxOutput: 1_000_000 },
    'image-prompt': { maxInput: 50_000, maxOutput: 10_000 },
    'image-generation': { maxInput: 100_000, maxOutput: 50_000 },
    'text-extraction': { maxInput: 200_000, maxOutput: 50_000 }
};

function validateTokens(operationKey: string, inputTokens: number, outputTokens: number) {
    const bounds = TOKEN_BOUNDS[operationKey];
    if (!bounds) {
        throw new Error(`[usageEventsService] Unknown operationKey: ${operationKey}`);
    }
    if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
        throw new Error(`[usageEventsService] Token counts must be finite numbers`);
    }
    if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens)) {
        throw new Error(`[usageEventsService] Token counts must be integers`);
    }
    if (inputTokens < 0 || outputTokens < 0) {
        throw new Error(`[usageEventsService] Token counts must be non-negative`);
    }
    if (inputTokens > bounds.maxInput || outputTokens > bounds.maxOutput) {
        throw new Error(
            `[usageEventsService] Token counts exceed bounds for ${operationKey}: ` +
            `input=${inputTokens} output=${outputTokens}`
        );
    }
}

export async function recordUsageEvent(params: {
    requestId: string;
    parentRequestId?: string;
    userId: string;
    projectId: string;
    operationKey: string;
    sourceEndpoint?: string;
    inputTokens: number;
    outputTokens: number;
    idempotencyKeySource: 'client' | 'server';
}): Promise<void> {
    const {
        requestId,
        parentRequestId,
        userId,
        projectId,
        operationKey,
        sourceEndpoint,
        inputTokens,
        outputTokens,
        idempotencyKeySource
    } = params;

    if (!requestId || !userId || !projectId) {
        throw new Error('[usageEventsService] Missing required identifiers');
    }

    validateTokens(operationKey, inputTokens, outputTokens);

    const modelKey = getModelForOperation(operationKey);
    const operationType: OperationType = getOperationType(operationKey);
    const pricing = await getModelPricing(modelKey);

    let costStatus: 'calculated' | 'pending' = 'pending';
    let cost: number | undefined;
    let pricingId: string | undefined;
    let pricingVersion: number | undefined;

    if (pricing && typeof pricing.updatedAt === 'number' && Number.isFinite(pricing.updatedAt)) {
        costStatus = 'calculated';
        cost = calculateCost(inputTokens, outputTokens, pricing);
        pricingId = pricing.id;
        pricingVersion = pricing.updatedAt;
    }

    const db = admin.firestore();
    const eventRef = db.collection('usageEvents').doc(requestId);
    const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

    await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(eventRef);
        if (existing.exists) {
            return;
        }

        const aggregateUpdates: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp()
        };

        if (operationType === 'text') {
            aggregateUpdates.textInputTokens = FieldValue.increment(inputTokens);
            aggregateUpdates.textOutputTokens = FieldValue.increment(outputTokens);
        } else {
            aggregateUpdates.imageInputTokens = FieldValue.increment(inputTokens);
            aggregateUpdates.imageOutputTokens = FieldValue.increment(outputTokens);
        }

        if (costStatus === 'calculated' && cost !== undefined) {
            aggregateUpdates.totalCost = FieldValue.increment(cost);
        }

        const eventData: Record<string, unknown> = {
            requestId,
            parentRequestId,
            userId,
            projectId,
            operationType,
            operationKey,
            sourceEndpoint,
            modelKey,
            inputTokens,
            outputTokens,
            costStatus,
            idempotencyKeySource,
            processing: false,
            createdAt: FieldValue.serverTimestamp()
        };

        if (costStatus === 'calculated' && cost !== undefined) {
            eventData.cost = cost;
            eventData.pricingId = pricingId;
            eventData.pricingVersion = pricingVersion;
            eventData.processedAt = FieldValue.serverTimestamp();
        }

        transaction.set(eventRef, eventData);
        transaction.update(projectRef, aggregateUpdates);
    });
}
