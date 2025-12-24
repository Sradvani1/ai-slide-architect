export type PromptGenerationState = 'pending' | 'queued' | 'generating' | 'partial' | 'completed' | 'failed';

/**
 * Validates a state transition for the prompt generation state machine.
 */
export function validateStateTransition(
    currentState: PromptGenerationState | undefined,
    newState: PromptGenerationState
): boolean {
    const validTransitions: Record<PromptGenerationState, PromptGenerationState[]> = {
        'pending': ['queued', 'generating', 'failed'],
        'queued': ['generating', 'failed'],
        'generating': ['partial', 'completed', 'failed'],
        'partial': ['generating', 'completed', 'failed'],
        'failed': ['queued', 'generating'],
        'completed': []
    };

    if (!currentState) {
        // Initial transitions
        return newState === 'pending' || newState === 'queued' || newState === 'generating';
    }

    // Allow staying in the same state (idempotency)
    if (currentState === newState) return true;

    return validTransitions[currentState]?.includes(newState) ?? false;
}

/**
 * Calculates the next retry time using exponential backoff.
 * 2^attempts minutes, capped at 60 minutes.
 */
export function calculateNextRetryTime(attempts: number): Date {
    const minutes = Math.min(Math.pow(2, attempts), 60);
    return new Date(Date.now() + minutes * 60 * 1000);
}
