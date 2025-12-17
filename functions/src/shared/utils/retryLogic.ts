import { GeminiError } from '../errors';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;
const TIMEOUT_MS = 120000; // 2 minutes total timeout
const FAILURE_THRESHOLD = 5;
const CHECK_WINDOW_MS = 60000;
const RESET_TIMEOUT_MS = 30000;

export class RateLimiter {
    private concurrentRequests = 0;
    private maxConcurrent = 5; // Simple in-process limit
    private failureCount = 0;
    private lastFailureTime = 0;
    private circuitOpen = false;

    async acquire() {
        if (this.circuitOpen) {
            if (Date.now() - this.lastFailureTime > RESET_TIMEOUT_MS) {
                this.circuitOpen = false;
                this.failureCount = 0; // Half-open/reset
            } else {
                throw new GeminiError("Service temporarily unavailable (Circuit Breaker Open)", 'CIRCUIT_OPEN', false);
            }
        }

        if (this.concurrentRequests >= this.maxConcurrent) {
            throw new GeminiError("Service busy (Max Concurrency Reached)", 'BUSY', true);
        }
        this.concurrentRequests++;
    }

    release() {
        this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);
    }

    recordFailure(isRetryable: boolean) {
        if (isRetryable) { // Only track retryable errors (load/5xx) for circuit breaking
            const now = Date.now();
            // Reset failure count if outside the check window (sliding window effect)
            if (now - this.lastFailureTime > CHECK_WINDOW_MS) {
                this.failureCount = 0;
            }

            this.failureCount++;
            this.lastFailureTime = now;

            if (this.failureCount >= FAILURE_THRESHOLD) {
                this.circuitOpen = true;
                console.warn("Circuit Breaker OPENED due to high failure rate.");
            }
        }
    }

    recordSuccess() {
        this.failureCount = 0;
        this.circuitOpen = false;
    }
}

const rateLimiter = new RateLimiter();

export async function retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = INITIAL_DELAY_MS, deadline?: number): Promise<T> {
    // Set deadline on first call
    if (!deadline) {
        deadline = Date.now() + TIMEOUT_MS;
    }

    // Check deadline BEFORE acquire to avoid unnecessary locking
    const now = Date.now();
    if (now > deadline) {
        throw new GeminiError(`Request timed out after ${TIMEOUT_MS}ms`, 'TIMEOUT', false);
    }

    await rateLimiter.acquire();

    let timeoutId: any = null;

    try {
        // Per-attempt timeout: Race the function against the remaining time (clamped to 250ms min)
        const timeRemaining = deadline - now;

        // Safety: If not enough time to make a meaningful attempt, fail fast.
        if (timeRemaining < 250) {
            throw new GeminiError('Global deadline exceeded (insufficient time for attempt)', 'TIMEOUT', false);
        }

        const attemptTimeout = timeRemaining; // Use exact remaining time, do not extend

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new GeminiError('Request timed out', 'TIMEOUT', true)), attemptTimeout);
        });

        const result = await Promise.race([fn(), timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);

        rateLimiter.recordSuccess();
        rateLimiter.release();
        return result;

    } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);

        // Normalize error message for consistent checks
        const errorMessage = (error?.message || '').toLowerCase();

        // Check for Payload/Context errors - DO NOT RETRY - release and throw
        if (errorMessage.includes('context length') || errorMessage.includes('token limit') || errorMessage.includes('payload too large') || error.status === 400) {
            rateLimiter.recordFailure(false); // Record, but not as "retryable" circuit breaker failure
            rateLimiter.release();
            // Wrap in GeminiError if not already
            if (error instanceof GeminiError) throw error;
            throw new GeminiError(error.message, 'INVALID_REQUEST', false, error);
        }

        // Broaden retryable status checks
        const status = error?.status || error?.response?.status;
        const isRetryable =
            (error instanceof GeminiError && error.isRetryable) || // Respect our own internal flags
            status === 429 ||
            status === 503 ||
            status === 500 ||
            status === 502 ||
            status === 504 ||
            status === 408 ||
            errorMessage.includes('429') ||
            errorMessage.includes('503') ||
            errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('econnreset');

        rateLimiter.recordFailure(isRetryable); // Track for circuit breaker
        rateLimiter.release(); // Release slot before waiting/retrying

        if (!isRetryable) {
            if (error instanceof GeminiError) throw error;
            throw new GeminiError(error.message, 'API_ERROR', false, error);
        }

        // Smart Retry Logic (Hints + Deadline Cap)
        let nextDelay: number;

        if (error?.retryDelay) {
            // Authoritative hint: Use it directly + jitter
            nextDelay = error.retryDelay + (Math.random() * 200);
        } else {
            // Exponential Backoff
            nextDelay = Math.min(delay * 2, MAX_DELAY_MS) + (Math.random() * 200);
        }

        // Cap delay to remaining deadline time
        // We already released the limiter, so we can sleep safely without holding a slot.
        const timeNow = Date.now();
        const timeLeft = deadline - timeNow;

        // Safety check: if time left is too small to reasonably retry, fail now
        if (timeLeft < 500) {
            throw new GeminiError("Deadline exceeded/insufficient time for retry", 'TIMEOUT', false);
        }

        // Adjust delay if it exceeds remaining time (minus buffer)
        if (nextDelay > (timeLeft - 500)) {
            nextDelay = timeLeft - 500;
        }

        console.warn(`Retrying Gemini request... Attempts left: ${retries}. Delay: ${Math.round(nextDelay)}ms. Deadline in: ${Math.round(timeLeft)}ms`);
        await new Promise(resolve => setTimeout(resolve, nextDelay));

        return retryWithBackoff(fn, retries - 1, nextDelay, deadline);
    }
}

