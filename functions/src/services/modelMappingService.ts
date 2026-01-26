import { MODEL_IMAGE_GENERATION, MODEL_SLIDE_GENERATION } from '@shared/constants';

type OperationType = 'text' | 'image';

const OPERATION_MAP: Record<string, { modelKey: string; operationType: OperationType }> = {
    'slide-research': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
    'slide-generation': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
    'image-prompt': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
    'image-search-terms': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
    'text-extraction': { modelKey: MODEL_SLIDE_GENERATION, operationType: 'text' },
    'image-generation': { modelKey: MODEL_IMAGE_GENERATION, operationType: 'image' }
};

export function getModelForOperation(operationKey: string): string {
    const entry = OPERATION_MAP[operationKey];
    if (!entry) {
        throw new Error(`[modelMappingService] Unknown operationKey: ${operationKey}`);
    }
    return entry.modelKey;
}

export function getOperationType(operationKey: string): OperationType {
    const entry = OPERATION_MAP[operationKey];
    if (!entry) {
        throw new Error(`[modelMappingService] Unknown operationKey: ${operationKey}`);
    }
    return entry.operationType;
}
