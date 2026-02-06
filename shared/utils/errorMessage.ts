/**
 * Returns a string message from an unknown caught value.
 * Use in catch (error: unknown) blocks instead of error?.message.
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