// Helper to extract JSON array safely
export function extractFirstJsonArray(text: string): any[] {
    // 1. Remove ALL code fences to avoid confusion
    // Note: We do NOT globally strip fences/backticks, as they might appear validly inside JSON strings.
    // The scanner below is robust enough to find the array boundaries.
    const cleanText = text.trim();

    // 2. Scan for top-level JSON array that looks like valid slide data
    // Look for the first '[' that is followed eventually by a '{'
    let firstBracket = -1;
    for (let i = 0; i < cleanText.length; i++) {
        if (cleanText[i] === '[') {
            // Check if there's a '{' before any closing ']' (naive check but effective for this schema)
            const nextOpenBrace = cleanText.indexOf('{', i);
            const nextCloseBracket = cleanText.indexOf(']', i);

            if (nextOpenBrace !== -1 && (nextCloseBracket === -1 || nextOpenBrace < nextCloseBracket)) {
                firstBracket = i;
                break;
            }
        }
    }

    if (firstBracket === -1) {
        // Fallback: Just look for first '[' if the stricter check fails
        firstBracket = cleanText.indexOf('[');
        if (firstBracket === -1) {
            throw new Error("No JSON array found in response");
        }
    }

    // 3. Simple bracket matching to find the end
    let openCount = 0;
    let endIndex = -1;
    let inString = false;
    let escape = false;

    for (let i = firstBracket; i < cleanText.length; i++) {
        const char = cleanText[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '[') {
                openCount++;
            } else if (char === ']') {
                openCount--;
                if (openCount === 0) {
                    endIndex = i;
                    break;
                }
            }
        }
    }

    if (endIndex === -1) {
        // Attempt parse from start to end of string if matching failed
        try {
            return JSON.parse(cleanText.substring(firstBracket));
        } catch {
            throw new Error("Found start of JSON array but could not find matching end bracket");
        }
    }

    const jsonString = cleanText.substring(firstBracket, endIndex + 1);

    // 4. Attempt parse with sanitization
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        // Attempt simple sanitization (trailing commas)
        try {
            const sanitized = jsonString.replace(/,\s*([\]}])/g, '$1');
            return JSON.parse(sanitized);
        } catch (e2) {
            // Only warn here, let the caller handle the repair pass
            console.warn("JSON Extraction Failed (Snippet):", jsonString.substring(0, 150) + "...");
            throw new Error("Failed to parse extracted JSON array");
        }
    }
}
