/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
    return error instanceof Error;
}

/**
 * Type guard to check if error has isRetryable property
 */
export function isRetryableError(error: unknown): error is Error & { isRetryable: boolean } {
    return isError(error) && 'isRetryable' in error && typeof (error as any).isRetryable === 'boolean';
}

/**
 * Type guard for Firestore Timestamp
 */
export function isFirestoreTimestamp(value: unknown): value is { toDate: () => Date } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'toDate' in value &&
        typeof (value as { toDate: unknown }).toDate === 'function'
    );
}
