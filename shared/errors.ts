export class GeminiError extends Error {
    constructor(
        message: string,
        public code: 'TIMEOUT' | 'RATE_LIMIT' | 'BUSY' | 'CIRCUIT_OPEN' | 'INVALID_REQUEST' | 'API_ERROR' | 'UNKNOWN',
        public isRetryable: boolean,
        public details?: any
    ) {
        super(message);
        this.name = 'GeminiError';
    }
}

export class ImageGenError extends Error {
    public code: 'NO_IMAGE_DATA' | 'INVALID_MIME_TYPE' | 'NETWORK' | 'TIMEOUT' | 'UNKNOWN';
    public isRetryable: boolean;
    public context?: any;

    constructor(
        message: string,
        code: 'NO_IMAGE_DATA' | 'INVALID_MIME_TYPE' | 'NETWORK' | 'TIMEOUT' | 'UNKNOWN',
        isRetryable: boolean,
        context?: any
    ) {
        super(message);
        this.name = 'ImageGenError';
        this.code = code;
        this.isRetryable = isRetryable;
        this.context = context;
    }
}
